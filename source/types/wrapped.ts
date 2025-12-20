/**
 * Types and interfaces for Instagram Wrapped analytics feature.
 * These types define the structure of aggregated user activity data
 * collected over a calendar year.
 */

import type {User} from './instagram.js';

// ============================================================================
// Core Wrapped Stats
// ============================================================================

/**
 * Complete wrapped statistics for a user's Instagram activity over a year.
 */
export type WrappedStats = {
	/** The year these statistics cover */
	year: number;
	/** Timestamp when data collection completed */
	collectedAt: Date;
	/** Current user information */
	user: User;
	/** Direct messaging statistics */
	messaging: MessagingStats;
	/** Social/follower statistics */
	social: SocialStats;
	/** User's own media/post statistics */
	media: MediaStats;
	/** Feed interaction statistics (likes, etc.) */
	feed: FeedStats;
};

// ============================================================================
// Messaging Stats
// ============================================================================

/**
 * Statistics about the user's direct messaging activity.
 */
export type MessagingStats = {
	/** Total messages sent by the user */
	totalMessagesSent: number;
	/** Total messages received by the user */
	totalMessagesReceived: number;
	/** Daily message frequency for heatmap visualization (ISO date string -> counts) */
	messageFrequency: Record<string, DailyMessageCount>;
	/** Top chat partners ranked by message count */
	topChatPartners: ChatPartnerStats[];
	/** Longest continuous chat session */
	longestChatSession: ChatSession | undefined;
	/** Number of reels shared by the user in DMs */
	reelsSent: number;
	/** Number of reels received by the user in DMs */
	reelsReceived: number;
	/** Total number of threads the user participated in */
	totalThreads: number;
	/** Number of threads with activity this year */
	activeThreads: number;
};

/**
 * Message counts for a single day.
 */
export type DailyMessageCount = {
	sent: number;
	received: number;
};

/**
 * Statistics about chat activity with a specific partner.
 */
export type ChatPartnerStats = {
	/** The chat partner's user info */
	user: WrappedUser;
	/** Total messages exchanged (sent + received) */
	totalMessages: number;
	/** Messages sent to this partner */
	messagesSent: number;
	/** Messages received from this partner */
	messagesReceived: number;
	/** Thread ID for this conversation */
	threadId: string;
};

/**
 * Information about a continuous chat session.
 * A session is defined as messages exchanged with gaps of no more than 30 minutes.
 */
export type ChatSession = {
	/** The chat partner */
	partner: WrappedUser;
	/** Thread ID */
	threadId: string;
	/** Session start time */
	startTime: Date;
	/** Session end time */
	endTime: Date;
	/** Duration in minutes */
	durationMinutes: number;
	/** Total messages exchanged in this session */
	messageCount: number;
};

// ============================================================================
// Social Stats
// ============================================================================

/**
 * Statistics about the user's social connections.
 */
export type SocialStats = {
	/** Current follower count */
	currentFollowers: number;
	/** Current following count */
	currentFollowing: number;
	/** Follower count change (requires previous baseline) */
	followerChange: number | undefined;
	/** Following count change (requires previous baseline) */
	followingChange: number | undefined;
	/** New friends: people who followed you, you followed back, and chatted with */
	newFriends: NewFriend[];
	/** Total new mutual follows this year */
	newMutualFollows: number;
};

/**
 * A "new friend" - someone the user started following who also follows back
 * and has been chatted with this year.
 */
export type NewFriend = {
	/** User info */
	user: WrappedUser;
	/** When the mutual follow relationship was detected */
	connectionDate: Date | undefined;
	/** Number of messages exchanged */
	messageCount: number;
};

// ============================================================================
// Media Stats
// ============================================================================

/**
 * Statistics about the user's own posts and media.
 */
export type MediaStats = {
	/** Total posts shared this year */
	postsSharedCount: number;
	/** Total stories shared this year (estimated from media type) */
	storiesSharedCount: number;
	/** Total reels shared this year */
	reelsSharedCount: number;
	/** Posts with the most engagement */
	topPosts: TopPost[];
	/** Most-liked story (if available) */
	topStory: TopPost | undefined;
	/** User's top comments on their own posts */
	topComments: TopComment[];
	/** Total likes received across all posts */
	totalLikesReceived: number;
	/** Total comments received across all posts */
	totalCommentsReceived: number;
};

/**
 * A top-performing post with engagement metrics.
 */
export type TopPost = {
	/** Post/media ID */
	id: string;
	/** Post code (for URL construction) */
	code: string;
	/** Media type: 1 = photo, 2 = video, 8 = carousel */
	mediaType: number;
	/** Thumbnail URL */
	thumbnailUrl: string | undefined;
	/** Caption text */
	caption: string | undefined;
	/** Like count */
	likeCount: number;
	/** Comment count */
	commentCount: number;
	/** When the post was created */
	takenAt: Date;
	/** Engagement score (likes + comments * weight) */
	engagementScore: number;
};

/**
 * A notable comment on the user's posts.
 */
export type TopComment = {
	/** Comment ID */
	id: string;
	/** The commenter */
	user: WrappedUser;
	/** Comment text */
	text: string;
	/** Like count on the comment */
	likeCount: number;
	/** Post ID this comment belongs to */
	mediaId: string;
	/** When the comment was made */
	createdAt: Date;
};

// ============================================================================
// Feed Stats
// ============================================================================

/**
 * Statistics about the user's feed interactions (posts they liked).
 */
export type FeedStats = {
	/** Total posts liked */
	totalPostsLiked: number;
	/** Total reels liked */
	totalReelsLiked: number;
	/** Users whose content the user liked the most */
	mostLikedAccounts: LikedAccountStats[];
	/** Breakdown of liked content by media type */
	likedByMediaType: Record<number, number>;
};

/**
 * Statistics about how much the user likes a particular account's content.
 */
export type LikedAccountStats = {
	/** The account whose content was liked */
	user: WrappedUser;
	/** Number of posts/reels liked from this account */
	likeCount: number;
	/** Types of content liked (photos, videos, reels) */
	mediaTypes: number[];
};

// ============================================================================
// Shared Types
// ============================================================================

/**
 * Simplified user info for wrapped statistics.
 * Uses a subset of the full User type for serialization efficiency.
 */
export type WrappedUser = {
	pk: string | number;
	username: string;
	fullName?: string;
	profilePicUrl?: string;
	isVerified?: boolean;
};

// ============================================================================
// Collection Progress & State
// ============================================================================

/**
 * Current progress of data collection.
 */
export type CollectionProgress = {
	/** Current phase of collection */
	phase: CollectionPhase;
	/** Progress within current phase (0-100) */
	phaseProgress: number;
	/** Overall progress (0-100) */
	overallProgress: number;
	/** Current status message */
	statusMessage: string;
	/** Items processed in current phase */
	itemsProcessed: number;
	/** Total items in current phase (if known) */
	totalItems: number | undefined;
	/** Estimated time remaining in seconds */
	estimatedTimeRemaining: number | undefined;
};

/**
 * Phases of data collection.
 */
export type CollectionPhase =
	| 'initializing'
	| 'messaging'
	| 'social'
	| 'media'
	| 'feed'
	| 'aggregating'
	| 'complete'
	| 'error';

/**
 * Cached/intermediate state for resumable collection.
 */
export type CollectionState = {
	/** Year being collected */
	year: number;
	/** When collection started */
	startedAt: Date;
	/** Last update timestamp */
	lastUpdatedAt: Date;
	/** Current phase */
	currentPhase: CollectionPhase;
	/** Partial results collected so far */
	partialStats: Partial<WrappedStats>;
	/** Cursor/pagination state for each feed */
	cursors: CollectionCursors;
	/** Whether collection completed successfully */
	completed: boolean;
};

/**
 * Pagination cursors for resuming collection.
 */
export type CollectionCursors = {
	/** Direct inbox cursor */
	inboxCursor?: string;
	/** Per-thread cursors (threadId -> cursor) */
	threadCursors: Record<string, string>;
	/** Followers feed cursor */
	followersCursor?: string;
	/** Following feed cursor */
	followingCursor?: string;
	/** User posts feed cursor */
	userPostsCursor?: string;
	/** Liked posts feed cursor */
	likedPostsCursor?: string;
};

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration options for wrapped data collection.
 */
export type WrappedCollectionOptions = {
	/** Year to collect data for */
	year: number;
	/** Delay between API calls in milliseconds (rate limiting) */
	apiDelayMs: number;
	/** Maximum retries on API errors */
	maxRetries: number;
	/** Whether to use cached data if available */
	useCache: boolean;
	/** Whether to resume interrupted collection */
	resumeFromCache: boolean;
	/** Maximum threads to process (for testing) */
	maxThreads?: number;
	/** Maximum messages per thread to process (for testing) */
	maxMessagesPerThread?: number;
	/** Callback for progress updates */
	onProgress?: (progress: CollectionProgress) => void;
};

/**
 * Default collection options.
 */
export const DEFAULT_COLLECTION_OPTIONS: Omit<
	WrappedCollectionOptions,
	'year'
> = {
	apiDelayMs: 1500,
	maxRetries: 3,
	useCache: true,
	resumeFromCache: true,
};

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error that occurred during wrapped data collection.
 */
export type WrappedCollectionError = {
	/** Error code */
	code: WrappedErrorCode;
	/** Human-readable message */
	message: string;
	/** Phase where error occurred */
	phase: CollectionPhase;
	/** Original error (if any) */
	originalError?: Error;
	/** Whether collection can be resumed */
	recoverable: boolean;
};

/**
 * Error codes for wrapped collection.
 */
export type WrappedErrorCode =
	| 'RATE_LIMITED'
	| 'AUTH_REQUIRED'
	| 'NETWORK_ERROR'
	| 'API_ERROR'
	| 'TIMEOUT'
	| 'CANCELLED'
	| 'UNKNOWN';
