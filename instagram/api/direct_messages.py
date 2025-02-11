from instagrapi import Client as InstaClient
from typing import Dict, List, Tuple, Protocol
from instagrapi.types import DirectThread, DirectMessage, User, Media, UserShort
from instagrapi.extractors import *
from pydantic import ValidationError

# import logging

# logging.basicConfig(filename="debug.log", level=logging.DEBUG)

class ClientWrapper(Protocol):
    insta_client: InstaClient

class DirectMessages:
    def __init__(self, client: ClientWrapper):
        self.client = client
        self.chats: Dict[str, DirectChat] = {}
    
    def fetch_chat_data(self, num_chats: int, num_message_limit: int):
        """
        Fetch chat list and history from API.
        Parameters:
        - num_chats: Number of chats to fetch.
        - num_message_limit: Max number of messages to fetch per chat.

        Returns a dictionary of DirectChat objects.
        """
        self.chats = {thread.id: DirectChat(self.client, thread.id, thread) for thread in self.client.insta_client.direct_threads(amount=num_chats, thread_message_limit=num_message_limit)}
        return self.chats

    def send_text_by_userid(self, userids: List[int], text: str):
        self.client.insta_client.direct_send(text, userids)

class DirectChat:
    def __init__(self, client: ClientWrapper, thread_id: str, thread_data=None):
        self.client = client
        self.thread_id = thread_id
        if thread_data is None:
            self.thread = self.client.insta_client.direct_thread(thread_id)
        else:
            self.thread = thread_data
        
        self.users_cache: Dict[str, UserShort] = {
            user.pk: user for user in self.thread.users
        }

    def fetch_chat_history(self, num_messages: int):
        """
        Fetch chat history for the thread.
        Parameters:
        - num_messages: Number of messages to fetch.
        """
        self.thread.messages = self.client.insta_client.direct_messages(self.thread_id, amount=num_messages)
    
    def get_chat_history(self) -> Tuple[List[str], Dict[int, dict]]:
        """
        Return list of messages in the chat history and a dictionary of media items.
        Returns:
            Tuple containing:
            - List of formatted message strings (media messages include indices)
            - Dictionary mapping indices to media items
        """
        chat = []
        media_items = {}
        media_index = 0

        for message in self.thread.messages:
            # with open('message.txt', 'a', encoding="utf-8") as f:
            #     f.write(repr(message))
            sender = "You" if message.user_id == str(self.client.insta_client.user_id) else (
                self.users_cache[message.user_id].full_name
                if self.users_cache[message.user_id].full_name
                else self.users_cache[message.user_id].username
                if self.users_cache[message.user_id].username
                else 'Instagram User'
            )

            if message.item_type == 'text':
                chat.append(f"{sender}: {message.text}")
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
                            print("Error extracting raven_media: "+repr(e))
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
                    elif message.media_share:
                        # Post reshare
                        pass
                    
                    media_placeholder = ""
                    if media_items[media_index]["type"] == 'raven_media':
                        if media_items[media_index]["media_type"] == 'view_once':
                            media_placeholder = f"[Sent a view-once media (use the Instagram app to view it)]"
                        else:
                            media_placeholder = f"[Sent a {media_items[media_index]['media_type']} #{media_index}]"
                    elif media_items[media_index]["type"] in ['media', 'voice_media']:
                        media_placeholder = f"[Sent a {media_items[media_index]['media_type']} #{media_index}]"
                    elif media_items[media_index]["type"] == 'xma_media_share':
                        media_placeholder = f"[Shared a post (use the Instagram app to view it)]"
                    elif media_items[media_index]["type"] == 'clip':
                        media_placeholder = f"[Sent brainrot]"
                    elif media_items[media_index]["type"] == 'animated_media':
                        media_placeholder = f"[Sent a sticker #{media_index}]"
                    else:
                        media_placeholder = f"[Sent a {media_items[media_index]['type']} (use the Instagram app to view it)]"

                    chat.append(f"{sender}: {media_placeholder}")
                except Exception as e:
                    # chat.append(f"{sender}: [Error: {repr(e)}]")
                    chat.append("Error")
                finally:
                    media_index += 1

        chat.reverse()  # Reverse the order to show latest messages at the bottom
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

    def send_text(self, message: str):
        """
        Send a text message to the chat.
        Parameters:
        - message: Text message to send.
        """
        self.client.insta_client.direct_answer(self.thread_id, message)
        return f"You: {message}"

    def send_photo(self, path: str):
        """
        Send a photo to the chat.
        Parameters:
        - path: Path to the photo file.
        """
        self.client.insta_client.direct_send_photo(path, thread_ids=[self.thread_id])
    
    def send_video(self, path: str):
        """
        Send a video to the chat. Auto generate a thumbnail.
        Parameters:
        - path: Path to the video file.
        """
        self.client.insta_client.direct_send_video(path, thread_ids=[self.thread_id])

    def mark_as_seen(self):
        """
        Mark the chat as seen.
        """
        self.client.insta_client.direct_send_seen(self.thread_id)
    
    def is_seen(self) -> bool:
        """
        Check if the chat is seen by the current user.
        """
        return self.thread.is_seen(self.client.insta_client.user_id)
    
