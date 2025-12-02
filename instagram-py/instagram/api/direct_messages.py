from __future__ import annotations
from typing import Dict, List, Tuple, Protocol
from pathlib import Path
import webbrowser
import emoji

from .utils import (
    direct_threads_chunk,
    user_info_by_username_private,
    direct_thread_chunk,
    fuzzy_match,
    direct_send_media,
    download_media_by_url,
    extract_links_from_text,
    render_latex_local,
    render_latex_online,
)
from .scheduler import MessageScheduler

from instagrapi import Client as InstaClient
from instagrapi.types import (
    DirectMessage,
    UserShort,
    ReplyMessage,
)
from instagrapi.extractors import extract_direct_thread, extract_direct_media
from instagrapi.exceptions import (
    UserNotFound,
    DirectThreadNotFound,
    ClientForbiddenError,
)
from pydantic import ValidationError
from dataclasses import dataclass
from typing import Optional
from instagram.configs import Config

# logger = setup_logging(__name__)


@dataclass
class MessageBrief:
    sender: str
    content: str


@dataclass
class MessageInfo:
    id: str
    message: MessageBrief
    reactions: Optional[Dict] = None
    reply_to: Optional[MessageBrief] = None


class ClientWrapper(Protocol):
    insta_client: InstaClient


class DirectMessages:
    def __init__(self, client: ClientWrapper):
        self.client = client
        self.chats: List[DirectChat] = []
        self.chats_cursor = None

    def fetch_chat_data(
        self, num_chats: int, num_message_limit: int
    ) -> List[DirectChat]:
        """
        Fetch the op (most recent) chat list and history from API.
        Parameters:
        - num_chats: Number of chats to fetch.
        - num_message_limit: Max number of messages to fetch per chat.

        Returns a list of DirectChat objects.
        """
        res, self.chats_cursor = direct_threads_chunk(
            self.client.insta_client,
            amount=num_chats,
            thread_message_limit=num_message_limit,
        )
        self.chats = [DirectChat(self.client, thread.id, thread) for thread in res]
        return self.chats

    def fetch_next_chat_chunk(
        self, num_chats: int, num_message_limit: int
    ) -> List[DirectChat]:
        """
        Fetch the next chunk of chats from the API.
        Parameters:
        - num_chats: Number of chats to fetch.
        - num_message_limit: Max number of messages to fetch per chat.

        Returns a list of DirectChat objects.
        """
        res, self.chats_cursor = direct_threads_chunk(
            self.client.insta_client,
            amount=num_chats,
            thread_message_limit=num_message_limit,
            cursor=self.chats_cursor,
        )
        # Append to existing chats (maintain reverse chronological order)
        self.chats += [DirectChat(self.client, thread.id, thread) for thread in res]
        return self.chats

    def search_by_username(self, username: str) -> DirectChat | None:
        """
        Search for a chat by username, the workflow:
        1. Search for user_id from username
        2. Initialize a DirectChat object with the user_id
        Parameters:
        - username: Username to search for
        Returns:
        - DirectChat object if found, None if not found
        Raises:
        - ChatNotFoundError: If no chat

        NOTE: This requires an EXACT MATCH of usernames,
        we recommend using search_by_title for fuzzy matching
        """
        # TODO: compare which of the following two methods is faster
        # user = self.client.insta_client.direct_search(username) # Returns a list of search results
        # user_id = user[0].pk # This gets the user_id of the first search result
        user_id = None
        try:
            user_id = user_info_by_username_private(
                self.client.insta_client, username
            ).pk
        except UserNotFound:
            return None

        try:
            thread_data = self.client.insta_client.direct_thread_by_participants(
                user_ids=[user_id]
            )
            thread = extract_direct_thread(
                thread_data["thread"]
            )  # use built-in instagrapi parsing function
        except Exception as e:
            raise DirectThreadNotFound(
                f"Chat with user {username} not found: {e}"
            ) from e

        return DirectChat(self.client, thread.id, thread)

    def search_by_title(
        self, title: str, threshold: float = 0.7, n: int = 1
    ) -> DirectChat | None:
        """
        Search for a chat by thread title using fuzzy matching.
        Uses pagination to search through the latest chats.
        Default max number of chats to search is 30.

        Parameters:
        - title: Title to search for.
        - threshold: Minimum similarity ratio (0.0 to 1.0) required for a match. Default 0.7
        - n: Number of best matches to return. Default 1
        Returns:
        - DirectChat object if found, None if not found.
        Raises:
        - ChatNotFoundError: If no chat is found.

        NOTE: This does NOT currently support multiple matches,
        this can be easily added but requires frontend support.
        """

        batch_size = 20
        num_chats_searched = 0
        max_search_depth = 50

        # Check existing chats first
        if len(self.chats) > 0:
            num_chats_searched = len(self.chats)
            result = fuzzy_match(
                query=title,
                items=self.chats,
                getter=lambda chat: chat.get_title(),
                cutoff=threshold,
                use_partial_ratio=True,
            )
            if len(result) > 0:
                return result[0]

        while num_chats_searched < max_search_depth:
            self.fetch_next_chat_chunk(batch_size, 20)
            num_chats_searched += batch_size

            result = fuzzy_match(
                query=title,
                items=self.chats[num_chats_searched - batch_size : num_chats_searched],
                getter=lambda chat: chat.get_title(),
                cutoff=threshold,
                use_partial_ratio=True,
            )

            if result is None:
                continue

            if len(result) > 0:
                return result[0]

        raise DirectThreadNotFound(
            f"Chat with title {title} not found in the latest {num_chats_searched} chats"
        )

    def send_text_by_userid(self, userids: List[int], text: str):
        """
        Send a text message to a list of user IDs.
        """
        self.client.insta_client.direct_send(text, userids)


class DirectChat:
    def __init__(self, client: ClientWrapper, thread_id: str, thread_data=None):
        self.client = client
        self.thread_id = thread_id
        self.media_items = {}
        if thread_data is None:
            self.thread = self.client.insta_client.direct_thread(thread_id)
        else:
            self.thread = thread_data

        self.messages_cursor = None
        self.title = self.get_title()

        # We need to fetch thread first then check seen status
        # NOTE: This is very poorly documented, but through experimentation,
        # we found that meta returns 1 for unseen and 0 for seen for read_state
        # Note that this is returned directly by Meta, but often disagrees with
        # the builtin is_seen() function??
        self.seen = self.thread.read_state  # 0 if seen, 1 if unseen

        self.users_cache: Dict[str, UserShort] = {
            user.pk: user for user in self.thread.users
        }

    @staticmethod
    def _replace_emojis(text: str) -> str:
        """
        Replace :emoji_name: patterns with actual emoji characters
        This is an improve version of the emoji.emojize function
        that allows for fuzzy matching of emoji names using custom
        fuzzy_match function. Currently only uses english names.
        However, you can add 2 lines to include aliases as well.
        """
        words = text.split()
        result = []

        # Extract unique names
        emoji_names = set()
        # take all the english and english aliases
        for emo in emoji.EMOJI_DATA.values():
            if "alias" in emo:
                if isinstance(emo["alias"], list):
                    for alias in emo["alias"]:
                        emoji_names.add(alias)
            else:
                emoji_names.add(emo["en"])

        if text in emoji_names:
            return emoji.emojize(f"{text}", language="alias")

        # No need to print the set of emoji names
        for word in words:
            if word.startswith(":") and word.endswith(":"):
                emoji_match = fuzzy_match(
                    query=word, items=list(emoji_names), cutoff=0.8
                )
                if emoji_match:
                    result.append(emoji.emojize(f"{emoji_match[0]}", language="alias"))
                else:
                    result.append(word)
            else:
                result.append(word)

        return " ".join(result)

    def fetch_chat_history(self, num_messages: int):
        """
        Fetch chat history for the thread.
        Parameters:
        - num_messages: Number of messages to fetch.
        """
        thread_data, self.messages_cursor = direct_thread_chunk(
            self.client.insta_client, self.thread_id, amount=num_messages
        )
        self.thread.messages = thread_data.messages
        # self.thread.messages = self.client.insta_client.direct_messages(self.thread_id, amount=num_messages)

    def fetch_older_messages_chunk(self, num_messages: int):
        """
        Fetch the older chunk of messages in the chat.
        Parameters:
        - num_messages: Number of messages to fetch.
        """
        thread_data, self.messages_cursor = direct_thread_chunk(
            self.client.insta_client,
            self.thread_id,
            amount=num_messages,
            cursor=self.messages_cursor,
        )
        self.thread.messages += thread_data.messages

    def get_chat_history(self) -> Tuple[List[Tuple[str, str]], Dict[int, dict]]:
        """
        Return list of messages in the chat history and a dictionary of media items.
        Returns:
            Tuple containing:
            - List of tuples of:
                - string representing message senders
                - formatted message strings (media messages include indices)
            - Dictionary mapping indices to media items

        NOTE: marking as seen is done in the chat ui when this is invoked
        """
        chat = []
        media_items = {}
        media_index = 0

        def process_message(
            message: DirectMessage | ReplyMessage,
        ) -> MessageBrief | None:
            """Process a message and extract relevant information."""
            nonlocal media_index
            nonlocal media_items

            # Skip action logs (like reactions)
            if message.item_type == "action_log":
                return None

            # Determine message sender
            is_self = message.user_id == str(self.client.insta_client.user_id)
            sender = (
                "You"
                if is_self
                else (
                    self.users_cache[message.user_id].full_name
                    or self.users_cache[message.user_id].username
                    or "Instagram User"
                )
            )

            # Handle text messages
            # We handle URLs here as well because the Meta API seems to be pretty inconsistent with URL extraction,
            # sometimes it is processed by backend (link, xma_link), sometimes only handled by frontend (text)
            if message.item_type in ["text", "link", "xma_link"]:
                message_text = ""
                if message.item_type == "text" or message.item_type == "xma_link":
                    # Regular text message or inline link message
                    message_text = message.text
                elif message.item_type == "link":
                    # Link message
                    message_text = message.link.get("text", "")
                urls = extract_links_from_text(message_text)
                if urls:
                    # If there are links, replace them with placeholders
                    for url in urls:
                        media_items[media_index] = {
                            "type": message.item_type,
                            "media_id": message.id,
                            "user_id": message.user_id,
                            "timestamp": message.timestamp,
                            "media_type": "link",
                            "url": url[1],  # expanded URL
                        }
                        message_text = message_text.replace(
                            url[0], f"[URL #{media_index}: {url[0]}]"
                        )
                        media_index += 1

                return MessageBrief(sender=sender, content=message_text)

            # For media messages, we need to process and store the media
            try:
                # Initialize a media item entry
                media_items[media_index] = {
                    "type": message.item_type,
                    "media_id": message.id,
                    "user_id": message.user_id,
                    "timestamp": message.timestamp,
                    "media_type": "unknown",  # Default type
                }

                # Extract media metadata based on type
                if message.item_type == "raven_media":
                    # Handle disappearing media
                    _process_raven_media(message, media_index)
                elif message.media:
                    # Handle regular media (photos, videos)
                    _process_regular_media(message, media_index)
                elif message.item_type == "generic_xma":
                    # Handle replies
                    media_items[media_index]["media_type"] = "reply"
                    media_items[media_index]["reply_text"] = message.text

                # Generate appropriate placeholder text
                placeholder_templates = {
                    # Format: 'media_type': 'placeholder text'
                    "view_once": "[Sent a view-once media (use the Instagram app to view it)]",
                    "xma_media_share": "[Shared a post (use the Instagram app to view it)]",
                    "image": "[Sent an image #{index}]",
                    "video": "[Sent a video #{index}]",
                    "audio": "[Sent an audio #{index}]",
                    "media": "[Sent a {media_type} #{index}]",
                    "voice_media": "[Sent a {media_type} #{index}]",
                    "clip": "[Sent brainrot]",
                    "animated_media": "[Sent a sticker #{index}]",
                    "reply": "[Replied to your note/post: {reply_text}]",
                }

                media_type = media_items[media_index]["media_type"]
                item_type = media_items[media_index]["type"]

                # Get template or use fallback template
                template = (
                    placeholder_templates.get(media_type)
                    or placeholder_templates.get(item_type)
                    or "[Sent a {type} (use the Instagram app to view it)]"
                )

                # Format the template with media details
                placeholder = template.format(
                    index=media_index,
                    media_type=media_type,
                    type=item_type,
                    url=media_items[media_index].get("url", ""),
                    reply_text=media_items[media_index].get("reply_text", ""),
                )

                content = placeholder

            except Exception as e:
                content = f"[Error: {repr(e)}]"
            finally:
                media_index += 1

            return MessageBrief(sender=sender, content=content)

        def _process_raven_media(message, index):
            """Process disappearing (raven) media"""
            try:
                media = extract_direct_media(message.visual_media["media"])
                media_items[index]["view_mode"] = message.visual_media.get(
                    "view_mode", ""
                )

                # Extract URL based on media type
                if media.video_url:
                    media_items[index]["url"] = media.video_url
                    media_items[index]["media_type"] = "video"
                elif media.thumbnail_url:
                    media_items[index]["url"] = media.thumbnail_url
                    media_items[index]["media_type"] = "image"
                elif media.audio_url:
                    media_items[index]["url"] = media.audio_url
                    media_items[index]["media_type"] = "audio"
            except ValidationError:
                # The media URL is empty likely due to a (expired?) view-once media
                media_items[index]["url"] = None
                media_items[index]["media_type"] = "view_once"

        def _process_regular_media(message, index):
            """Process regular media (photos, videos)"""
            if message.media.video_url:
                media_items[index]["url"] = message.media.video_url
                media_items[index]["media_type"] = "video"
            elif message.media.thumbnail_url:
                media_items[index]["url"] = message.media.thumbnail_url
                media_items[index]["media_type"] = "image"
            elif message.media.audio_url:
                media_items[index]["url"] = message.media.audio_url
                media_items[index]["media_type"] = "audio"

        for message in self.thread.messages:
            # with open('message.txt', 'a', encoding="utf-8") as f:
            #     f.write(repr(message.reactions))
            reply = None
            if message.reply:
                reply = process_message(message.reply)

            reactions = None
            if message.reactions:
                # Structure of .reactions:
                # {
                #   'emojis': [
                #     {
                #         'timestamp': <int>,
                #         'client_context': '<int>',
                #         'sender_id': <int>,
                #         'emoji': '👍',
                #         'super_react_type': 'none'
                #     }
                #   ]
                # }

                reactions_data = [
                    reaction["emoji"] for reaction in message.reactions["emojis"]
                ]
                # Convert reactions into a dictionary of emoji: count
                reactions = {
                    emoji: reactions_data.count(emoji) for emoji in reactions_data
                }
            msg = process_message(message)
            if msg is None:
                continue
            chat.append(
                MessageInfo(
                    **{
                        "message": msg,
                        "reply_to": reply,
                        "reactions": reactions,
                        "id": message.id,
                    }
                )
            )

        chat.reverse()  # Reverse the order to show latest messages at the bottom

        # Store media items for later access
        self.media_items = media_items

        return chat, media_items

    def get_title(self) -> str:
        """
        Get a title for the chat.
        """
        title = self.thread.thread_title
        if not title:
            title = ", ".join(
                [
                    user.full_name if user.full_name else user.username
                    for user in self.thread.users
                ]
            )
        return title

    def send_text(self, message: str) -> str:
        """
        Send a text message to the chat.
        Parameters:
        - message: Text message to send.

        Replaces :emoji_name: patterns with actual emoji characters.
        This can use either the default emoji library implementation
        or the custom fuzzy matching implementation.
        """
        # NOTE: direct_answer is just a wrapper around direct_send
        # processed_message = emoji.emojize(message, language='alias')
        processed_message = self._replace_emojis(message)
        self.client.insta_client.direct_answer(self.thread_id, processed_message)
        return f"You: {processed_message}"

    def schedule_message(self, send_time: str, message: str) -> str:
        """
        Schedule a message to be sent at a later time.
        Parameters:
        - send_time: Time to send the message.
        - message: Text message to send.
        """
        scheduler = MessageScheduler().get_instance()
        return scheduler.add_task(
            self.thread_id, send_time, message, display_name=self.get_title()
        )

    def cancel_latest_scheduled_message(self) -> str:
        """
        Cancel the latest scheduled message.
        """
        scheduler = MessageScheduler().get_instance()
        return scheduler.cancel_latest_task()

    def get_message_id(self, message_index: int) -> str:
        """
        Get the message ID of a message by index.
        Parameters:
        - message_index: Index of the message.
        NOTE: The index might not be reversed so you can pass in negative indices.
        """
        return self.thread.messages[message_index].id

    def search_message_by_id(self, message_id: str) -> DirectMessage | None:
        """
        Search for a message by ID.
        Parameters:
        - message_id: ID of the message to search for.
        """
        # logger.info(f"Searching for message ID: {message_id}")
        for message in self.thread.messages:
            if message.id == message_id:
                return message
        return None

    def send_reply_text(self, message: str, message_id: str) -> str:
        """
        Send a reply to a specific message in the chat.
        Parameters:
        - message: Text message to send.
        - message_id: ID of the message to reply to.
        """
        # First we need to get the DirectMessage object we trying to reply to
        if not (reply_to_message := self.search_message_by_id(message_id)):
            return "Message not found"

        # logger.info(f"Replying to message: {reply_to_message.text[:10]}...")

        # Then we can send the reply
        processed_message = self._replace_emojis(message)
        self.client.insta_client.direct_send(
            processed_message,
            thread_ids=[self.thread_id],
            reply_to_message=reply_to_message,
        )

        # This should add the reply to DirectMessage.reply as ReplyMessage
        return f'You replied to "{reply_to_message.text[:10]}...": {processed_message}'

    def send_photo(self, path: str):
        """
        Send a photo to the chat.
        Parameters:
        - path: Path to the photo file.
        """
        direct_send_media(
            self.client.insta_client,
            path,
            thread_ids=[self.thread_id],
            content_type="photo",
        )
        return f"You: [Sent a photo at {path}]"

    def send_video(self, path: str) -> str:
        """
        Send a video to the chat. Auto generate a thumbnail.
        Parameters:
        - path: Path to the video file.
        """
        self.client.insta_client.direct_send_video(path, thread_ids=[self.thread_id])
        return f"You: [Sent a video at {path}]"

    def mark_as_seen(self) -> None:
        """
        Mark the chat as seen.
        0 if seen, 1 if unseen, this is the code I believe Meta uses in their schema
        """
        self.seen = 0
        self.client.insta_client.direct_send_seen(self.thread_id)

    def is_seen(self) -> bool:
        """
        Check if the chat is seen by the current user.
        """
        return self.thread.is_seen(self.client.insta_client.user_id)

    def unsend_message(self, message_id: str) -> bool:
        """
        Unsend a message by ID.
        Parameters:
        - message_id: ID of the message to unsend.

        Returns:
        - A boolean indicating success or failure.
        """
        try:
            return self.client.insta_client.direct_message_delete(
                self.thread_id, message_id
            )
        except ClientForbiddenError:
            # This is most likely due to attempting to unsend a message by someone else
            return False

    def media_url_download(self, media_index: int) -> str | None:
        """
        Download media item by index. Uses the cached media items for url.
        Also works if the media item is a link it opens it in the browser.
        Parameters:
        - media_index: Index of the media item.
        Returns:
        - File path of the downloaded media.
        """
        media_item = self.media_items[media_index]
        if not media_item:
            return None

        if "url" not in media_item or not media_item["url"]:
            return None

        if media_item["media_type"] == "link":
            url = media_item["url"]
            webbrowser.open(url)
            return None

        save_dir = Path(Config().get("advanced.media_dir"))
        if not save_dir.exists():
            save_dir.mkdir(parents=True, exist_ok=True)
        # save_dir = configs.Config().get("advanced.media_dir", "media")

        # NOTE: media_item["url"] is pydantic HttpUrl object, NOT A STRING!
        # WARNING: If you try to use it as a string it will raise AttributeError!!!

        # Create unique filename based on URL and media ID
        # url_hash = hashlib.md5(str(media_item['url']).encode()).hexdigest()[:8]
        # filename = f"{media_item['media_id']}_{url_hash}"

        # LMAO I just realised media ID must be unique so we can just use it as filename
        filename = f"{media_item['media_id']}"

        try:
            if media_item["media_type"] in ["photo", "image", "video"]:
                file_path = download_media_by_url(
                    url=media_item["url"],
                    filename=filename,
                    folder=save_dir,
                    media_type=media_item["media_type"],
                )
            else:
                raise ValueError(
                    f"Unsupported media type for viewing: {media_item['type']}"
                )
        except Exception as e:
            raise e

        return file_path

    def send_latex_image(self, latex_expr: str, local: bool) -> str:
        """
        Send a LaTeX expression as an image to the chat.
        Parameters:
        - latex_expr: LaTeX expression to render.
        """
        # Save to the generated cahce
        save_dir = Path(Config().get("advanced.generated_dir"))
        if not save_dir.exists():
            save_dir.mkdir(parents=True, exist_ok=True)

        filename = f"latex_{hash(latex_expr)}"

        try:
            if local:
                # Render locally
                output_path = render_latex_local(
                    latex_expr, output_path=save_dir / f"{filename}.png"
                )
            else:
                # Render online
                output_path = render_latex_online(
                    latex_expr, output_path=save_dir / f"{filename}.png", padding=20
                )
            # Send the image as usual
            self.send_photo(output_path)
        except Exception as e:
            return f"Failed to send LaTeX image: {e}"

        return f"You: [Sent LaTeX image: {latex_expr}]"
