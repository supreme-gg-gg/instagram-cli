from .auth import login, logout
from .chat_ui import start_chat

__all__ = ["login", "logout", "start_chat"]

import logging
logging.basicConfig(level=logging.ERROR)

__version__ = "1.0.0"
