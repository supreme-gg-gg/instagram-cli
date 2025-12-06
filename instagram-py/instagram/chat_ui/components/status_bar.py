import curses
from ..utils.types import ChatMode


class StatusBar:
    """Handles status bar display and updates."""

    def __init__(self, window):
        self.window = window
        self.height, self.width = window.getmaxyx()
        self.mode = ChatMode.CHAT
        self._setup_colors()

    def _setup_colors(self):
        """Initialize color pairs for different modes."""
        curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_YELLOW)  # Chat
        curses.init_pair(2, curses.COLOR_BLACK, curses.COLOR_CYAN)  # Command
        curses.init_pair(3, curses.COLOR_BLACK, curses.COLOR_GREEN)  # Reply
        curses.init_pair(10, curses.COLOR_WHITE, curses.COLOR_RED)  # Unsend

    def update(self, msg: str = None, override_default: bool = False):
        """
        Update the status bar based on the current mode.
        """
        self.window.erase()
        if override_default:
            status_text = msg
        elif self.mode == ChatMode.CHAT:
            self.window.bkgd(" ", curses.color_pair(1))
            status_text = (
                "[CHAT] Type :help for commands, :back to return, :quit to exit"
            )
        elif self.mode == ChatMode.REPLY:
            self.window.bkgd(" ", curses.color_pair(3))
            status_text = "[REPLY] Use ↑↓ to select, Enter to confirm, Esc to exit"
        elif self.mode == ChatMode.UNSEND:
            self.window.bkgd(" ", curses.color_pair(10))
            status_text = "[UNSEND] Use ↑↓ to select, Enter to confirm, Esc to exit"
        elif self.mode == ChatMode.COMMAND:
            self.window.bkgd(" ", curses.color_pair(2))
            status_text = f"[COMMAND] Executing command {msg if msg else '...'}"
        elif self.mode == ChatMode.COMMAND_RESULT:
            self.window.bkgd(" ", curses.color_pair(2))
            status_text = "[COMMAND RESULT] Press any key to return to chat"
        else:
            status_text = "Georgian mode"

        self.window.addstr(0, 0, status_text[: self.width - 1])
        self.window.refresh()
