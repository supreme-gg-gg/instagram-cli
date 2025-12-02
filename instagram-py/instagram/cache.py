from copy import deepcopy
from typing import Dict, Protocol
import instagrapi
import instagrapi.exceptions
import instagrapi.types
from instagram.configs import Config
import os
import shutil
import pickle


class ClientWrapper(Protocol):
    insta_client: instagrapi.Client


class CacheManager:
    # Binary flags for cache usage
    CACHE = 0b01
    PUBLIC_API = 0b10
    PRIVATE_API = 0b100

    def __init__(self, client: ClientWrapper):
        self.client = client
        self.config = Config()
        self.userid_user_cache: Dict[int, instagrapi.types.User] = {}
        self.username_user_cache: Dict[str, instagrapi.types.User] = {}

    def dump_cache(self):
        cache_dir = self.secure_cache_dir()

        with open(os.path.join(cache_dir, "userid_user.pkl"), "wb") as f:
            pickle.dump(self.userid_user_cache, f)
        with open(os.path.join(cache_dir, "username_user.pkl"), "wb") as f:
            pickle.dump(self.username_user_cache, f)

    def load_cache(self):
        cache_dir = self.secure_cache_dir()

        try:
            with open(os.path.join(cache_dir, "userid_user.pkl"), "rb") as f:
                self.userid_user_cache = pickle.load(f)
            with open(os.path.join(cache_dir, "username_user.pkl"), "rb") as f:
                self.username_user_cache = pickle.load(f)
        except (pickle.PickleError, FileNotFoundError):
            self.clear_cache()

    def clear_cache(self, full: bool = False):
        self.userid_user_cache.clear()
        self.username_user_cache.clear()

        if full:
            # clear cache directory (rm -rf)
            cache_dir = self.secure_cache_dir()
            shutil.rmtree(cache_dir)
            os.makedirs(cache_dir)

    def secure_cache_dir(self):
        cache_dir = self.config.get("advanced.cache_dir")
        if not cache_dir:
            raise ValueError(
                "Cache directory not set. Please set 'advanced.cache_dir' in config.yaml."
            )
        cache_dir = os.path.join(cache_dir, self.client.insta_client.username)
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
        return cache_dir

    def get_username_from_id(
        self, user_id: int, fetch_mode: int = CACHE | PUBLIC_API
    ) -> str | None:
        user = self.get_user_from_id(user_id, fetch_mode)
        return user.username if user is not None else None

    def get_id_from_username(
        self, username: str, fetch_mode: int = CACHE | PUBLIC_API
    ) -> int | None:
        user = self.get_user_from_username(username, fetch_mode)
        return int(user.pk) if user is not None else None

    def get_user_from_id(
        self, user_id: int, fetch_mode: int = CACHE | PUBLIC_API | PRIVATE_API
    ) -> instagrapi.types.User | None:
        user_id = str(user_id)
        if not (fetch_mode & self.CACHE) or user_id not in self.userid_user_cache:
            try:
                if not (fetch_mode & self.PUBLIC_API):
                    raise instagrapi.exceptions.ClientError()
                try:
                    user = self.client.insta_client.user_info_gql(user_id)
                except instagrapi.exceptions.ClientLoginRequired as e:
                    if not self.client.insta_client.inject_sessionid_to_public():
                        raise e
                    user = self.client.insta_client.user_info_gql(user_id)  # retry
            except Exception as e:
                if not isinstance(e, instagrapi.exceptions.ClientError):
                    self.client.insta_client.logger.exception(e)
                if fetch_mode & self.PRIVATE_API:
                    try:
                        user = self.client.insta_client.user_info_v1(user_id)
                    except instagrapi.exceptions.UserNotFound:
                        return None
                else:
                    return None
            self.client.insta_client._users_cache[user_id] = user
            self.client.insta_client._usernames_cache[user.username] = user.pk
            self.userid_user_cache[user_id] = deepcopy(user)
        return deepcopy(
            self.userid_user_cache[user_id]
        )  # return copy of cache (dict changes protection)

    def get_user_from_username(
        self, username: str, fetch_mode: int = CACHE | PUBLIC_API | PRIVATE_API
    ) -> instagrapi.types.User | None:
        username = str(username).lower()
        self.client.insta_client.user_info_by_username
        if (not fetch_mode & self.CACHE) or username not in self.username_userid_cache:
            try:
                if fetch_mode & self.PUBLIC_API:
                    try:
                        user = self.client.insta_client.user_info_by_username_gql(
                            username
                        )
                    except instagrapi.exceptions.ClientLoginRequired as e:
                        if not self.client.insta_client.inject_sessionid_to_public():
                            raise e
                        user = self.client.insta_client.user_info_by_username_gql(
                            username
                        )  # retry
                else:
                    raise instagrapi.exceptions.ClientError()
            except Exception as e:
                if not isinstance(e, instagrapi.exceptions.ClientError):
                    self.client.insta_client.logger.exception(
                        e
                    )  # Register unknown error
                if fetch_mode & self.PRIVATE_API:
                    try:
                        user = self.client.insta_client.user_info_by_username_v1(
                            username
                        )
                    except instagrapi.exceptions.UserNotFound:
                        return None
                else:
                    return None
            self.username_user_cache[username] = user
        return deepcopy(self.username_user_cache[username])
