from instagrapi import Client
from instagrapi.exceptions import ClientError, UserNotFound, DirectThreadNotFound, ClientNotFoundError
from instagrapi.types import User, DirectThread, DirectMessage
from instagrapi.extractors import extract_direct_thread
from typing import Tuple

import logging

def setup_logging(name: str):
    """
    Logging is the de-facto standard for debugging in this project.
    This is because you can't simply print to console when running terminal app lol.
    This function sets up logging for the file with the given name.
    """
    logging.basicConfig(filename="debug.log", level=logging.DEBUG)

    # Configure logging to only capture logs from this script
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)  # Set desired log level

    # Optional: Define log format
    formatter = logging.Formatter('%(levelname)s: %(message)s')

    # Create file handler
    file_handler = logging.FileHandler('debug.log')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    # Apply handler to your logger
    logger.addHandler(file_handler)

    # Disable all other loggers (dependencies) 
    logging.getLogger().setLevel(logging.CRITICAL)

    return logger


def user_info_by_username_private(self: Client, username: str, use_cache: bool = True) -> User:
    """
    Get user object from username

    This is a modified version of the user_info_by_username method from the instagrapi library and only uses private API for faster results.

    Parameters
    ----------
    self: Client
        The instagrapi Client object
    username: str
        User name of an instagram account
    use_cache: bool, optional
        Whether or not to use information from cache, default value is True

    Returns
    -------
    User
        An object of User type
    """
    username = str(username).lower()
    if not use_cache or username not in self._usernames_cache:
        user = self.user_info_by_username_v1(username)
        self._users_cache[user.pk] = user
        self._usernames_cache[user.username] = user.pk
    return self.user_info(self._usernames_cache[username])

def direct_thread_chunk(self: Client, thread_id: int, amount: int = 20, cursor: str = None) -> Tuple[DirectThread, str]:
    """
    Get a chunk of messages in a direct message thread along with the thread's metadata

    This is a modified version of the direct_thread method from the instagrapi library.

    Parameters
    ----------
    thread_id: int
        Unique identifier of a Direct Message thread

    amount: int, optional
        Minimum number of media to return, default is 20
    
    cursor: str, optional
        Cursor for pagination, default is None

    Returns
    -------
    Tuple[DirectThread, str]
        A tuple containing the DirectThread object and the cursor for the next chunk of messages
    """
    assert self.user_id, "Login required"
    params = {
        "visual_message_return_type": "unseen",
        "direction": "older",
        "seq_id": "40065",  # 59663
        "limit": "20",
    }
    items = []
    while True:
        if cursor:
            params["cursor"] = cursor
        try:
            result = self.private_request(
                f"direct_v2/threads/{thread_id}/", params=params
            )
        except ClientNotFoundError as e:
            raise DirectThreadNotFound(e, thread_id=thread_id, **self.last_json)
        thread = result["thread"]
        for item in thread["items"]:
            items.append(item)
        cursor = thread.get("oldest_cursor")
        if not cursor or not thread.get("has_older", False) or (amount and len(items) >= amount):
            break
    # We don't want to slice items here because it will break the pagination
    # if amount:
    #     items = items[:amount]
    thread["items"] = items
    return (extract_direct_thread(thread), cursor)
