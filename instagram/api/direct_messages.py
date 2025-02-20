from __future__ import annotations
from typing import Dict, List, Tuple, Protocol
from pathlib import Path
import webbrowser
import emoji

# import hashlib

# from .utils import setup_logging
from .utils import user_info_by_username_private, direct_send_media , render_latex_online, \
    render_latex_local, fuzzy_match, direct_thread_chunk, user_info_by_username_private
from .scheduler import MessageScheduler

from instagrapi import Client as InstaClient
from instagrapi.types import DirectThread, DirectMessage, User, Media, UserShort, ReplyMessage
from instagrapi.extractors import *
from instagrapi.exceptions import UserNotFound, DirectThreadNotFound, ClientNotFoundError
from pydantic import ValidationError
from dataclasses import dataclass
from typing import List, Optional
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
        self.chats: Dict[str, DirectChat] = {}

    def fetch_chat_data(self, num_chats: int, num_message_limit: int) -> Dict[str, DirectChat]:
        """
        Fetch chat list and history from API.
        Parameters:
        - num_chats: Number of chats to fetch.
        - num_message_limit: Max number of messages to fetch per chat.

        Returns a dictionary of DirectChat objects.
        """
        self.chats = {thread.id: DirectChat(self.client, thread.id, thread) for thread in self.client.insta_client.direct_threads(amount=num_chats, thread_message_limit=num_message_limit)}
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

        NOTE: This requires an EXACT MATCH of usernames, 
        we recommend using search_by_title for fuzzy matching
        """
        # TODO: compare which of the following two methods is faster
        # user = self.client.insta_client.direct_search(username) # Returns a list of search results
        # user_id = user[0].pk # This gets the user_id of the first search result
        user_id = None
        try:
            user_id = user_info_by_username_private(self.client.insta_client, username).pk
        except UserNotFound:
            return None
        
        thread_data = self.client.insta_client.direct_thread_by_participants(user_ids=[user_id])
        thread = extract_direct_thread(thread_data["thread"])  # use built-in instagrapi parsing function
        return DirectChat(self.client, thread.id, thread)

    def search_by_title(self, title: str, threshold: float = 0.75, n: int = 1) -> DirectChat | None:
        """
        Search for a chat by thread title using fuzzy matching.
        
        Parameters:
        - title: Title to search for.
        - threshold: Minimum similarity ratio (0.0 to 1.0) required for a match. Default 0.75
        - n: Number of best matches to return. Default 1
        Returns:
        - DirectChat object if found, None if not found.

        NOTE: This does NOT currently support multiple matches,
        this can be easily added but requires frontend support.
        """
        if not self.chats:
            self.fetch_chat_data(10, 20)

        result = fuzzy_match(
            query=title,
            items=list(self.chats.values()),
            getter=lambda chat: chat.get_title(),
            cutoff=threshold,
            use_partial_ratio=True
        )

        print(result)
        
        return result[0] if result and len(result) > 0 else None

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
        self.seen = self.thread.read_state # 0 if seen, 1 if unseen

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
            if 'alias' in emo:
                if isinstance(emo['alias'], list):
                    for alias in emo['alias']:
                        emoji_names.add(alias)
            else:
                emoji_names.add(emo['en'])

        if text in emoji_names:
            return emoji.emojize(f"{text}", language='alias')
        
        # No need to print the set of emoji names
        for word in words:
            if word.startswith(':') and word.endswith(':'):
                emoji_match = fuzzy_match(
                    query=word,
                    items=list(emoji_names),
                    cutoff=0.8
                )
                if emoji_match:
                    result.append(emoji.emojize(f"{emoji_match[0]}", language='alias'))
                else:
                    result.append(word)
            else:
                result.append(word)
                
        return ' '.join(result)

    def fetch_chat_history(self, num_messages: int):
        """
        Fetch chat history for the thread.
        Parameters:
        - num_messages: Number of messages to fetch.
        """
        thread_data, self.messages_cursor = direct_thread_chunk(self.client.insta_client, self.thread_id, amount=num_messages)
        self.thread.messages = thread_data.messages
        # self.thread.messages = self.client.insta_client.direct_messages(self.thread_id, amount=num_messages)
    
    def fetch_older_messages_chunk(self, num_messages: int):
        """
        Fetch the older chunk of messages in the chat.
        Parameters:
        - num_messages: Number of messages to fetch.
        """
        thread_data, self.messages_cursor = direct_thread_chunk(self.client.insta_client, self.thread_id, amount=num_messages, cursor=self.messages_cursor)
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

        def process_message(message: DirectMessage | ReplyMessage) -> MessageBrief | None:
            nonlocal media_index
            nonlocal media_items
            if message.item_type == 'action_log':
                return None # Skip action logs (reactions)
            res = {}
            sender = "You" if message.user_id == str(self.client.insta_client.user_id) else (
                self.users_cache[message.user_id].full_name
                if self.users_cache[message.user_id].full_name
                else self.users_cache[message.user_id].username
                if self.users_cache[message.user_id].username
                else 'Instagram User'
            )

            if message.item_type == 'text':
                res = {'sender': sender, 'content': f"{message.text}"}
            else:
                try:
                    # print(message)
                    # Store media information
                    media_items[media_index] = {
                        'type': message.item_type,
                        'media_id': message.id,
                        'user_id': message.user_id,
                        'timestamp': message.timestamp
                    }
                    
                    # Add specific media details if available
                    if message.item_type == 'raven_media':
                        try:
                            media = extract_direct_media(message.visual_media['media'])
                            media_items[media_index]["view_mode"] = message.visual_media.get('view_mode', "")
                            media_items[media_index]['url'] = (
                                media.video_url if media.video_url else (
                                media.thumbnail_url if media.thumbnail_url else (
                                media.audio_url if media.audio_url else None
                            )))
                            media_items[media_index]["media_type"] = (
                                'video' if media.video_url else (
                                'image' if media.thumbnail_url else (
                                'audio' if media.audio_url else 'unknown'
                            )))
                        except ValidationError as e:
                            # The media URL is empty likely due to a (expired?) view-once media
                            media_items[media_index]['url'] = None
                            media_items[media_index]["media_type"] = 'view_once'
                    elif message.media:
                        media_items[media_index]['url'] = (
                            message.media.video_url if message.media.video_url else (
                            message.media.thumbnail_url if message.media.thumbnail_url else (
                            message.media.audio_url if message.media.audio_url else None
                        )))
                        media_items[media_index]["media_type"] = (
                            'video' if message.media.video_url else (
                            'image' if message.media.thumbnail_url else (
                            'audio' if message.media.audio_url else 'unknown'
                        )))
                    elif message.item_type == "xma_link" and message.text:
                        media_items[media_index]["media_type"] = 'link'
                        media_items[media_index]['url'] = message.text
                    elif message.media_share:
                        # Post reshare
                        pass
                    
                    media_placeholder = ""
                    if media_items[media_index]["type"] == 'raven_media':
                        if media_items[media_index]["media_type"] == 'view_once':
                            media_placeholder = "[Sent a view-once media (use the Instagram app to view it)]"
                        elif media_items[media_index]["media_type"] == 'xma_media_share':
                            media_placeholder = "[Shared a post (use the Instagram app to view it)]"
                        else:
                            media_placeholder = f"[Sent a {media_items[media_index]['media_type']} #{media_index}]"
                    elif media_items[media_index]["type"] in ['media', 'voice_media']:
                        media_placeholder = f"[Sent a {media_items[media_index]['media_type']} #{media_index}]"
                    elif media_items[media_index]["type"] == 'xma_media_share':
                        media_placeholder = "[Shared a post (use the Instagram app to view it)]"
                    elif media_items[media_index]["type"] == 'xma_link':
                        media_placeholder = f"[Sent URL #{media_index}: {media_items[media_index]['url']}]"
                    elif media_items[media_index]["type"] == 'clip':
                        media_placeholder = "[Sent brainrot]"
                    elif media_items[media_index]["type"] == 'animated_media':
                        media_placeholder = f"[Sent a sticker #{media_index}]"
                    else:
                        media_placeholder = f"[Sent a {media_items[media_index]['type']} (use the Instagram app to view it)]"

                    res = {'sender': sender, 'content': f"{media_placeholder}"}
                except Exception as e:
                    res = {'sender': sender, 'content': f"[Error: {repr(e)}]"}
                    # chat.append("Error")
                finally:
                    media_index += 1
            return MessageBrief(**res)

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
                
                reactions_data = [reaction['emoji'] for reaction in message.reactions['emojis']]
                # Convert reactions into a dictionary of emoji: count
                reactions = {emoji: reactions_data.count(emoji) for emoji in reactions_data}
            msg = process_message(message)
            if msg is None:
                continue
            chat.append(MessageInfo(**{
                'message': msg,
                'reply_to': reply,
                'reactions': reactions,
                'id': message.id
            }))

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
            title = ', '.join([
                user.full_name
                if user.full_name
                else user.username
                for user in self.thread.users
            ])
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
        return scheduler.add_task(self.thread_id, send_time, message, display_name=self.get_title())
    
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
            reply_to_message=reply_to_message
        )

        # This should add the reply to DirectMessage.reply as ReplyMessage
        return f"You replied to \"{reply_to_message.text[:10]}...\": {processed_message}"

    def send_photo(self, path: str):
        """
        Send a photo to the chat.
        Parameters:
        - path: Path to the photo file.
        """
        direct_send_media(self.client.insta_client, path, thread_ids=[self.thread_id], content_type="photo")
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
    
    def media_url_download(self, media_index: int) -> str | None:
        """
        Download media item by index. Uses the cached media items for url.
        Also works if the media item is a link it opens it in the browser.
        Parameters:
        - media_index: Index of the media item.
        Returns:
        - File path of the downloaded media.
        """
        client = self.client.insta_client
        media_item = self.media_items[media_index]
        if not media_item:
            return None
        
        if "url" not in media_item or not media_item["url"]:
            return None

        if media_item["media_type"] == 'link':
            url = media_item['url']
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
            if media_item["media_type"] in ['photo', 'image']:
                file_path = client.photo_download_by_url(
                    media_item['url'],
                    filename=filename, # apparently it does not require the .jpg extension
                    folder=save_dir
                )
            elif media_item["media_type"] in ['video']:
                file_path = client.video_download_by_url(
                    media_item['url'],
                    filename=filename,
                    folder=save_dir
                )
            else:
                raise ValueError(f"Unsupported media type for viewing: {media_item['type']}")
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
                output_path = render_latex_local(latex_expr, output_path=save_dir / f"{filename}.png")
            else:
                # Render online
                output_path = render_latex_online(latex_expr, output_path=save_dir / f"{filename}.png", padding=20)
            # Send the image as usual
            self.send_photo(output_path)
        except Exception as e:
            return f"Failed to send LaTeX image: {e}"

        return f"You: [Sent LaTeX image: {latex_expr}]"