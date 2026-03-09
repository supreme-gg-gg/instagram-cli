/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import test from 'ava';
import {MessageSyncMessageTypes} from 'instagram_mqtt';
import {
	parseMessageItem,
	getBestMediaUrl,
} from '../source/utils/message-parser.js';
import type {MessageMedia, TextMessage} from '../source/types/instagram.js';

const mockContext = {
	userCache: new Map<string, string>(),
	currentUserId: '1001',
};

test('parseMessageItem parses standard text message', t => {
	const rawMessage = {
		item_id: 'msg_123',
		user_id: 1002,
		timestamp: String(Date.now() * 1000), // Microseconds usually
		item_type: MessageSyncMessageTypes.Text,
		text: 'Hello world',
	};

	// We have to cast here to match the RealChatItem internal type
	const result = parseMessageItem(rawMessage as any, 'thread_1', mockContext);

	t.truthy(result);
	t.is(result?.id, 'msg_123');
	t.is(result?.itemType, 'text');
	t.is((result as TextMessage)?.text, 'Hello world');
	t.is(result?.isOutgoing, false);
});

test('parseMessageItem handles outgoing messages properly', t => {
	const rawMessage = {
		item_id: 'msg_124',
		user_id: 1001, // matches currentUserId
		timestamp: String(Date.now() * 1000),
		item_type: MessageSyncMessageTypes.Text,
		text: 'My outgoing message',
	};

	const result = parseMessageItem(rawMessage as any, 'thread_1', mockContext);

	t.truthy(result);
	t.is(result?.isOutgoing, true);
});

test('parseMessageItem skips items without item_id', t => {
	const rawMessage = {
		user_id: 1002,
		item_type: MessageSyncMessageTypes.Text,
		text: 'Invalid message',
	};

	const result = parseMessageItem(rawMessage as any, 'thread_1', mockContext);

	t.is(result, undefined);
});

test('getBestMediaUrl picks highest quality video', t => {
	const media: MessageMedia = {
		id: 'media_1',
		media_type: 2,
		original_width: 1920,
		original_height: 1080,
		video_versions: [
			{url: 'low.mp4', width: 320, height: 240, type: 104},
			{url: 'high.mp4', width: 1920, height: 1080, type: 103},
			{url: 'mid.mp4', width: 1280, height: 720, type: 103},
		] as any,
	};

	const best = getBestMediaUrl(media);

	t.truthy(best);
	t.is(best?.url, 'high.mp4');
	t.is(best?.type, 'video');
});

test('getBestMediaUrl picks highest quality image', t => {
	const media: MessageMedia = {
		id: 'media_2',
		media_type: 1,
		original_width: 1080,
		original_height: 1080,
		image_versions2: {
			candidates: [
				{url: 'low.jpg', width: 320, height: 240},
				{url: 'high.jpg', width: 1080, height: 1080},
			],
		},
	} as unknown as MessageMedia;

	const best = getBestMediaUrl(media);

	t.truthy(best);
	t.is(best?.url, 'high.jpg');
	t.is(best?.type, 'image');
});
