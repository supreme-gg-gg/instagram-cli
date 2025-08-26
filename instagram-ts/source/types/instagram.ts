export type Message =
	| TextMessage
	| MediaMessage
	| ClipMessage
	| PlaceholderMessage;

interface BaseMessage {
	id: string;
	timestamp: Date;
	userId: string;
	username: string;
	isOutgoing: boolean;
	threadId: string;
}

export interface TextMessage extends BaseMessage {
	itemType: 'text';
	text: string;
}

export interface MediaMessage extends BaseMessage {
	itemType: 'media';
	media: MessageMedia;
}

export interface ClipMessage extends BaseMessage {
	itemType: 'clip';
	clip: any; // Define clip properties as needed
}

export interface PlaceholderMessage extends BaseMessage {
	itemType: 'placeholder';
	text: string;
}

export interface MessageMedia {
	id: string;
	user: {
		pk: number;
		username: string;
		profilePicUrl?: string;
	};
	image_versions2?: {
		candidates: {
			url: string;
			width: number;
			height: number;
		}[];
	};
	original_width: number;
	original_height: number;
}

export interface Thread {
	id: string;
	title: string;
	users: User[];
	lastMessage?: Message;
	lastActivity: Date;
	unread: boolean;
}

export interface User {
	pk: string;
	username: string;
	fullName: string;
	profilePicUrl?: string;
	isVerified: boolean;
}

export interface ChatState {
	currentThread?: Thread;
	threads: Thread[];
	messages: Message[];
	loading: boolean;
	error?: string;
	messageCursor?: string;
	visibleMessageOffset: number;
}

export interface AuthState {
	isLoggedIn: boolean;
	username?: string;
	userId?: string;
	loading: boolean;
	error?: string;
}

export interface CarouselItem {
	id: string;
	media_type: number;
	image_versions2?: {
		candidates: {url: string; width: number; height: number}[];
	};
	video_versions?: {url: string; width: number; height: number}[];
}

export interface Post {
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
		candidates: {
			url: string;
			width: number;
			height: number;
		}[];
	};
	like_count: number;
	comment_count: number;
	taken_at: number;
	media_type: number;
	video_versions?: {
		url: string;
		width: number;
		height: number;
	}[];
	carousel_media_count?: number;
	carousel_media?: CarouselItem[];
}

export interface FeedInstance {
	posts: Post[];
}
