from enum import Enum, auto
from typing import NamedTuple


class LineInfo(NamedTuple):
    """Named tuple to store line information for chat messages."""

    message_idx: str
    text: str
    is_selected: bool
    color_idx: int
    sender_width: int
    sender_text: str
    is_dimmed: bool


class ChatMode(Enum):
    """Enum to represent the different modes of the chat interface."""

    CHAT = auto()
    COMMAND = auto()
    COMMAND_RESULT = auto()
    REPLY = auto()
    UNSEND = auto()


class Signal(Enum):
    """
    Enum to represent continue or quit chat.
    NOTE: Please use this instead of True/False to avoid confusion.
    """

    CONTINUE = auto()
    BACK = auto()
    QUIT = auto()


class ChatMenuMode(Enum):
    """Enum to represent different modes of the chat menu."""

    DEFAULT = auto()
    SEARCH_USERNAME = auto()
    SEARCH_TITLE = auto()
