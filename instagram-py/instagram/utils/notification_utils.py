import re

NOTIFICATION_NAMES = {
    "user_followed": "User followed you",
    "comment": "Comment on your post",
    "comment_like": "Your comment was liked",
    "post_like": "Your post was liked",
    "suspicious_login": "Suspicious login attempt",
    "suggested_close_friend": "Suggested user",
    "story_like": "Your story was liked",
    "ig_to_fb_story_engagement_highlight_notif": "Story engagement highlight on Facebook",
    "igd_broadcast_chat_creation": "Invitation to a channel",
    "private_user_follow_request": "Follow request",
}


def get_notification_name(notif_key) -> str:
    """
    Get the human-readable name for a notification key.
    If the key is not found, return the key itself.
    """
    return NOTIFICATION_NAMES.get(notif_key, notif_key)


def format_usernames_in_text(text) -> str:
    """
    Format usernames in the given text.
    """

    def replacer(match):
        full = match.group(1)
        username = full.split("|")[0]
        return username

    return re.sub(r"\{([^{}]+)\}", replacer, text)
