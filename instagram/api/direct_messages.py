from instagrapi import Client as InstaClient
from typing import Dict, List, Tuple, Protocol
from ..cache import CacheManager

class ClientWrapper(Protocol):
    insta_client: InstaClient
    cache_manager: CacheManager

class DirectMessages:
    def __init__(self, client: ClientWrapper):
        self.client = client
        self.chats: Dict[str, DirectChat] = {}
        self.client.cache_manager.load_cache()
    
    def fetch_chat_data(self, num_chats: int, num_message_limit: int):
        """
        Fetch chat list and history from API.
        Parameters:
        - num_chats: Number of chats to fetch.
        - num_message_limit: Max number of messages to fetch per chat.

        Returns a dictionary of DirectChat objects.
        """
        self.chats = {thread.id: DirectChat(self.client, thread.id, thread) for thread in self.client.insta_client.direct_threads(amount=num_chats, thread_message_limit=num_message_limit)}
        self.client.cache_manager.dump_cache()
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
        
        # Make sure user infos are cached
        for user in self.thread.users:
            try:
                self.client.cache_manager.get_user_from_id(int(user.pk), fetch_mode=CacheManager.CACHE | CacheManager.PRIVATE_API)
            except Exception:
                pass
        self.client.cache_manager.get_user_from_id(self.client.insta_client.user_id, fetch_mode=CacheManager.CACHE | CacheManager.PRIVATE_API)
    
    def fetch_chat_history(self, num_messages: int):
        """
        Fetch chat history for the thread.
        Parameters:
        - num_messages: Number of messages to fetch.
        """
        self.thread.messages = self.client.insta_client.direct_messages(self.thread_id, amount=num_messages)
    
    def get_chat_history(self) -> List[str]:
        """
        Return list of messages in the chat history.
        """
        chat = []
        for message in self.thread.messages:
            try:
                userid = int(message.user_id)
            except ValueError:
                pass
            if userid == self.client.insta_client.user_id:
                chat.append(f"You: {message.text if message.item_type=='text' else '[Media]'}")
            else:
                user = self.client.cache_manager.get_user_from_id(userid)
                name = user.full_name
                if not name:
                    name = user.username
                if not name:
                    name = "Unknown User"
                chat.append(f"{name}: {message.text if message.item_type=='text' else '[Media]'}")
        chat.reverse() # Reverse the order to show latest messages at the bottom
        return chat

    def send_text(self, message: str):
        """
        Send a text message to the chat.
        Parameters:
        - message: Text message to send.
        """

        self.client.insta_client.direct_answer(self.thread_id, message)
        return f"You: {message}"
    
    def mark_as_seen(self):
        self.client.insta_client.direct_send_seen(self.thread_id)
    
    def is_seen(self) -> bool:
        return self.thread.is_seen(self.client.insta_client.user_id)