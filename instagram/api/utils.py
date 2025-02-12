from instagrapi import Client
from instagrapi.exceptions import ClientError, UserNotFound
from instagrapi.types import User

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
