import test from 'ava';
import {mockClient} from '../source/mocks/index.js';

// ── Task 1: mockClient.postStory ──────────────────────────────────────────────

test('mockClient has postStory method', t => {
	t.is(typeof mockClient.postStory, 'function');
});

test('mockClient.postStory resolves for image file path', async t => {
	await t.notThrowsAsync(async () => mockClient.postStory('/fake/image.jpg'));
});

test('mockClient.postStory resolves with closeFriends option', async t => {
	await t.notThrowsAsync(async () =>
		mockClient.postStory('/fake/image.jpg', {closeFriends: true}),
	);
});
