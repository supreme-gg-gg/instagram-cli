/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import React from 'react';
import test from 'ava';
import {render} from 'ink-testing-library';
import {Text} from 'ink';
import {useFeed} from '../source/ui/hooks/use-feed.js';
import FeedView from '../source/ui/views/feed-view.js';
import type {InstagramClient} from '../source/client.js';
import type {Post} from '../source/types/instagram.js';
import {mockPosts} from '../source/mocks/mock-data.js';

const delay = async (ms: number): Promise<void> => {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
};

// Ink renders asynchronously, so poll for the expected state instead of
// relying on a fixed delay.
const waitFor = async (condition: () => boolean, timeout = 8000) => {
	const start = Date.now();
	while (!condition()) {
		if (Date.now() - start > timeout) {
			throw new Error('Timed out waiting for condition');
		}

		// eslint-disable-next-line no-await-in-loop
		await delay(20);
	}
};

/**
 * Fake client that serves `pages` one after another and records each
 * `getTimelinePosts` call's `loadMore` argument. An `Error` entry makes that
 * request fail.
 */
function createPagedClient(pages: Array<Post[] | Error>) {
	const calls: boolean[] = [];
	let page = 0;
	const client = {
		async getTimelinePosts(loadMore = false) {
			calls.push(loadMore);
			if (!loadMore) page = 0;
			const entry = pages[page] ?? [];
			page += 1;
			await delay(10);
			if (entry instanceof Error) throw entry;
			return {posts: entry, hasMore: page < pages.length};
		},
	} as unknown as InstagramClient;

	const useClient = () => ({client, isLoading: false, error: undefined});
	return {calls, useClient};
}

type FeedHook = ReturnType<typeof useFeed>;

function FeedProbe({
	useClient,
	onRender,
}: {
	readonly useClient: Parameters<typeof useFeed>[1];
	readonly onRender: (feed: FeedHook) => void;
}) {
	const feed = useFeed(undefined, useClient);
	onRender(feed);
	return <Text>{feed.posts.map(post => post.user.username).join(',')}</Text>;
}

const page1 = mockPosts.slice(0, 2);
const page2 = mockPosts.slice(2, 4);

test('useFeed loads the first page, then appends the next page', async t => {
	const {calls, useClient} = createPagedClient([page1, page2]);
	let latest: FeedHook | undefined;
	const {lastFrame, unmount} = render(
		<FeedProbe
			useClient={useClient}
			onRender={feed => {
				latest = feed;
			}}
		/>,
	);
	t.teardown(unmount);

	await waitFor(() => latest?.posts.length === 2);
	t.true(latest?.hasMore);

	await latest?.loadMorePosts();
	await waitFor(() => latest?.posts.length === 4);

	t.false(latest?.hasMore);
	await waitFor(() => lastFrame()!.includes(page2[1]!.user.username));
	t.deepEqual(calls, [false, true]);
});

test('useFeed ignores overlapping and exhausted loadMore calls', async t => {
	const {calls, useClient} = createPagedClient([page1, page2]);
	let latest: FeedHook | undefined;
	const {unmount} = render(
		<FeedProbe
			useClient={useClient}
			onRender={feed => {
				latest = feed;
			}}
		/>,
	);
	t.teardown(unmount);

	await waitFor(() => latest?.posts.length === 2);
	const loadMore = latest!.loadMorePosts;
	await Promise.all([loadMore(), loadMore(), loadMore()]);
	await waitFor(() => latest?.hasMore === false);

	// No more pages: this call must not reach the client
	await latest?.loadMorePosts();

	t.deepEqual(calls, [false, true]);
	t.is(latest?.posts.length, 4);
});

test('feed view asks for more posts when the selection nears the end', async t => {
	t.timeout(30_000);
	let endReachedCount = 0;
	const {lastFrame, stdin, unmount} = render(
		<FeedView
			feed={{posts: mockPosts.slice(0, 6)}}
			onEndReached={() => {
				endReachedCount += 1;
			}}
		/>,
	);
	t.teardown(unmount);

	await waitFor(() => lastFrame()!.includes('📜 Feed'));
	// Ink attaches its input listener after the first render
	await waitFor(() => stdin.listenerCount('readable') > 0);
	t.is(endReachedCount, 0, 'not triggered while far from the end');

	const pressDown = async (expectedUsername: string) => {
		stdin.write('j');
		await waitFor(() => lastFrame()!.includes(`➜ ${expectedUsername}`));
	};

	// 2nd and 3rd posts are still 3 or more from the end of 6
	await pressDown(mockPosts[1]!.user.username);
	await pressDown(mockPosts[2]!.user.username);
	t.is(endReachedCount, 0);

	// 4th post is within the last 3
	await pressDown(mockPosts[3]!.user.username);
	await waitFor(() => endReachedCount > 0);
	t.true(endReachedCount > 0);
});

test('feed view shows a hint while more posts are loading', async t => {
	const {lastFrame, unmount} = render(
		<FeedView isLoadingMore feed={{posts: mockPosts.slice(0, 6)}} />,
	);
	t.teardown(unmount);

	await waitFor(() => lastFrame()!.includes('📜 Feed'));
	t.true(lastFrame()!.includes('Loading more posts'));
});

test('a failed load-more is reported and only retried on request', async t => {
	const {calls, useClient} = createPagedClient([
		page1,
		new Error('network down'),
		page2,
	]);
	let latest: FeedHook | undefined;
	const {unmount} = render(
		<FeedProbe
			useClient={useClient}
			onRender={feed => {
				latest = feed;
			}}
		/>,
	);
	t.teardown(unmount);

	await waitFor(() => latest?.posts.length === 2);
	await latest?.loadMorePosts();
	await waitFor(() => latest?.loadMoreError === 'network down');

	// Scrolling again must not hammer a failing endpoint
	await latest?.loadMorePosts();
	t.deepEqual(calls, [false, true]);

	await latest?.retryLoadMore();
	await waitFor(() => latest?.posts.length === 4);
	t.is(latest?.loadMoreError, undefined);
	t.deepEqual(calls, [false, true, true]);
});

test('a page with no new posts ends the feed instead of stalling', async t => {
	const {useClient} = createPagedClient([page1, page1, page2]);
	let latest: FeedHook | undefined;
	const {unmount} = render(
		<FeedProbe
			useClient={useClient}
			onRender={feed => {
				latest = feed;
			}}
		/>,
	);
	t.teardown(unmount);

	await waitFor(() => latest?.posts.length === 2);
	await latest?.loadMorePosts();
	await waitFor(() => latest?.hasMore === false);
	t.is(latest?.posts.length, 2);
});

test('feed view shows the load-more error and retries with r', async t => {
	let retries = 0;
	const {lastFrame, stdin, unmount} = render(
		<FeedView
			feed={{posts: mockPosts.slice(0, 6)}}
			loadMoreError="network down"
			onRetryLoadMore={() => {
				retries += 1;
			}}
		/>,
	);
	t.teardown(unmount);

	await waitFor(() => lastFrame()!.includes("Couldn't load more posts"));
	await waitFor(() => stdin.listenerCount('readable') > 0);
	stdin.write('r');
	await waitFor(() => retries === 1);
	t.is(retries, 1);
});

test('carousel position survives re-renders while more posts load', async t => {
	t.timeout(30_000);
	const [first, second, third] = mockPosts;
	const carouselPost = {...first!, carousel_media: [first!, second!, third!]};
	const posts = [carouselPost, ...mockPosts.slice(1, 4)];
	const {lastFrame, stdin, rerender, unmount} = render(
		<FeedView feed={{posts}} />,
	);
	t.teardown(unmount);

	await waitFor(() => lastFrame()!.includes(' 1/ 3'));
	await waitFor(() => stdin.listenerCount('readable') > 0);
	stdin.write('l');
	await waitFor(() => lastFrame()!.includes(' 2/ 3'));

	// Loading starts, then a page is appended: the same post stays selected
	rerender(<FeedView isLoadingMore feed={{posts}} />);
	await waitFor(() => lastFrame()!.includes('Loading more posts'));
	rerender(<FeedView feed={{posts: [...posts, ...mockPosts.slice(4, 6)]}} />);
	await waitFor(() => !lastFrame()!.includes('Loading more posts'));

	t.true(lastFrame()!.includes(' 2/ 3'));
});
