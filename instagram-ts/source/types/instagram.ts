export interface Message {
	id: string;
	text?: string;
	media?: MessageMedia;
	timestamp: Date;
	itemType: string; // e.g., 'text', 'media', 'clip'
	userId: string;
	username: string;
	isOutgoing: boolean;
	threadId: string;
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

export interface FeedItem {
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
	imageUrl?: string;
	videoUrl?: string;
	like_count: number;
	comment_count: number;
	taken_at: number;
}
