from .auth import login, logout
from .chat import start_chat
from .configs import Config
from .client import cleanup
from . import api

__all__ = ["login", "logout", "start_chat", "Config", "cleanup", "api"]

def get_app():
    from .cli import app
    return app

__version__ = "1.2.6"
