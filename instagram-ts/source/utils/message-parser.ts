import {type DirectThreadFeedResponseItemsItem} from 'instagram-private-api';
import type {MessageSyncMessage} from 'instagram_mqtt';
import type {Message, Reaction, RepliedToMessage} from '../types/instagram.js';

// Chat is this real? Yes, this is real I love monkey patching
// (this has been verified using the API response, the instagram-private-api type is outdated)
// Note that thread_id may not exist here unlike MessageSyncMessage because you request a threadId already when calling this API
type RealChatItem = DirectThreadFeedResponseItemsItem & {
	media: MessageSyncMessage['media'];
	reactions: MessageSyncMessage['reactions'];
	// This type is NOT defined on either API or MQTT and is extended by monkey patching
	replied_to_message?: RawRepliedToMessage;
};

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
 * @returns A structured `Message` object or undefined if parsing fails.
 *
 * @note MessageSyncMessage is the well-typed interface from MQTT library
 *       DirectThreadFeedResponseItemsItem from typescript-private-api can also be used,
 *       but it must be cast to any because entries like media are not defined on the type
 */
export function parseMessageItem(
	item: MessageSyncMessage | RealChatItem,
	threadId: string,
	context: MessageParsingContext,
): Message | undefined {
	if (!item.item_id) return undefined;

	const userId = item.user_id.toString();
	const timestamp = new Date(Number(item.timestamp) / 1000);

	const repliedToMessage = (item as RealChatItem).replied_to_message;
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
		reactions: item.reactions ? parseReactions(item.reactions) : undefined,
		repliedTo,
	};

	switch (item.item_type) {
		case 'text': {
			return {...baseMessage, itemType: 'text', text: item.text ?? ''};
		}

		case 'media': {
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

		case 'link': {
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

		case 'like': {
			return {
				...baseMessage,
				itemType: 'placeholder',
				text: '[Sent a ❤️]',
			};
		}

		// In the future we will add media share for posts support, see issue #142
		case 'raven_media':
		case 'media_share':
		case 'reel_share': {
			return {
				...baseMessage,
				itemType: 'placeholder',
				text: `[Instagram CLI successfully blocked a brainrot]`,
			};
		}

		default: {
			return {
				...baseMessage,
				itemType: 'placeholder',
				text: `[Unsupported Type: ${item.item_type}]`,
			};
		}
	}
}
