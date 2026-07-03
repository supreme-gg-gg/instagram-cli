import type {
	Thread,
	Message,
	User,
	Post,
	Reaction,
	Story,
} from '../types/instagram.js';

export const MOCK_USER_COUNT = 75;

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

const firstNames = [
	'Alice',
	'Bob',
	'Charlie',
	'Diana',
	'Eva',
	'Frank',
	'Grace',
	'Henry',
	'Isabella',
	'Jack',
	'Katie',
	'Liam',
	'Mia',
	'Noah',
	'Olivia',
	'Peter',
	'Quinn',
	'Rachel',
	'Sam',
	'Tina',
	'Uma',
	'Victor',
	'Wendy',
	'Xander',
	'Yara',
	'Zack',
	'Aria',
	'Ben',
	'Clara',
	'David',
	'Ella',
	'Finn',
	'Gemma',
	'Hugo',
	'Ivy',
	'Jake',
	'Kira',
	'Leo',
	'Nora',
	'Oscar',
	'Paige',
	'Riley',
	'Sage',
	'Theo',
	'Violet',
	'Wade',
	'Zoe',
	'Adam',
	'Bella',
	'Carter',
	'Daisy',
	'Ethan',
	'Faith',
	'Gavin',
	'Hannah',
	'Ian',
	'Jade',
	'Kai',
	'Luna',
	'Miles',
	'Natalie',
	'Owen',
	'Phoebe',
	'Quincy',
	'Rose',
	'Silas',
	'Tessa',
	'Uri',
	'Vera',
	'Wyatt',
	'Xena',
	'Yves',
	'Zara',
	'Aiden',
	'Brooke',
];

const lastNames = [
	'Smith',
	'Johnson',
	'Brown',
	'Prince',
	'Martinez',
	'Lee',
	'Kim',
	'Chen',
	'Torres',
	'Wilson',
	'Nguyen',
	'Patel',
	'Anderson',
	'Thomas',
	'White',
	'Jackson',
	'Harris',
	'Garcia',
	'Clark',
	'Robinson',
	'Lewis',
	'Walker',
	'Hall',
	'Allen',
	'Scott',
	'Taylor',
	'Moore',
	'Davis',
	'Miller',
	'Wilson',
	'Young',
	'King',
	'Wright',
	'Hill',
	'Green',
	'Adams',
	'Baker',
	'Nelson',
	'Carter',
	'Mitchell',
	'Roberts',
	'Turner',
	'Phillips',
	'Campbell',
	'Parker',
	'Evans',
	'Edwards',
	'Collins',
	'Stewart',
	'Morris',
	'Murphy',
	'Cook',
	'Rogers',
	'Morgan',
	'Peterson',
	'Cooper',
	'Reed',
	'Bailey',
	'Bell',
	'Howard',
	'Ward',
	'Brooks',
	'Kelly',
	'Sanders',
	'Price',
	'Bennett',
	'Wood',
	'Barnes',
	'Ross',
	'Henderson',
	'Coleman',
	'Jenkins',
	'Perry',
	'Powell',
	'Long',
];

const imageUrls = [
	'https://sipi.usc.edu/database/preview/misc/4.1.01.png',
	'https://sipi.usc.edu/database/preview/misc/4.1.02.png',
	'https://www.math.hkust.edu.hk/~masyleung/Teaching/CAS/MATLAB/image/images/cameraman.jpg',
	'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Lenna_%28test_image%29.png/500px-Lenna_%28test_image%29.png',
];

const captions = [
	'Beautiful sunset today! 🌅 #nature #photography',
	'Working on some code today 💻 #coding #typescript',
	'Great coffee this morning ☕',
	'Morning yoga session 🧘‍♀️ #wellness #mindfulness',
	'New recipe alert! Homemade pasta 🍝 #cooking #foodie',
	'Hiked 12 miles today! 🏔️ #adventure #hiking',
	'Just launched my new project! 🚀 #startup #tech',
	'Weekend barbecue with the fam 🥩🔥 #family #weekend',
	'Art exhibition opening night! 🎨 #art #culture',
	'Fresh catch of the day 🎣 #fishing #outdoors',
	'Book club meeting was amazing! 📚 #reading #books',
	'Guitar practice paying off 🎸 #music #guitar',
	'Adopted a new puppy! Meet Max 🐶 #dogsofinstagram #puppy',
	'Sunrise surf session 🌊🏄 #surfing #ocean',
	'Baking sourdough from scratch 🥖 #baking #homemade',
	'Film set behind the scenes 🎬 #filmmaking #director',
	'Farmers market finds! 🥕🌽 #organic #localfood',
	'Finished my first marathon! 🏃‍♀️🎉 #marathon #fitness',
	'Stargazing night ✨🌌 #astronomy #night',
	'Jazz night at the Blue Note 🎷🎵 #jazz #music',
	'Pottery class creations 🏺 #art #ceramics',
	'Road trip across the country 🚗🛣️ #roadtrip #travel',
	'Community garden volunteer day 🌻 #community #gardening',
	'Chess tournament champion! ♟️🏆 #chess #strategy',
	'sunset from the rooftop 🌇 #cityviews #sunset',
	'Beach day with friends 🏖️ #summer #fun',
	'New painting finished! 🖼️ #art #painting',
	'Gardening update - look at these tomatoes! 🍅 #garden',
	'Live concert tonight! 🎤 #concert #music',
	'Snowy mountain views 🏔️❄️ #winter #travel',
];

export const mockEmojis = [
	'❤️',
	'😍',
	'😂',
	'😮',
	'😢',
	'😡',
	'👍',
	'👎',
	'🔥',
	'💯',
	'🎉',
	'✨',
	'🙏',
	'💪',
	'👌',
	'📸',
	'📅',
	'✅',
	'🤔',
	'😊',
	'🥳',
	'🎊',
	'💕',
	'🌟',
];

function buildUser(index: number): User {
	const first = firstNames[index]!;
	const last = lastNames[index]!;
	return {
		pk: `user${index + 1}`,
		username: `${first.toLowerCase()}_${last.toLowerCase()}`,
		fullName: `${first} ${last}`,
		isVerified: index % 5 === 1,
		profilePicUrl:
			index % 4 === 0 ? undefined : imageUrls[index % imageUrls.length],
	};
}

function buildPost(index: number): Post {
	const first = firstNames[index]!;
	const last = lastNames[index]!;
	const username = `${first.toLowerCase()}_${last.toLowerCase()}`;
	const userPk = 1001 + index;
	const imgUrl = imageUrls[index % imageUrls.length]!;
	const hoursAgo = (index + 1) * 2;

	return {
		id: String(100_000_000_000 + index),
		user: {
			pk: userPk,
			username,
			profilePicUrl: index % 3 === 0 ? undefined : imgUrl,
		},
		caption: {text: captions[index % captions.length]!},
		image_versions2: {
			candidates: [{url: imgUrl, width: STORY_WIDTH, height: STORY_HEIGHT}],
		},
		like_count: 50 + Math.floor(Math.random() * 900),
		comment_count: 3 + Math.floor(Math.random() * 60),
		taken_at: Date.now() - 60_000 * 60 * hoursAgo,
		media_type: 1,
	};
}

function buildStory(index: number): Story[] {
	const first = firstNames[index]!;
	const last = lastNames[index]!;
	const username = `${first.toLowerCase()}_${last.toLowerCase()}`;
	const userPk = 1001 + index;
	const imgUrl = imageUrls[index % imageUrls.length]!;

	const stories: Story[] = [
		{
			id: `story${index + 1}`,
			user: {pk: userPk, username, profilePicUrl: imgUrl},
			image_versions2: {
				candidates: [{url: imgUrl, width: STORY_WIDTH, height: STORY_HEIGHT}],
			},
			taken_at: Date.now(),
			media_type: 1,
		},
	];

	if (index % 3 === 0) {
		stories.push({
			id: `story${index + 1}b`,
			user: {pk: userPk, username, profilePicUrl: imgUrl},
			image_versions2: {
				candidates: [{url: imgUrl, width: STORY_WIDTH, height: STORY_HEIGHT}],
			},
			taken_at: Date.now(),
			media_type: 1,
		});
	}

	if (index % 5 === 0 && index + 1 < firstNames.length) {
		const mentionIdx = (index + 3) % firstNames.length;
		const mFirst = firstNames[mentionIdx]!;
		const mLast = lastNames[mentionIdx]!;
		const mentionImg = imageUrls[mentionIdx % imageUrls.length]!;

		stories[0]!.reel_mentions = [
			{
				user: {
					username: `${mFirst.toLowerCase()}_${mLast.toLowerCase()}`,
					pk: 1001 + mentionIdx,
					full_name: `${mFirst} ${mLast}`,
					profile_pic_url: mentionImg,
				},
			},
		];
	}

	return stories;
}

// Core User List (first 4 hardcoded references for threads/messages)
export const mockUsers: User[] = Array.from({length: MOCK_USER_COUNT}, (_, i) =>
	buildUser(i),
);

// Core Posts & Feed List
export const mockPosts: Post[] = Array.from({length: MOCK_USER_COUNT}, (_, i) =>
	buildPost(i),
);

export const mockFeed = {
	posts: mockPosts,
};

// Core Stories List
export const mockStories: Story[] = Array.from(
	{length: MOCK_USER_COUNT},
	(_, i) => i,
).flatMap(i => buildStory(i));

// Static Messaging Mock Dataset
export const mockMessages: Message[] = [
	{
		id: 'msg1',
		timestamp: new Date(Date.now() - 60_000 * 5),
		userId: 'user1',
		username: 'alice_smith',
		isOutgoing: true,
		threadId: 'thread1',
		itemType: 'text',
		text: 'Hey, are you free tonight?',
		reactions: [
			{emoji: '👍', senderId: 'user2'},
			{emoji: '😊', senderId: 'user2'},
		],
		repliedTo: {
			id: 'msg2',
			userId: 'user2',
			username: 'bob_johnson',
			text: 'I might be, what do you have in mind?',
			itemType: 'text',
		},
	},
	{
		id: 'msg2',
		timestamp: new Date(Date.now() - 60_000 * 10),
		userId: 'user2',
		username: 'bob_johnson',
		isOutgoing: false,
		threadId: 'thread1',
		itemType: 'text',
		text: 'I might be, what do you have in mind?',
		reactions: [{emoji: '🤔', senderId: 'user1'}],
	},
	{
		id: 'msg3',
		timestamp: new Date(Date.now() - 60_000 * 15),
		userId: 'user1',
		username: 'alice_smith',
		isOutgoing: true,
		threadId: 'thread1',
		itemType: 'media',
		media: {
			id: 'media1',
			media_type: 1,
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
		reactions: [
			{emoji: '🔥', senderId: 'user2'},
			{emoji: '💯', senderId: 'user3'},
			{emoji: '❤️', senderId: 'user4'},
		],
	},
	{
		id: 'msg4',
		timestamp: new Date(Date.now() - 60_000 * 20),
		userId: 'user2',
		username: 'bob_johnson',
		isOutgoing: false,
		threadId: 'thread1',
		itemType: 'media',
		media: {
			id: 'media2',
			media_type: 1,
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
		reactions: [
			{emoji: '📸', senderId: 'user1'},
			{emoji: '👌', senderId: 'user1'},
		],
	},
	{
		id: 'msg5',
		timestamp: new Date(Date.now() - 60_000 * 25),
		userId: 'user1',
		username: 'alice_smith',
		isOutgoing: true,
		threadId: 'thread1',
		itemType: 'media',
		media: {
			id: 'media3',
			media_type: 1,
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
	{
		id: 'msg8',
		timestamp: new Date(Date.now() - 60_000 * 3),
		userId: 'user2',
		username: 'bob_johnson',
		isOutgoing: false,
		threadId: 'thread1',
		itemType: 'link',
		link: {
			text: 'Interesting read about privacy',
			url: 'https://example.com/privacy',
		},
	},
	{
		id: 'msg9',
		timestamp: new Date(Date.now() - 60_000 * 2),
		userId: 'user2',
		username: 'bob_johnson',
		isOutgoing: false,
		threadId: 'thread1',
		itemType: 'media_share',
		mediaSharePost: {
			id: 'shared_post_1',
			user: {
				pk: 12_345,
				username: 'nature_photographer',
				profilePicUrl: 'https://example.com/profile.jpg',
			},
			caption: {
				text: 'sample caption 1',
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
			like_count: 15_234,
			comment_count: 342,
			taken_at: Math.floor(Date.now() / 1000) - 86_400,
			media_type: 1,
		},
	},
	{
		id: 'msg10',
		timestamp: new Date(Date.now() - 60_000 * 1),
		userId: 'user1',
		username: 'alice_smith',
		isOutgoing: true,
		threadId: 'thread1',
		itemType: 'media_share',
		mediaSharePost: {
			id: 'shared_post_2',
			user: {
				pk: 67_890,
				username: 'tech_news',
				profilePicUrl: 'https://example.com/tech_profile.jpg',
			},
			caption: {
				text: 'sample caption 2',
			},
			image_versions2: {
				candidates: [
					{
						url: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Lenna_%28test_image%29.png/500px-Lenna_%28test_image%29.png',
						width: 1200,
						height: 800,
					},
				],
			},
			like_count: 89_432,
			comment_count: 2345,
			taken_at: Math.floor(Date.now() / 1000) - 43_200,
			media_type: 1,
		},
	},
	// Last entry needs to be text for testing convenience
	{
		id: 'msg11',
		timestamp: new Date(),
		userId: 'user1',
		username: 'alice_smith',
		isOutgoing: true,
		threadId: 'thread1',
		itemType: 'text',
		text: 'Hey, are you free tonight?',
	},
];

// Core Thread Mock Dataset
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
		lastActivity: new Date(Date.now() - 60_000 * 120),
		lastMessage: {
			id: 'msg6',
			timestamp: new Date(Date.now() - 60_000 * 120),
			userId: 'user3',
			username: 'charlie_brown',
			isOutgoing: false,
			threadId: 'thread2',
			itemType: 'text',
			text: 'Thanks for the help earlier!',
			reactions: [
				{emoji: '🙏', senderId: 'user1'},
				{emoji: '💪', senderId: 'user1'},
			],
		},
	},
	{
		id: 'thread3',
		title: 'Diana Prince',
		users: [mockUsers[3]!],
		unread: true,
		lastActivity: new Date(Date.now() - 60_000 * 30),
		lastMessage: {
			id: 'msg7',
			timestamp: new Date(Date.now() - 60_000 * 30),
			userId: 'user4',
			username: 'diana_prince',
			isOutgoing: false,
			threadId: 'thread3',
			itemType: 'text',
			text: 'Can we schedule a meeting for tomorrow?',
			reactions: [
				{emoji: '📅', senderId: 'user1'},
				{emoji: '✅', senderId: 'user1'},
			],
		},
	},
];

export function generateReactions(
	senderIds: string[],
	emojiCount = 1,
): Reaction[] {
	const reactions: Reaction[] = [];
	const shuffledEmojis = [...mockEmojis].sort(() => Math.random() - 0.5);

	for (
		let i = 0;
		i < Math.min(emojiCount, senderIds.length, shuffledEmojis.length);
		i++
	) {
		reactions.push({
			emoji: shuffledEmojis[i]!,
			senderId: senderIds[i]!,
		});
	}

	return reactions;
}

export function generateMessage(
	id: string,
	threadId: string,
	userId: string,
	username: string,
	text: string,
	isOutgoing = false,
	minutesAgo = 0,
	reactions?: Reaction[],
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
		...(reactions && reactions.length > 0 && {reactions}),
	};
}

export function generateThreads(count: number): Thread[] {
	const threads: Thread[] = [];
	for (let i = 0; i < count; i += mockThreads.length) {
		threads.push(
			...mockThreads.map(thread => ({
				...thread,
				id: `${thread.id}_copy_${i / mockThreads.length}`,
				title: `${thread.title} ${i / mockThreads.length + 1}`,
			})),
		);
	}

	return threads.slice(0, count);
}
