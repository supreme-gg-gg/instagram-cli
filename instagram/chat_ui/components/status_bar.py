import curses
import threading
import time
from ..utils.types import ChatMode


class StatusBar:
    """Handles status bar display and updates."""

    def __init__(self, window):
        self.window = window
        self.height, self.width = window.getmaxyx()
        self.mode = ChatMode.CHAT
        # Spinner control
        self._spinner_thread: threading.Thread | None = None
        self._spinner_stop: threading.Event | None = None
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
            status_text = f"[COMMAND] Command {msg} executed. Press any key to continue"
        else:
            status_text = "Georgian mode"

        self.window.addstr(0, 0, status_text[: self.width - 1])
        self.window.refresh()

    def start_spinner(self, base_msg: str = "Sending", interval: float = 0.3):
        """Start a spinner in the status bar with an animated dot sequence.

        The spinner runs in a daemon thread and will repeatedly call
        update(..., override_default=True) with growing dots until stopped.
        """
        # Stop any existing spinner
        self.stop_spinner()

        stop_event = threading.Event()
        self._spinner_stop = stop_event

        def _spin():
            i = 0
            try:
                while not stop_event.is_set():
                    dots = "." * (i % 4)
                    msg = f"{base_msg}{dots}"
                    # Use update to render the override message
                    try:
                        self.update(msg=msg, override_default=True)
                    except Exception:
                        # Suppress curses errors if window size changes
                        pass
                    i += 1
                    time.sleep(interval)
            finally:
                # Clear spinner when exiting
                try:
                    self.update()
                except Exception:
                    pass

        t = threading.Thread(target=_spin, daemon=True)
        self._spinner_thread = t
        t.start()

    def stop_spinner(self):
        """Stop the spinner if running and restore status bar."""
        if self._spinner_stop is not None:
            try:
                self._spinner_stop.set()
            except Exception:
                pass
            self._spinner_stop = None
        if self._spinner_thread is not None:
            # thread is daemon; just clear reference
            self._spinner_thread = None
