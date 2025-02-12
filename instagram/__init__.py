from .auth import login, logout
from .chat_ui import start_chat
from .commands import CommandRegistry
from .configs import Config
from .client import cleanup

__all__ = ["login", "logout", "start_chat", "CommandRegistry", "Config", "cleanup"]

# import logging
# logging.basicConfig(level=logging.ERROR)

__version__ = "1.0.0"
