from instagrapi import Client as InstaClient
from typing import Dict, List, Tuple, Protocol

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
        
        self.users_info_cache = {}
        for user in self.thread.users:
            try:
                self.users_info_cache[self.client.insta_client.user_id_from_username(user.username)] = user
            except Exception:
                pass
        self.users_info_cache[self.client.insta_client.user_id] = self.client.insta_client.user_info(self.client.insta_client.user_id)
    
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
                chat.append(f"{self.users_info_cache[message.user_id].full_name if self.users_info_cache.get(message.user_id, None) else 'Instagram User'}: {message.text if message.item_type=='text' else '[Media]'}")
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
    
    def send_photo(self, path: str):
        """
        Send a photo to the chat.
        Parameters:
        - path: Path to the photo file.
        """
        self.client.insta_client.direct_send_photo(path, thread_id=self.thread_id)
    
    def send_video(self, path: str):
        """
        Send a video to the chat. Auto generate a thumbnail.
        Parameters:
        - path: Path to the video file.
        """
        self.client.insta_client.direct_send_video(path, thread_id=self.thread_id)

    def mark_as_seen(self):
        self.client.insta_client.direct_send_seen(self.thread_id)
    
    def is_seen(self) -> bool:
        return self.thread.is_seen(self.client.insta_client.user_id)