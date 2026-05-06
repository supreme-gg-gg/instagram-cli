export type Reaction = {
	emoji: string;
	senderId: string;
};

export type ReactionEvent = {
	threadId: string;
	itemId: string;
	userId: string;
	emoji: string;
	timestamp: Date;
};

export type SeenEvent = {
	threadId: string;
	userId: string;
	itemId: string;
	timestamp: Date;
};

export type Link = {
	url: string;
	text: string;
};

// IMPORTANT: This field is neglected by both the API and MQTT, but apparently exists on both!
export type RepliedToMessage = {
	id: string;
	userId: string;
	username: string;
	text?: string;
	itemType: string;
};

export type Message =
	| TextMessage
	| MediaMessage
	| LinkMessage
	| PlaceholderMessage
	| MediaShareMessage;

type BaseMessage = {
	id: string;
	timestamp: Date;
	userId: string;
	username: string;
	isOutgoing: boolean;
	threadId: string;
	reactions?: Reaction[];
	repliedTo?: RepliedToMessage;
	item_id?: string;
	client_context?: string;
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

export type MediaShareMessage = {
	itemType: 'media_share';
	mediaSharePost: Post;
	mediaShareIndex?: number;
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

export type ProfileInfo = {
	pk: string;
	username: string;
	fullName: string;
	profilePicUrl?: string;
	isVerified: boolean;
	isPrivate: boolean;
	biography: string;
	followerCount: number;
	followingCount: number;
	mediaCount: number;
	externalUrl?: string;
};

export type ChatState = {
	currentThread?: Thread;
	threads: Thread[];
	messages: Message[];
	loading: boolean;
	loadingMoreThreads?: boolean;
	error?: string;
	messageCursor?: string;
	hasMoreThreads?: boolean;
	selectedMessageIndex: number | undefined;
	isSelectionMode: boolean;
	recipientAlreadyRead: boolean;
};

export type AuthState = {
	isLoggedIn: boolean;
	username?: string;
	userId?: string;
	loading: boolean;
	error?: string;
};

export type BaseMedia = {
	id: string;
	media_type: number;
	image_versions2?: {
		candidates: MediaCandidate[];
	};
	video_versions?: MediaCandidate[];
};

export type MediaItemMetadata = {
	user: {
		pk: number;
		username: string;
		profilePicUrl?: string;
	};
	taken_at: number;
};

export type ListMediaItem<
	T extends BaseMedia & MediaItemMetadata = BaseMedia & MediaItemMetadata,
	M = undefined,
> = {
	pk: number;
	content: T[];
	additional_metadata?: M;
};

export type CarouselItem = BaseMedia & MediaItemMetadata;

export type PostMetadata = {
	caption?: {
		text: string;
	};
	like_count: number;
	comment_count: number;
	carousel_media_count?: number;
};

export type Story = BaseMedia &
	MediaItemMetadata & {
		reel_mentions?: ReelMention[];
	};

export type ReelMention = {
	user: {
		pk: number;
		username: string;
		full_name: string;
		profile_pic_url: string;
	};
};

export type Post = BaseMedia &
	MediaItemMetadata &
	PostMetadata & {
		carousel_media?: CarouselItem[];
	};

export type MediaCandidate = {
	url: string;
	width: number;
	height: number;
};
