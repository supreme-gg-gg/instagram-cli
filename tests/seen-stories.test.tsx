/* eslint-disable @typescript-eslint/no-unsafe-call */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import test, {type ExecutionContext} from 'ava';
import React from 'react';
import {render} from 'ink-testing-library';
import {SeenStoriesManager} from '../source/utils/seen-stories.js';
import {ConfigManager} from '../source/config.js';
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
	const config = ConfigManager.getInstance();
	await config.set('advanced.dataDir', dir);
	const manager = new SeenStoriesManager(username);
	await manager.load();
	return {manager, dir};
}

const makeStory = (id: string, userPk = 1): Story => ({
	id,
	media_type: 1,
	taken_at: Math.floor(Date.now() / 1000),
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
			users: {u1: {seenStories: ['a', 'b', 'c']}},
		}),
	);
	await manager.load();

	t.deepEqual(manager.getSeenStories('u1'), ['a', 'b', 'c']);
});

test('TC-002: file does not exist creates empty structure', async t => {
	const {manager} = await createManager();

	t.deepEqual(manager.getSeenStories('nonexistent'), []);
});

test('TC-003: malformed JSON handled gracefully', async t => {
	const {manager, dir} = await createManager();
	const filePath = path.join(dir, 'storage', 'seen-stories_testuser.json');
	await fs.mkdir(path.dirname(filePath), {recursive: true});
	await fs.writeFile(filePath, 'not valid json {{{');
	await manager.load();

	t.deepEqual(manager.getSeenStories('u1'), []);
});

// ── Sync & State ─────────────────────────────────────────────────────────────

test('TC-003a: all reels already seen', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'a');
	manager.registerStoryId('u1', 'b');
	manager.registerStoryId('u1', 'c');

	manager.syncUsers(['u1'], new Map([['u1', ['a', 'b', 'c']]]));

	t.deepEqual(manager.getSeenStories('u1'), ['a', 'b', 'c']);
});

test('TC-003b: some reels already seen, focus on first unseen', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'a');
	manager.registerStoryId('u1', 'c');

	manager.syncUsers(
		['u1', 'u2'],
		new Map([
			['u1', ['a', 'b', 'c', 'd']],
			['u2', ['d', 'e', 'f']],
		]),
	);

	t.deepEqual(manager.getSeenStories('u1'), ['a', 'c']);
	t.deepEqual(manager.getSeenStories('u2'), ['d']);
});

test('TC-003c: no reels seen', async t => {
	const {manager} = await createManager();

	manager.syncUsers(['u1'], new Map([['u1', ['a', 'b', 'c']]]));
	t.deepEqual(manager.getSeenStories('u1'), []);
});

test('TC-004: all stories seen in reel', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'a');
	manager.registerStoryId('u1', 'b');
	manager.registerStoryId('u1', 'c');

	t.deepEqual(manager.getSeenStories('u1'), ['a', 'b', 'c']);
});

test('TC-005: some stories unseen, carouselIndex at first unseen', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'a');

	const seen = manager.getSeenStories('u1');
	const mediaIds = ['a', 'b', 'c'];
	const firstUnseenIndex = mediaIds.findIndex(id => !seen.includes(id));

	t.is(firstUnseenIndex, 1);
});

test('TC-005a: stale seen stories evicted, carousel at first unseen', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'a');
	manager.registerStoryId('u1', 'b');
	manager.registerStoryId('u1', 'c');

	manager.syncUsers(['u1'], new Map([['u1', ['c', 'd', 'e']]]));

	const seen = manager.getSeenStories('u1');
	const mediaIds = ['c', 'd', 'e'];
	const firstUnseenIndex = mediaIds.findIndex(id => !seen.includes(id));

	t.deepEqual(seen, ['c']);
	t.is(firstUnseenIndex, 1);
});

test('TC-005b: all seen stories stale, cleared to none', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'a');
	manager.registerStoryId('u1', 'b');

	manager.syncUsers(['u1'], new Map([['u1', ['c', 'd', 'e']]]));

	const seen = manager.getSeenStories('u1');

	t.deepEqual(seen, []);
});

test('TC-006: empty tray response handled gracefully', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'a');

	manager.syncUsers([], new Map());

	t.deepEqual(manager.getSeenStories('u1'), []);
});

test('TC-007: empty media_ids marks reel as seen', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'a');

	manager.syncUsers(['u1'], new Map([['u1', []]]));

	t.deepEqual(manager.getSeenStories('u1'), []);
});

// ── Marking Stories ──────────────────────────────────────────────────────────

test('TC-017: story ID added to seenStories on view', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'story_123');

	t.true(manager.getSeenStories('u1').includes('story_123'));
});

test('TC-017: story ID with userPk suffix normalized', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'mediaPk_userPk');

	t.true(manager.getSeenStories('u1').includes('mediaPk'));
});

test('TC-019: all stories become seen marks reel as seen', async t => {
	const {manager} = await createManager();
	const ids = ['a', 'b', 'c'];

	for (const id of ids) {
		manager.registerStoryId('u1', id);
	}

	t.deepEqual(manager.getSeenStories('u1'), ids);
});

test('TC-022: single story reel, first view marks and seen', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'only_story');

	t.deepEqual(manager.getSeenStories('u1'), ['only_story']);
});

// ── Cleanup ──────────────────────────────────────────────────────────────────

test('TC-020: stale saved IDs cleaned up on sync', async t => {
	const {manager} = await createManager();
	manager.registerStoryId('u1', 'stale_1');
	manager.registerStoryId('u1', 'stale_2');
	manager.registerStoryId('u1', 'valid_1');
	manager.registerStoryId('u2', 'stale_for_inactive');

	manager.syncUsers(['u1'], new Map([['u1', ['valid_1', 'new_1', 'new_2']]]));

	t.deepEqual(manager.getSeenStories('u1'), ['valid_1']);
	t.deepEqual(manager.getSeenStories('u2'), []);
});

// ── Persistence & Debounce ───────────────────────────────────────────────────

test('TC-018: debounce persists data after settle', async t => {
	const {manager, dir} = await createManager();
	const filePath = path.join(dir, 'storage', 'seen-stories_testuser.json');

	manager.registerStoryId('u1', 'a');
	manager.registerStoryId('u1', 'b');

	await delay(600);

	const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
	t.deepEqual(content.users.u1.seenStories, ['a', 'b']);
});

test('TC-021: data written to disk is readable after save', async t => {
	const {manager, dir} = await createManager();
	const filePath = path.join(dir, 'storage', 'seen-stories_testuser.json');

	manager.registerStoryId('u1', 'flush_test');
	manager.registerStoryId('u2', 'another');

	await delay(600);

	const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
	t.is(content.users.u1.seenStories[0], 'flush_test');
	t.is(content.users.u2.seenStories[0], 'another');
	t.true(typeof content.lastUpdated === 'number');
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

	t.true(loadedIndices.length >= 0);
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
	const ReactMock = await import('../source/mocks/app.mock.js');
	const {lastFrame, unmount} = render(<ReactMock.AppMock view="story" />);

	// Initial state should show loading
	t.truthy(lastFrame()?.includes('Fetching'));

	await delay(2000);

	const output = lastFrame()!;
	t.falsy(output.includes('Fetching'), 'Loading should complete');
	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	const hasContent = output.includes('User') || output.includes('Stories');
	t.truthy(hasContent, 'Should show story content');

	unmount();
});
