from instagrapi import Client
from instagrapi.exceptions import ClientError, UserNotFound
from instagrapi.types import User

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
