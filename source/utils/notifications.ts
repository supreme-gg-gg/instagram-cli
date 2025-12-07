const NOTIFICATION_NAMES: Record<string, string> = {
	user_followed: 'User followed you',
	comment: 'Comment on your post',
	comment_like: 'Your comment was liked',
	post_like: 'Your post was liked',
	suspicious_login: 'Suspicious login attempt',
	suggested_close_friend: 'Suggested user',
	story_like: 'Your story was liked',
	ig_to_fb_story_engagement_highlight_notif:
		'Story engagement highlight on Facebook',
	igd_broadcast_chat_creation: 'Invitation to a channel',
	find_friend_activity: 'Find friends',
	connect_lowlness: 'Lowlness',
	contact_friend: 'Suggestion',
	feed_suite_organic_campaign: 'Feed campaign',
};

/**
 * Get the human-readable name for a notification key.
 * If the key is not found, return the key itself.
 */
export function getNotificationName(notificationKey: string): string {
	return NOTIFICATION_NAMES[notificationKey] ?? notificationKey;
}

/**
 * Format usernames in rich text (e.g., from {username|id}) to plain @username.
 */
export function formatUsernamesInText(text: string): string {
	return text.replaceAll(/{([^{}]+)}/g, (_, match: string) => {
		const username = match.split('|')[0];
		return `@${username}`;
	});
}
