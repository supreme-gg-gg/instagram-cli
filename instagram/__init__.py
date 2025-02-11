from .auth import login, logout
from .chat_ui import start_chat
from .commands import CommandRegistry
from .configs import Config

__all__ = ["login", "logout", "start_chat", "CommandRegistry", "Config"]

# import logging
# logging.basicConfig(level=logging.ERROR)

__version__ = "1.0.0"
