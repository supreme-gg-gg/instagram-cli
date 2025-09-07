import curses
from typing import List, Optional
from ..utils.types import LineInfo, ChatMode
from instagram.api import MessageInfo
from instagram.configs import Config


class ChatWindow:
    """Handles chat message display and formatting."""

    def __init__(self, window, height: int, width: int):
        self.window = window
        self.height = height
        self.width = width
        self.mode = ChatMode.CHAT
        self.messages: List[MessageInfo] = []
        self.messages_lines: List[LineInfo] = []
        self.selection = 0
        self.selected_message_id = None
        self.scroll_offset = 0
        self.visible_messages_range = None
        self.visible_lines_range = None
        self.custom_content: Optional[str] = None

    def set_messages(
        self, messages: List[MessageInfo]
    ):  # Ensure this shall be run within refresh_lock
        """Update messages list."""
        self.messages = messages
        self._build_message_lines()

    def set_custom_content(self, content: str):
        """Set custom content to be displayed in the chat window."""
        self.custom_content = content
        self.update()

    def clear_custom_content(self):
        """Clear custom content."""
        self.custom_content = None
        self.update()

    def _build_message_lines(self):
        """
        Build wrapped lines for chat messages with word wrapping and formatting.
        """
        lines_buffer: List[LineInfo] = []

        # Build wrapped lines from oldest to newest
        for msg_idx, msg in enumerate(self.messages):
            sender_text = msg.message.sender + ": "
            sender_width = len(sender_text)

            # Handle the main message
            content_width = self.width - sender_width - 1
            is_selected = msg_idx == self.selection and self.mode in [
                ChatMode.REPLY,
                ChatMode.UNSEND,
            ]

            # Determine color index
            if Config().get("chat.colors"):
                color_idx = (hash(msg.message.sender) % 3) + 4
            else:
                color_idx = 0  # no color

            # Split content into words, then chunk
            content_text = msg.message.content
            # Append status suffix for pending/failed messages
            if getattr(msg, "pending", False):
                content_text = content_text + " (sending...)"
            if getattr(msg, "failed", False):
                content_text = content_text + " [FAILED :(  ]"

            words = content_text.split()
            line_buffer = []
            current_width = 0
            first_line = True

            def flush_line():
                if line_buffer:
                    line_text = " ".join(line_buffer)
                    if first_line:
                        lines_buffer.append(
                            (
                                msg_idx,
                                line_text,
                                is_selected,
                                color_idx,
                                sender_width,
                                sender_text,
                                False,
                            )
                        )
                    else:
                        lines_buffer.append(
                            (
                                msg_idx,
                                line_text,
                                is_selected,
                                color_idx,
                                sender_width,
                                " " * sender_width,
                                False,
                            )
                        )

            for word in words:
                space_needed = 1 if line_buffer else 0
                if current_width + len(word) + space_needed <= content_width:
                    line_buffer.append(word)
                    current_width += len(word) + space_needed
                else:
                    flush_line()
                    line_buffer = [word]
                    current_width = len(word)
                    first_line = False

            # Flush remaining line buffer
            flush_line()

            # Handle reply-to message if present
            if msg.reply_to:
                reply_sender = msg.reply_to.sender + ": "
                reply_indent = " " * sender_width + "| "
                max_reply_content = (
                    self.width - len(reply_sender) - len(reply_indent) - 1
                )
                reply_content = msg.reply_to.content
                reply_content = reply_content.replace("\n", " ")
                if len(reply_content) > max_reply_content:
                    reply_content = reply_content[: max_reply_content - 3] + "..."
                reply_line = reply_indent + reply_sender + reply_content
                lines_buffer.append((msg_idx, reply_line, False, 0, 0, "", True))

            # Add reactions if present
            if msg.reactions:
                reaction_text = " " * sender_width
                reaction_list = []
                for reaction, count in msg.reactions.items():
                    reaction_list.append(f"{reaction}x{count}")
                reaction_line = reaction_text + " ".join(reaction_list)
                lines_buffer.append((msg_idx, reaction_line, False, 0, 0, "", True))

            # Add a blank line after each message if layout not compact
            if Config().get("chat.layout") != "compact":
                lines_buffer.append((msg_idx, "", False, 0, 0, "", False))
        self.messages_lines = lines_buffer

    def update(self):
        """
        Write chat messages to the chat window with:
        - Rendering messages from bottom up
        - Basic word wrapping
        - Colored sender names
        - Replies and reactions

        If custom content is set, it overrides the default message rendering.
        """
        if self.custom_content:
            self.window.erase()
            content_lines = []
            for raw_line in self.custom_content.split("\n"):
                while len(raw_line) > self.width:
                    content_lines.append(raw_line[: self.width])
                    raw_line = raw_line[self.width :]
                content_lines.append(raw_line)
            # Only display up to available height
            for i, line in enumerate(content_lines[: self.height]):
                self.window.addstr(i, 0, line[: self.width])
            self.window.refresh()
            return

        if not self.messages:
            return

        self.window.erase()

        # Initialize colors for sender names and dimmed text
        curses.init_pair(4, curses.COLOR_RED, curses.COLOR_BLACK)
        curses.init_pair(5, curses.COLOR_BLUE, curses.COLOR_BLACK)
        curses.init_pair(6, curses.COLOR_GREEN, curses.COLOR_BLACK)
        curses.init_pair(9, curses.COLOR_WHITE, curses.COLOR_BLACK)  # For dimmed text

        # First pass to build message lines
        self._build_message_lines()

        # Update visible messages range
        self.visible_lines_range = [
            max(0, len(self.messages_lines) - self.height - self.scroll_offset),
            max(0, len(self.messages_lines) - 1 - self.scroll_offset),
        ]
        self.visible_messages_range = [
            self.messages_lines[self.visible_lines_range[0]][0],
            self.messages_lines[self.visible_lines_range[1]][0],
        ]  # msg_idxd

        # Now print from the bottom up
        current_line = self.height - 1
        for (
            msg_idx,
            content,
            is_selected,
            color_idx,
            sender_width,
            sender_text,
            is_dimmed,
        ) in reversed(
            self.messages_lines[
                self.visible_lines_range[0] : self.visible_lines_range[1] + 1
            ]
        ):
            if current_line < 0:
                # Update visible messages range
                self.visible_messages_range[0] = msg_idx
                break

            if is_selected:
                self.window.attron(curses.A_REVERSE)
            if is_dimmed:
                self.window.attron(curses.color_pair(9) | curses.A_DIM)

            if color_idx and not is_dimmed:
                self.window.attron(curses.color_pair(color_idx) | curses.A_BOLD)
                self.window.addstr(current_line, 0, sender_text[: self.width - 1])
                self.window.attroff(curses.color_pair(color_idx) | curses.A_BOLD)
            else:
                self.window.addstr(current_line, 0, sender_text[: self.width - 1])

            self.window.addstr(
                current_line, sender_width, content[: self.width - sender_width - 1]
            )

            if is_selected:
                self.window.attroff(curses.A_REVERSE)
            if is_dimmed:
                self.window.attroff(curses.color_pair(9) | curses.A_DIM)

            current_line -= 1

        self.window.refresh()
