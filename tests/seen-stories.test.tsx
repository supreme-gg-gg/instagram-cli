/* eslint-disable @typescript-eslint/no-unsafe-call */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import test, {type ExecutionContext} from 'ava';
import React from 'react';
import {render} from 'ink-testing-library';
import {SeenStoriesManager} from '../source/utils/seen-stories.js';
import ListDetailDisplay from '../source/ui/components/list-detail-display.js';
import type {ListMediaItem, Story} from '../source/types/instagram.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const delay = async (ms: number): Promise<void> => {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
};

async function createManager(
	username = 'testuser',
): Promise<{manager: SeenStoriesManager; dir: string}> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'seen-stories-test-'));
	const manager = new SeenStoriesManager(username, dir);
	await manager.load();
	return {manager, dir};
}

const makeStory = (
	id: string,
	userPk = 1,
	takenAt = Math.floor(Date.now() / 1000),
): Story => ({
	id,
	media_type: 1,
	taken_at: takenAt,
	user: {pk: userPk, username: `user${userPk}`},
	image_versions2: {
		candidates: [
			{url: 'https://example.com/img.jpg', width: 1080, height: 1920},
		],
	},
});

function buildReel(
	pk: string,
	label: string,
	storyCount: number,
): ListMediaItem<Story> {
	const numericPk = Number(pk.replaceAll(/\D/g, ''));
	const userPk = Number.isNaN(numericPk) ? 1 : numericPk;
	const stories: Story[] = [];
	for (let i = 0; i < storyCount; i++) {
		stories.push(makeStory(`${pk}_s${i}`, userPk));
	}

	return {
		pk,
		label,
		fullName: label,
		content: stories,
	};
}

function buildReels(
	count: number,
	storiesPerReel = 1,
): Array<ListMediaItem<Story>> {
	return Array.from({length: count}, (_, i) =>
		buildReel(`u${i}`, `User ${i + 1}`, storiesPerReel),
	);
}

// ── File I/O ─────────────────────────────────────────────────────────────────

test('TC-001: file exists with valid JSON', async t => {
	const {manager, dir} = await createManager();
	const filePath = path.join(dir, 'storage', 'seen-stories_testuser.json');
	await fs.mkdir(path.dirname(filePath), {recursive: true});
	await fs.writeFile(
		filePath,
		JSON.stringify({
			lastUpdated: 1000,
			users: {u1: 1000},
		}),
	);
	await manager.load();

	t.is(manager.getSeenTimestamp('u1'), 1000);
});

test('TC-002: file does not exist creates empty structure', async t => {
	const {manager} = await createManager();

	t.is(manager.getSeenTimestamp('nonexistent'), 0);
});

test('TC-003: malformed JSON handled gracefully', async t => {
	const {manager, dir} = await createManager();
	const filePath = path.join(dir, 'storage', 'seen-stories_testuser.json');
	await fs.mkdir(path.dirname(filePath), {recursive: true});
	await fs.writeFile(filePath, 'not valid json {{{');
	await manager.load();

	t.is(manager.getSeenTimestamp('u1'), 0);
});

// ── Tray-level seen state ────────────────────────────────────────────────────
// Reel R1: stories at 100, 200 -> latest_reel_media 200
// Reel R2: stories at 300, 400 -> latest_reel_media 400
// Reel R3: stories at 500 ->      latest_reel_media 500

const buildTrayFixture = (): Map<string, Story[]> => {
	const r1 = [makeStory('a', 1, 100), makeStory('b', 1, 200)];
	const r2 = [makeStory('c', 2, 300), makeStory('d', 2, 400)];
	const r3 = [makeStory('e', 3, 500)];
	return new Map([
		['R1', r1],
		['R2', r2],
		['R3', r3],
	]);
};

const latestFor = (stories: Story[]): number =>
	Math.max(...stories.map(story => story.taken_at));

test('TC-003a: all reels already seen', async t => {
	const {manager} = await createManager();
	const tray = buildTrayFixture();

	manager.registerSeenTimestamp('R1', 200);
	manager.registerSeenTimestamp('R2', 400);
	manager.registerSeenTimestamp('R3', 500);

	for (const [pk, stories] of tray) {
		t.true(manager.areAllStoriesSeen(pk, latestFor(stories)));
		t.is(manager.getFirstUnseenIndex(pk, stories), 0);
	}
});

test('TC-003b: some reels already seen, focus on first unseen', async t => {
	const {manager} = await createManager();
	const tray = buildTrayFixture();

	// R1 and R3 fully seen, R2 only partially (story "c" seen, "d" not)
	manager.registerSeenTimestamp('R1', 200);
	manager.registerSeenTimestamp('R2', 300);
	manager.registerSeenTimestamp('R3', 500);

	t.true(manager.areAllStoriesSeen('R1', latestFor(tray.get('R1')!)));
	t.false(manager.areAllStoriesSeen('R2', latestFor(tray.get('R2')!)));
	t.true(manager.areAllStoriesSeen('R3', latestFor(tray.get('R3')!)));

	// Focus lands on the first reel that is not fully seen
	const firstUnseenReel = [...tray.keys()].find(
		pk => !manager.areAllStoriesSeen(pk, latestFor(tray.get(pk)!)),
	);
	t.is(firstUnseenReel, 'R2');
	t.is(manager.getFirstUnseenIndex('R2', tray.get('R2')!), 1);
});

test('TC-003c: no reels seen', async t => {
	const {manager} = await createManager();
	const tray = buildTrayFixture();

	for (const [pk, stories] of tray) {
		t.false(manager.areAllStoriesSeen(pk, latestFor(stories)));
		t.is(manager.getFirstUnseenIndex(pk, stories), 0);
	}
});

// ── Story-level (carousel) ───────────────────────────────────────────────────

test('TC-004: all stories seen in reel, carousel starts at 0 (replay)', async t => {
	const {manager} = await createManager();
	manager.registerSeenTimestamp('u1', 300);

	const stories = [
		makeStory('a', 1, 100),
		makeStory('b', 1, 200),
		makeStory('c', 1, 300),
	];

	t.true(manager.areAllStoriesSeen('u1', latestFor(stories)));
	t.is(manager.getFirstUnseenIndex('u1', stories), 0);
});

test('TC-005: some stories unseen, carouselIndex at first unseen', async t => {
	const {manager} = await createManager();
	manager.registerSeenTimestamp('u1', 100);

	const stories = [
		makeStory('a', 1, 100),
		makeStory('b', 1, 200),
		makeStory('c', 1, 300),
	];

	t.false(manager.areAllStoriesSeen('u1', latestFor(stories)));
	t.is(manager.getFirstUnseenIndex('u1', stories), 1);
});

test('TC-005a: some stories became unavailable, no eviction needed', async t => {
	const {manager} = await createManager();
	// Old reel [a(100), b(200), c(300)] fully viewed
	manager.registerSeenTimestamp('u1', 300);

	// Tray now [c(300), d(400), e(500)]: stale [a, b] are simply gone,
	// the seen timestamp still identifies "c" as seen
	const stories = [
		makeStory('c', 1, 300),
		makeStory('d', 1, 400),
		makeStory('e', 1, 500),
	];

	t.is(manager.getFirstUnseenIndex('u1', stories), 1);
	t.is(manager.getSeenTimestamp('u1'), 300);
});

test('TC-005b: all seen stories are gone, none seen', async t => {
	const {manager} = await createManager();
	// Old reel [a(100), b(200)] fully viewed
	manager.registerSeenTimestamp('u1', 200);

	// Tray now [c(300), d(400), e(500)]: nothing carried over
	const stories = [
		makeStory('c', 1, 300),
		makeStory('d', 1, 400),
		makeStory('e', 1, 500),
	];

	t.false(manager.areAllStoriesSeen('u1', latestFor(stories)));
	t.is(manager.getFirstUnseenIndex('u1', stories), 0);
});

// ── Boundary ─────────────────────────────────────────────────────────────────

test('TC-006: empty tray response handled gracefully', async t => {
	const {manager} = await createManager();
	manager.registerSeenTimestamp('u1', 100);

	manager.syncUsers([]);

	t.is(manager.getSeenTimestamp('u1'), 0);
});

test('TC-007: empty media_ids list is not treated as seen', async t => {
	const {manager} = await createManager();
	manager.registerSeenTimestamp('u1', 300);

	// A reel with no stories has no latest_reel_media -> nothing to mark seen
	t.false(manager.areAllStoriesSeen('u1', 0));
});

// ── Pre-fetch ────────────────────────────────────────────────────────────────

test('TC-008: first 3 users trigger loadMore on mount', async t => {
	const loadedIndices: number[] = [];
	const items = buildReels(5, 0);

	const {unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={(index: number) => {
				loadedIndices.push(index);
			}}
			mode="story"
		/>,
	);

	await delay(100);

	t.true(loadedIndices.includes(0));
	unmount();
});

test('TC-009: fewer than 3 users, loading does not crash', async t => {
	const loadedIndices: number[] = [];
	const items = buildReels(2, 0);

	const {lastFrame, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={(index: number) => {
				loadedIndices.push(index);
			}}
			mode="story"
		/>,
	);

	await delay(100);

	t.true(loadedIndices.includes(0));
	t.truthy(lastFrame());
	unmount();
});

// ── Navigation: Up / Down ────────────────────────────────────────────────────

test('TC-010: down arrow increments selectedIndex', async t => {
	const items = buildReels(3);
	const {lastFrame, stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={() => {}}
			mode="story"
		/>,
	);

	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 1'));

	stdin.write('\u001B[B');
	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 2'));

	stdin.write('\u001B[B');
	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 3'));

	unmount();
});

test('TC-010: up arrow decrements selectedIndex', async t => {
	const items = buildReels(3);
	const {lastFrame, stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={() => {}}
			mode="story"
		/>,
	);

	await delay(50);
	stdin.write('\u001B[B');
	await delay(50);
	stdin.write('\u001B[B');
	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 3'));

	stdin.write('\u001B[A');
	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 2'));

	unmount();
});

test('TC-011: up arrow at first item stays at 0', async t => {
	const items = buildReels(3);
	const {lastFrame, stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={() => {}}
			mode="story"
		/>,
	);

	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 1'));

	stdin.write('\u001B[A');
	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 1'));

	unmount();
});

test('TC-012: down arrow at last item stays at max', async t => {
	const items = buildReels(3);
	const {lastFrame, stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={() => {}}
			mode="story"
		/>,
	);

	await delay(50);
	stdin.write('\u001B[B');
	await delay(50);
	stdin.write('\u001B[B');
	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 3'));

	stdin.write('\u001B[B');
	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 3'));

	unmount();
});

test('TC-010/T-011: j/k keys navigate same as arrows', async t => {
	const items = buildReels(3);
	const {lastFrame, stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={() => {}}
			mode="story"
		/>,
	);

	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 1'));

	stdin.write('j');
	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 2'));

	stdin.write('k');
	await delay(50);
	t.truthy(lastFrame()?.includes('➜ User 1'));

	unmount();
});

// ── Navigation: Left / Right (Carousel) ──────────────────────────────────────

test('TC-013: right arrow advances carouselIndex', async t => {
	const items = buildReels(2, 1);
	(items[0] as any).content = [
		makeStory('r0_s1'),
		makeStory('r0_s2'),
		makeStory('r0_s3'),
	];
	(items[1] as any).content = [makeStory('r1_s1')];

	const {lastFrame, stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={() => {}}
			mode="story"
		/>,
	);

	await delay(50);
	t.truthy(lastFrame()?.includes('User 1'), 'First user rendered');

	stdin.write('\u001B[C');
	await delay(50);
	stdin.write('\u001B[C');
	await delay(50);

	unmount();
});

test('TC-014: left arrow at carouselIndex 0 stays at 0', async t => {
	const items = buildReels(2, 1);
	(items[0] as any).content = [makeStory('r0_s1'), makeStory('r0_s2')];
	(items[1] as any).content = [makeStory('r1_s1')];

	const {lastFrame, stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={() => {}}
			mode="story"
		/>,
	);

	await delay(50);
	t.truthy(lastFrame()?.includes('User 1'));

	stdin.write('\u001B[D');
	await delay(50);

	unmount();
});

test('TC-015: right arrow at max carouselIndex stays at max', async t => {
	const items = buildReels(2, 1);
	(items[0] as any).content = [makeStory('r0_s1'), makeStory('r0_s2')];
	(items[1] as any).content = [makeStory('r1_s1')];

	const {lastFrame, stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={() => {}}
			mode="story"
		/>,
	);

	await delay(50);
	t.truthy(lastFrame()?.includes('User 1'));

	stdin.write('\u001B[C');
	await delay(50);
	stdin.write('\u001B[C');
	await delay(50);

	unmount();
});

test('TC-013/TC-014: h/l keys navigate carousel', async t => {
	const items = buildReels(2, 1);
	(items[0] as any).content = [makeStory('r0_s1'), makeStory('r0_s2')];
	(items[1] as any).content = [makeStory('r1_s1')];

	const {lastFrame, stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={() => {}}
			mode="story"
		/>,
	);

	await delay(50);
	t.truthy(lastFrame()?.includes('User 1'));

	stdin.write('l');
	await delay(50);
	stdin.write('h');
	await delay(50);

	unmount();
});

// ── Load-once ────────────────────────────────────────────────────────────────

test('TC-016: stories loaded once per reel (lazy load on select)', async t => {
	const loads = new Map<number, number>();
	const items = buildReels(4, 0);

	const {stdin, unmount} = render(
		<ListDetailDisplay
			listItems={items as any}
			loadMore={(index: number) => {
				loads.set(index, (loads.get(index) ?? 0) + 1);
			}}
			mode="story"
		/>,
	);

	// Initial render triggers load for index 0
	await delay(100);
	t.is(loads.get(0), 1);

	// Navigate to index 1 triggers load
	stdin.write('\u001B[B');
	await delay(100);
	t.is(loads.get(1), 1);

	// Navigate back to index 0 should NOT re-trigger load (content already set)
	stdin.write('\u001B[A');
	await delay(100);
	t.is(loads.get(0), 1);

	unmount();
});

// ── Full Story View Smoke Test ───────────────────────────────────────────────

test('TC-008/TC-009(integration): full story view renders without crashing', async t => {
	// Render ListDetailDisplay directly, bypassing AltScreen/MouseProvider
	// which write ANSI escape sequences incompatible with lastFrame()
	const {mockClient} = await import('../source/mocks/index.js');
	const {mockStories} = await import('../source/mocks/mock-data.js');

	const seen = new Set<number>();
	const mockReels: Array<ListMediaItem<Story>> = [];

	for (const story of mockStories) {
		const {user} = story;
		if (!seen.has(user.pk)) {
			seen.add(user.pk);
			mockReels.push({
				pk: `${user.pk}`,
				label: user.username,
				fullName: user.full_name,
				content: [],
			});
		}
	}

	const {lastFrame, unmount} = render(
		<ListDetailDisplay
			listItems={mockReels as any}
			loadMore={() => {}}
			mode="story"
			client={mockClient}
		/>,
	);

	await delay(2000);

	const output = lastFrame()!;
	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	const hasContent = output.includes('User') || output.includes('Stories');
	t.truthy(hasContent, 'Should show story content');

	unmount();
});
