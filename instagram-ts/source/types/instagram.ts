export type Reaction = {
	emoji: string;
	senderId: string;
};

export type Link = {
	url: string;
	text: string;
};

export type Message =
	| TextMessage
	| MediaMessage
	| LinkMessage
	| PlaceholderMessage;

type BaseMessage = {
	id: string;
	timestamp: Date;
	userId: string;
	username: string;
	isOutgoing: boolean;
	threadId: string;
	reactions?: Reaction[];
};

export type TextMessage = {
	itemType: 'text';
	text: string;
} & BaseMessage;

export type MediaMessage = {
	itemType: 'media';
	media: MessageMedia;
} & BaseMessage;

export type LinkMessage = {
	itemType: 'link';
	link: Link;
} & BaseMessage;

export type PlaceholderMessage = {
	itemType: 'placeholder';
	text: string;
} & BaseMessage;

export type MessageMedia = {
	id: string;
	media_type: number; // 1 for image, 2 for video
	image_versions2?: {
		candidates: MediaCandidate[];
	};
	video_versions?: MediaCandidate[];
	original_width: number;
	original_height: number;
};

export type Thread = {
	id: string;
	title: string;
	users: User[];
	lastMessage?: Message;
	lastActivity: Date;
	unread: boolean;
};

export type User = {
	pk: string;
	username: string;
	fullName: string;
	profilePicUrl?: string;
	isVerified: boolean;
};

export type ChatState = {
	currentThread?: Thread;
	threads: Thread[];
	messages: Message[];
	loading: boolean;
	error?: string;
	messageCursor?: string;
	selectedMessageIndex: number | undefined;
	isSelectionMode: boolean;
};

export type AuthState = {
	isLoggedIn: boolean;
	username?: string;
	userId?: string;
	loading: boolean;
	error?: string;
};

export type CarouselItem = {
	id: string;
	media_type: number;
	image_versions2?: {
		candidates: MediaCandidate[];
	};
	video_versions?: MediaCandidate[];
};

export type Post = {
	id: string;
	user: {
		pk: number;
		username: string;
		profilePicUrl?: string;
	};
	caption?: {
		text: string;
	};
	image_versions2?: {
		candidates: MediaCandidate[];
	};
	like_count: number;
	comment_count: number;
	taken_at: number;
	media_type: number;
	video_versions?: Array<{
		url: string;
		width: number;
		height: number;
	}>;
	carousel_media_count?: number;
	carousel_media?: CarouselItem[];
};

export type FeedInstance = {
	posts: Post[];
};

export type MediaCandidate = {
	url: string;
	width: number;
	height: number;
};
