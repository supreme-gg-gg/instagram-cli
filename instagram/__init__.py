from .auth import login, logout
from .chat import start_chat
from .configs import Config
from .client import cleanup
from .cli import app

__all__ = ["login", "logout", "start_chat", "Config", "cleanup", "app"]

# import logging
# logging.basicConfig(level=logging.ERROR)

__version__ = "1.0.0"
