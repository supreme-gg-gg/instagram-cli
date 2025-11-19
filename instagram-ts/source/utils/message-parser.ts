import {type DirectThreadFeedResponseItemsItem} from 'instagram-private-api';
import {MessageSyncMessageTypes, type MessageSyncMessage} from 'instagram_mqtt';
import type {
	Message,
	Reaction,
	ReactionEvent,
	RepliedToMessage,
	SeenEvent,
} from '../types/instagram.js';

/**
 * Roses are red,
 * All the types are wrong.,
 * So I monkey patch,
 * And refactoring will take long.
 */

// We remove the item_type field to redefine it with proper type discrimination
type ThreadBaseItem = Omit<DirectThreadFeedResponseItemsItem, 'item_type'>;

// Chat is this real? Yes, this is real I love monkey patching
// (this has been verified using the API response, the instagram-private-api type is outdated)
// Note that thread_id may not exist here unlike MessageSyncMessage because you request a threadId already when calling this API
type ThreadMessageItem = ThreadBaseItem & {
	item_type: Exclude<
		MessageSyncMessageTypes,
		MessageSyncMessageTypes.ActionLog
	>;
	media: MessageSyncMessage['media'];
	reactions: MessageSyncMessage['reactions'];
	// This type is NOT defined on either API or MQTT and is extended by monkey patching
	replied_to_message?: RawRepliedToMessage;
};

type ActionLogItem = ThreadBaseItem & {
	item_type: MessageSyncMessageTypes.ActionLog;
	action_log: {
		description: string;
		bold: [unknown];
		text_attributes: [unknown];
		text_parts: [
			{
				text: string;
			},
		];
		is_reaction_log: true;
	};
	hide_in_thread: 1 | 0;
};

type RealChatItem = ThreadMessageItem | ActionLogItem;

type RawRepliedToMessage = {
	item_id: string;
	user_id: number;
	text?: string;
	item_type: string;
};

/**
 * The context required by the parser to resolve user information.
 */
export type MessageParsingContext = {
	userCache: Map<string, string>;
	currentUserId: string;
};

/**
 * Options to configure message parsing behavior.
 */
export type MessageParsingOptions = {
	isPreview: boolean;
};

const defaultParsingOptions: MessageParsingOptions = {
	isPreview: false,
};

/**
 * A standalone helper to get a username from a cache.
 * @param userId The user ID to look up.
 * @param userCache A map of user IDs to usernames.
 * @param currentUserId The ID of the current logged-in user.
 * @returns The username, 'You', or a default string.
 */
function getUsernameFromCache(
	userId: number,
	userCache: Map<string, string>,
	currentUserId: string,
): string {
	const userIdString = userId.toString();
	if (userIdString === currentUserId) {
		return 'You';
	}

	const username = userCache.get(userIdString);
	return username ?? `User_${userId}`;
}

/**
 * Parses the `reactions` object from a message item.
 * @param reactions The raw reactions object from the API/realtime payload.
 * @returns An array of parsed `Reaction` objects or undefined.
 */
function parseReactions(
	reactions: MessageSyncMessage['reactions'],
): Reaction[] | undefined {
	if (!reactions || (reactions.likes_count === 0 && !reactions.emojis)) {
		return undefined;
	}

	const parsed: Reaction[] = [];

	if (reactions.likes) {
		for (const like of reactions.likes) {
			parsed.push({emoji: '❤️', senderId: like.sender_id.toString()});
		}
	}

	if (reactions.emojis) {
		for (const emojiReaction of reactions.emojis) {
			parsed.push({
				emoji: emojiReaction.emoji,
				senderId: emojiReaction.sender_id.toString(),
			});
		}
	}

	return parsed.length > 0 ? parsed : undefined;
}

/**
 * A shared parser for message items from any source (API or Realtime).
 * @param item The raw message item object, likely MessageSyncMessage type from realtime
 * @param context The context needed for parsing (e.g., user cache).
 * @param options Parsing options and configuration.
 * @returns A structured `Message` object or undefined if parsing fails.
 *
 * @note MessageSyncMessage is the well-typed interface from MQTT library
 *       DirectThreadFeedResponseItemsItem from typescript-private-api can also be used,
 *       but it must be cast to any because entries like media are not defined on the type
 */
export function parseMessageItem(
	item: RealChatItem,
	threadId: string,
	context: MessageParsingContext,
	options: MessageParsingOptions = defaultParsingOptions,
): Message | undefined {
	if (!item.item_id) return undefined;

	const userId = item.user_id.toString();
	const timestamp = new Date(Number(item.timestamp) / 1000);

	const repliedToMessage =
		item.item_type === MessageSyncMessageTypes.ActionLog
			? undefined
			: item.replied_to_message;
	const repliedTo: RepliedToMessage | undefined = repliedToMessage
		? {
				id: repliedToMessage.item_id,
				userId: repliedToMessage.user_id.toString(),
				text: repliedToMessage.text,
				itemType: repliedToMessage.item_type,
				username: getUsernameFromCache(
					repliedToMessage.user_id,
					context.userCache,
					context.currentUserId,
				),
			}
		: undefined;

	const baseMessage = {
		id: item.item_id,
		timestamp,
		userId,
		username: getUsernameFromCache(
			Number(userId),
			context.userCache,
			context.currentUserId,
		),
		isOutgoing: userId === context.currentUserId,
		threadId,
		reactions: (item as ThreadMessageItem).reactions
			? parseReactions((item as ThreadMessageItem).reactions)
			: undefined,
		repliedTo,
		item_id: item.item_id,
		// Requires type assertion because the field is not defined on MQTT message
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		client_context: (item as any).client_context,
	};

	switch (item.item_type) {
		case MessageSyncMessageTypes.Text: {
			return {...baseMessage, itemType: 'text', text: item.text ?? ''};
		}

		case MessageSyncMessageTypes.Media: {
			const {media} = item;
			if (!media) {
				return {
					...baseMessage,
					itemType: 'placeholder',
					text: '[Unsupported Media]',
				};
			}

			return {
				...baseMessage,
				itemType: 'media',
				media: {
					id: media.id,
					media_type: media.media_type,
					original_width: media.original_width,
					original_height: media.original_height,
					// These two types are designed to be strictly subsets of the original ImageVersions and VideoVersions types
					image_versions2: media.image_versions2,
					video_versions: media.video_versions,
				},
			};
		}

		case MessageSyncMessageTypes.Link: {
			if (!item.text) {
				return {
					...baseMessage,
					itemType: 'placeholder',
					text: '[Sent a link]',
				};
			}

			return {
				...baseMessage,
				itemType: 'link',
				link: {
					text: item.text,
					url: item.text,
				},
			};
		}

		case MessageSyncMessageTypes.Like: {
			return {
				...baseMessage,
				itemType: 'placeholder',
				text: '[Sent a ❤️]',
			};
		}

		// In the future we will add media share for posts support, see issue #142
		case MessageSyncMessageTypes.RavenMedia:
		case MessageSyncMessageTypes.MediaShare:
		case MessageSyncMessageTypes.ReelShare: {
			return {
				...baseMessage,
				itemType: 'placeholder',
				text: `[Instagram CLI successfully blocked a brainrot]`,
			};
		}

		case MessageSyncMessageTypes.ActionLog: {
			if (options.isPreview || item.hide_in_thread === 0) {
				return {
					...baseMessage,
					itemType: 'placeholder',
					text: item.action_log.description,
				};
			}

			return undefined;
		}

		default: {
			// clip seems to be a new type that is not documented and is the same as brainrot / reels
			if ((item.item_type as any) === 'clip') {
				return {
					...baseMessage,
					itemType: 'placeholder',
					text: `[Instagram CLI successfully blocked a brainrot]`,
				};
			}

			return {
				...baseMessage,
				itemType: 'placeholder',
				text: `[Unsupported Type: ${item.item_type}]`,
			};
		}
	}
}

// More monkey patching!
type CreateReactionEventMessage = {
	path: string;
	op: 'add' | 'replace' | string;
	thread_id: string;
	emoji: string;
	super_react_type?: 'none';
	timestamp: Date;
};

// When a user reacts to a message, Instagram may also send another realtime event like "user reacted emoji to your message".
// This has nothing to do with the actual reaction on the message itself, and contains almost no useful information.
// I suspect it's just tech debt / convenience event for Instagram to show a pretty unread message preview in their official app.
/**
 * A standalone helper to parse reaction events from mqtt realtime data.
 * @param wrapper The raw event wrapper from realtime.on('message').
 * @returns A structured `ReactionEvent` object or undefined if parsing fails.
 */
//
export function parseReactionEvent(
	message: CreateReactionEventMessage,
): ReactionEvent | undefined {
	try {
		if (!message?.path || !message.thread_id) {
			return undefined;
		}

		// Parse the path: /direct_v2/threads/{thread_id}/items/{item_id}/reactions/likes/{user_id}
		const pathMatch =
			/\/direct_v2\/threads\/([^/]+)\/items\/([^/]+)\/reactions\/(?:likes|emojis)\/([^/]+)/.exec(
				message.path,
			);

		if (!pathMatch) {
			return undefined;
		}

		const [, threadId, itemId, userId] = pathMatch;

		if (!threadId || !itemId || !userId) {
			return undefined;
		}

		return {
			threadId,
			itemId,
			userId,
			emoji: message.emoji || '❤',
			timestamp: message.timestamp,
		};
	} catch {
		return undefined;
	}
}

type SeenEventMessage = {
	path: string;
	op: 'add' | 'replace' | string;
	thread_id: string;
	item_id: string;
	client_context?: 'none';
	timestamp: Date;
	created_at: Date;
	ssh_seen_state?: any;
	disappearing_messages_seen_state?: any;
};

export function parseSeenEvent(
	seenEvent: SeenEventMessage,
): SeenEvent | undefined {
	try {
		if (!seenEvent?.path || !seenEvent.thread_id) {
			return undefined;
		}

		// Parse the path: /direct_v2/threads/{thread_id}/participants/{user_id}/has_seen
		const pathMatch =
			/\/direct_v2\/threads\/([^/]+)\/participants\/([^/]+)\/has_seen/.exec(
				seenEvent.path,
			);

		if (!pathMatch) {
			return undefined;
		}

		const [, threadId, userId] = pathMatch;

		if (!threadId || !userId) {
			return undefined;
		}

		return {
			threadId,
			userId,
			itemId: seenEvent.item_id,
			timestamp: seenEvent.timestamp,
		};
	} catch {
		return undefined;
	}
}
