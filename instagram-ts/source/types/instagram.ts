export interface Message {
	id: string;
	text: string;
	timestamp: Date;
	userId: string;
	username: string;
	isOutgoing: boolean;
	threadId: string;
}

export interface Thread {
	id: string;
	title: string;
	users: User[];
	lastMessage?: Message;
	lastActivity: Date;
	unreadCount: number;
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
	ascii_image?: string;
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
	ascii_image?: string;
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
	ascii_carousel_media?: string[];
}

export interface FeedInstance {
	posts: Post[];
}
