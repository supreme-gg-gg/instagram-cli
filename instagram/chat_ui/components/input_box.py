import curses
import locale

locale.setlocale(locale.LC_ALL, "")


class InputBox:
    """
    A multi-line input box component that handles cursor movements, text editing,
    and vertical expansion.
    """

    def __init__(self, window, x: int, y: int, width: int, max_height: int = 5):
        self.window = window
        self.x = x
        self.y = y
        self.width = width
        self.max_height = max_height
        self.buffer = []  # List of characters
        self.cursor_pos = 0
        self.scroll_offset = 0  # For vertical scrolling
        self.current_height = 1  # Current height of content
        self.last_height = 1  # Track previous height for cleanup
        self.placeholder = "Type a message..."  # Add placeholder text

    def _calculate_cursor_position(self) -> tuple[int, int]:
        """Calculate the cursor's row and column position"""
        text_before_cursor = "".join(self.buffer[: self.cursor_pos])
        lines = self._wrap_text(text_before_cursor)

        if not lines:
            return 0, 0

        row = len(lines) - 1
        col = len(lines[-1])
        return row, col

    def _wrap_text(self, text: str) -> list[str]:
        """Wrap text into lines based on window width"""
        lines = []
        visible_width = self.width - 2
        current_line = []
        current_width = 0

        for char in text:
            if char == "\n":
                lines.append("".join(current_line))
                current_line = []
                current_width = 0
                continue

            if current_width >= visible_width:
                lines.append("".join(current_line))
                current_line = []
                current_width = 0

            current_line.append(char)
            current_width += 1

        if current_line:
            lines.append("".join(current_line))

        return lines

    def handle_key(self, key: int | str) -> str | None:
        """Handle a keypress with support for multi-line input"""
        if key in ["\n", "\r", curses.KEY_ENTER]:
            # Send message if Enter is pressed in end of message,
            # otherwise add new line
            if self.cursor_pos < len(self.buffer):
                self.buffer.insert(self.cursor_pos, "\n")
                self.cursor_pos += 1
                self._adjust_scroll()
            else:
                res = "".join(self.buffer)
                if len(res.strip()) == 0:
                    return None
                return res

        elif key in (curses.KEY_BACKSPACE, 127):
            if self.cursor_pos > 0:
                self.buffer.pop(self.cursor_pos - 1)
                self.cursor_pos -= 1
                self._adjust_scroll()

        elif key == curses.KEY_DC:  # Delete
            if self.cursor_pos < len(self.buffer):
                self.buffer.pop(self.cursor_pos)
                self._adjust_scroll()

        elif key == curses.KEY_LEFT:
            if self.cursor_pos > 0:
                self.cursor_pos -= 1
                self._adjust_scroll()

        elif key == curses.KEY_RIGHT:
            if self.cursor_pos < len(self.buffer):
                self.cursor_pos += 1
                self._adjust_scroll()

        elif key == curses.KEY_UP:
            row, col = self._calculate_cursor_position()
            if row > 0:
                # Move cursor to previous line
                target_pos = self._get_position_from_rowcol(row - 1, col)
                self.cursor_pos = target_pos
                self._adjust_scroll()

        elif key == curses.KEY_DOWN:
            row, col = self._calculate_cursor_position()
            # Move cursor to next line if it exists
            target_pos = self._get_position_from_rowcol(row + 1, col)
            if target_pos is not None:
                self.cursor_pos = target_pos
                self._adjust_scroll()

        elif key == curses.KEY_HOME:
            # Move to start of current line
            row, _ = self._calculate_cursor_position()
            self.cursor_pos = self._get_position_from_rowcol(row, 0)
            self._adjust_scroll()

        elif key == curses.KEY_END:
            # Move to end of current line
            row, _ = self._calculate_cursor_position()
            next_row_start = self._get_position_from_rowcol(row + 1, 0)
            if next_row_start is None:
                self.cursor_pos = len(self.buffer)
            else:
                self.cursor_pos = next_row_start - 1
            self._adjust_scroll()

        else:
            try:
                if isinstance(key, int):
                    # Filter out control characters but allow other Unicode characters
                    if not (0 <= key <= 31 or key == 127):
                        self.buffer.insert(self.cursor_pos, chr(key))
                        self.cursor_pos += 1
                        self._adjust_scroll()
                else:  # string
                    for char in key:
                        if char.isprintable():
                            self.buffer.insert(self.cursor_pos, char)
                            self.cursor_pos += 1
                            self._adjust_scroll()
            except ValueError:
                # Ignore invalid Unicode values
                pass

        return None

    def _get_position_from_rowcol(self, row: int, col: int) -> int | None:
        """Convert row and column position to buffer index"""
        text = "".join(self.buffer)
        lines = self._wrap_text(text)

        if row < 0 or row >= len(lines):
            return None

        pos = 0
        for i in range(row):
            pos += len(lines[i]) + 1  # +1 for newline

        pos = min(pos + col, len(self.buffer))
        return pos

    def _adjust_scroll(self):
        """Adjust vertical scroll position to keep cursor visible"""
        row, _ = self._calculate_cursor_position()
        visible_height = self.max_height

        if row < self.scroll_offset:
            self.scroll_offset = row
        elif row >= self.scroll_offset + visible_height:
            self.scroll_offset = row - visible_height + 1

    def draw(self):
        """Draw the multi-line input box and its contents"""
        text = "".join(self.buffer)
        lines = self._wrap_text(text)

        # Calculate actual height needed (limited by max_height)
        self.current_height = min(max(len(lines), 1), self.max_height)

        # Clear previous expanded area if box is shrinking
        if self.current_height < self.last_height:
            self.window.erase()
            self.window.refresh()

        # Calculate bottom-aligned position
        base_y = self.y + self.max_height - self.current_height
        self.window.resize(self.current_height + 2, self.width)
        self.window.mvwin(base_y - 1, self.x)
        self.window.erase()
        self.window.border()

        # Draw placeholder if empty
        if not self.buffer:
            self.window.attron(curses.A_DIM)
            self.window.addstr(1, 1, self.placeholder[: self.width - 2])
            self.window.attroff(curses.A_DIM)
        else:
            # Draw visible lines
            for i, line in enumerate(
                lines[self.scroll_offset : self.scroll_offset + self.current_height]
            ):
                self.window.addstr(i + 1, 1, line[: self.width - 2])

        # Position cursor
        row, col = self._calculate_cursor_position()
        cursor_y = row - self.scroll_offset + 1
        cursor_x = col + 1

        if 0 <= cursor_y <= self.current_height:
            self.window.move(cursor_y, cursor_x)

        self.window.refresh()
        self.last_height = self.current_height  # Update last height

    def clear(self):
        """Clear the input buffer and reset dimensions"""
        self.buffer.clear()
        self.cursor_pos = 0
        self.scroll_offset = 0

        if 1:
            self.window.erase()
            self.window.refresh()

        self.current_height = 1
        self.last_height = 1
        self.draw()
