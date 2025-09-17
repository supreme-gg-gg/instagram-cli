import type {
	Thread,
	Message,
	User,
	Post,
	FeedInstance,
} from '../types/instagram.js';

// Mock users
export const mockUsers: User[] = [
	{
		pk: 'user1',
		username: 'alice_smith',
		fullName: 'Alice Smith',
		isVerified: false,
	},
	{
		pk: 'user2',
		username: 'bob_johnson',
		fullName: 'Bob Johnson',
		isVerified: true,
	},
	{
		pk: 'user3',
		username: 'charlie_brown',
		fullName: 'Charlie Brown',
		isVerified: false,
	},
	{
		pk: 'user4',
		username: 'diana_prince',
		fullName: 'Diana Prince',
		isVerified: true,
	},
];

// Mock posts for feed
export const mockPosts: Post[] = [
	{
		id: 'post1',
		user: {
			pk: 1001,
			username: 'alice_smith',
			profilePicUrl: 'https://sipi.usc.edu/database/preview/misc/4.1.01.png',
		},
		caption: {
			text: 'Beautiful sunset today! 🌅 #nature #photography',
		},
		image_versions2: {
			candidates: [
				{
					url: 'https://sipi.usc.edu/database/preview/misc/4.1.01.png',
					width: 1080,
					height: 1080,
				},
			],
		},
		like_count: 245,
		comment_count: 12,
		taken_at: Date.now() - 60_000 * 60 * 2, // 2 hours ago
		media_type: 1, // Image
	},
	{
		id: 'post2',
		user: {
			pk: 1002,
			username: 'bob_johnson',
			profilePicUrl:
				'https://www.math.hkust.edu.hk/~masyleung/Teaching/CAS/MATLAB/image/images/cameraman.jpg',
		},
		caption: {
			text: 'Working on some code today 💻 #coding #typescript',
		},
		image_versions2: {
			candidates: [
				{
					url: 'https://www.math.hkust.edu.hk/~masyleung/Teaching/CAS/MATLAB/image/images/cameraman.jpg',
					width: 512,
					height: 512,
				},
			],
		},
		like_count: 89,
		comment_count: 5,
		taken_at: Date.now() - 60_000 * 60 * 4, // 4 hours ago
		media_type: 1, // Image
	},
	{
		id: 'post3',
		user: {
			pk: 1003,
			username: 'charlie_brown',
		},
		caption: {
			text: 'Great coffee this morning ☕',
		},
		image_versions2: {
			candidates: [
				{
					url: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Lenna_%28test_image%29.png/500px-Lenna_%28test_image%29.png',
					width: 500,
					height: 500,
				},
			],
		},
		like_count: 156,
		comment_count: 8,
		taken_at: Date.now() - 60_000 * 60 * 6, // 6 hours ago
		media_type: 1, // Image
	},
];

// Mock feed instance
export const mockFeed: FeedInstance = {
	posts: mockPosts,
};

// Mock messages
export const mockMessages: Message[] = [
	{
		id: 'msg1',
		timestamp: new Date(Date.now() - 60_000 * 5), // 5 minutes ago
		userId: 'user1',
		username: 'alice_smith',
		isOutgoing: true,
		threadId: 'thread1',
		itemType: 'text',
		text: 'Hey, are you free tonight?',
	},
	{
		id: 'msg2',
		timestamp: new Date(Date.now() - 60_000 * 10), // 10 minutes ago
		userId: 'user2',
		username: 'bob_johnson',
		isOutgoing: false,
		threadId: 'thread1',
		itemType: 'text',
		text: 'I might be, what do you have in mind?',
	},
	{
		id: 'msg3',
		timestamp: new Date(Date.now() - 60_000 * 15), // 15 minutes ago
		userId: 'user1',
		username: 'alice_smith',
		isOutgoing: true,
		threadId: 'thread1',
		itemType: 'media',
		media: {
			id: 'media1',
			user: {
				pk: 1001,
				username: 'alice_smith',
			},
			image_versions2: {
				candidates: [
					{
						url: 'https://sipi.usc.edu/database/preview/misc/4.1.01.png',
						width: 512,
						height: 512,
					},
				],
			},
			original_width: 512,
			original_height: 512,
		},
	},
	{
		id: 'msg4',
		timestamp: new Date(Date.now() - 60_000 * 20), // 20 minutes ago
		userId: 'user2',
		username: 'bob_johnson',
		isOutgoing: false,
		threadId: 'thread1',
		itemType: 'media',
		media: {
			id: 'media2',
			user: {
				pk: 1002,
				username: 'bob_johnson',
			},
			image_versions2: {
				candidates: [
					{
						url: 'https://www.math.hkust.edu.hk/~masyleung/Teaching/CAS/MATLAB/image/images/cameraman.jpg',
						width: 256,
						height: 256,
					},
				],
			},
			original_width: 256,
			original_height: 256,
		},
	},
	{
		id: 'msg5',
		timestamp: new Date(Date.now() - 60_000 * 25), // 25 minutes ago
		userId: 'user1',
		username: 'alice_smith',
		isOutgoing: true,
		threadId: 'thread1',
		itemType: 'media',
		media: {
			id: 'media3',
			user: {
				pk: 1001,
				username: 'alice_smith',
			},
			image_versions2: {
				candidates: [
					{
						url: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Lenna_%28test_image%29.png/500px-Lenna_%28test_image%29.png',
						width: 500,
						height: 500,
					},
				],
			},
			original_width: 500,
			original_height: 500,
		},
	},
];

// Mock threads
export const mockThreads: Thread[] = [
	{
		id: 'thread1',
		title: 'Alice Smith',
		users: [mockUsers[0]!, mockUsers[1]!],
		unread: true,
		lastActivity: new Date(Date.now() - 60_000 * 5),
		lastMessage: mockMessages[0],
	},
	{
		id: 'thread2',
		title: 'Charlie Brown',
		users: [mockUsers[2]!],
		unread: false,
		lastActivity: new Date(Date.now() - 60_000 * 120), // 2 hours ago
		lastMessage: {
			id: 'msg6',
			timestamp: new Date(Date.now() - 60_000 * 120),
			userId: 'user3',
			username: 'charlie_brown',
			isOutgoing: false,
			threadId: 'thread2',
			itemType: 'text',
			text: 'Thanks for the help earlier!',
		},
	},
	{
		id: 'thread3',
		title: 'Diana Prince',
		users: [mockUsers[3]!],
		unread: true,
		lastActivity: new Date(Date.now() - 60_000 * 30), // 30 minutes ago
		lastMessage: {
			id: 'msg7',
			timestamp: new Date(Date.now() - 60_000 * 30),
			userId: 'user4',
			username: 'diana_prince',
			isOutgoing: false,
			threadId: 'thread3',
			itemType: 'text',
			text: 'Can we schedule a meeting for tomorrow?',
		},
	},
];

// Helper functions to generate more data
export function generateMessage(
	id: string,
	threadId: string,
	userId: string,
	username: string,
	text: string,
	isOutgoing = false,
	minutesAgo = 0,
): Message {
	return {
		id,
		timestamp: new Date(Date.now() - 60_000 * minutesAgo),
		userId,
		username,
		isOutgoing,
		threadId,
		itemType: 'text',
		text,
	};
}

export function generateThread(
	id: string,
	title: string,
	users: User[],
	unread = false,
	hoursAgo = 0,
): Thread {
	const lastMessage = generateMessage(
		`${id}_last`,
		id,
		users[0]?.pk ?? 'unknown',
		users[0]?.username ?? 'unknown',
		'Last message in this thread',
		false,
		hoursAgo * 60,
	);

	return {
		id,
		title,
		users,
		unread,
		lastActivity: new Date(Date.now() - 60_000 * 60 * hoursAgo),
		lastMessage,
	};
}
