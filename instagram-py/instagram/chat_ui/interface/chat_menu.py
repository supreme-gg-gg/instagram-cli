import curses
from instagram.api.direct_messages import (
    DirectMessages,
    DirectChat,
    DirectThreadNotFound,
)
from ..utils.types import Signal, ChatMenuMode


class ChatMenu:
    """
    Display the chat list and allow the user to select one.
    """

    def __init__(self, screen, dm: DirectMessages):
        """
        Initialize the chat menu.

        Parameters:
        - screen: Curses screen object
        - dm: DirectMessages object with a list of chats
        """
        self.screen = screen
        self.dm = dm
        self.chats = dm.chats
        self.selection = 0
        self.scroll_offset = 0
        self.height, self.width = screen.getmaxyx()
        self.search_query = ""
        self.placeholder = "Search for chat by @username or /title + ENTER"
        self.mode = ChatMenuMode.DEFAULT  # Flag to track if search is active

        self._setup_windows()

    def _setup_windows(self):
        """Initialize UI components."""
        curses.start_color()
        curses.init_pair(7, curses.COLOR_BLACK, curses.COLOR_YELLOW)
        curses.init_pair(8, curses.COLOR_RED, curses.COLOR_BLACK)

        curses.curs_set(1)
        self.screen.keypad(True)

        # Create search window
        self.search_win = curses.newwin(3, self.width, self.height - 4, 0)
        self.search_query = ""

        # Static footer
        self.footer = curses.newwin(1, self.width, self.height - 1, 0)

    def _draw_footer(self, message: str = None):
        """Draw the footer with status message."""
        self.footer.erase()
        self.footer.bkgd(" ", curses.color_pair(7))
        if message is None:
            if self.mode == ChatMenuMode.SEARCH_USERNAME:
                message = "[SEARCH MODE] Username + ENTER to search, ESC to cancel"
            elif self.mode == ChatMenuMode.SEARCH_TITLE:
                message = "[SEARCH MODE] Title + ENTER to search, ESC to cancel"
            elif self.mode == ChatMenuMode.DEFAULT:
                message = "[CHAT MENU] Select a chat (Arrow/jk + ENTER, or ESC to quit)"
            else:
                message = "[GEORGIAN MODE] გამარჯობა და გასართობა"
        self.footer.addstr(0, 0, message[: self.width - 1])
        self.footer.refresh()

    def _draw_screen(self):
        """Draw the main chat list screen."""
        self.screen.clear()

        # Adjust visible height to account for permanent search box
        visible_height = self.height - 6  # 4 for search box, 1 for footer, 1 for buffer

        for idx, chat in enumerate(self.chats):
            title = chat.get_title()
            is_seen = chat.seen
            x_pos = 2

            # Ensure we don't exceed window boundaries
            if 0 <= idx - self.scroll_offset < visible_height:
                if idx == self.selection:
                    self.screen.attron(curses.A_REVERSE)
                    self.screen.addstr(
                        idx - self.scroll_offset, 0, " " * (self.width - 1)
                    )
                    self.screen.addstr(
                        idx - self.scroll_offset, x_pos, title[: self.width - x_pos - 1]
                    )
                    self.screen.attroff(curses.A_REVERSE)
                else:
                    if is_seen is not None and is_seen == 1:
                        self.screen.attron(curses.color_pair(8) | curses.A_BOLD)
                        self.screen.addstr(
                            idx - self.scroll_offset,
                            x_pos,
                            "→ " + title[: self.width - x_pos - 3],
                        )
                        self.screen.attroff(curses.color_pair(8) | curses.A_BOLD)
                    else:
                        self.screen.addstr(
                            idx - self.scroll_offset,
                            x_pos,
                            title[: self.width - x_pos - 1],
                        )

    def _draw_search_bar(self):
        """Draw the search input box."""
        self.search_win.erase()
        self.search_win.border()

        # Show placeholder or actual search query
        display_text = (
            self.search_query
            if (self.mode != ChatMenuMode.DEFAULT)
            else self.placeholder
        )
        if self.mode == ChatMenuMode.DEFAULT:
            self.search_win.attron(curses.A_DIM)
        self.search_win.addstr(1, 2, display_text[: self.width - 4])
        if self.mode == ChatMenuMode.DEFAULT:
            self.search_win.attroff(curses.A_DIM)

        # Move cursor to end of input if in search mode
        if self.mode != ChatMenuMode.DEFAULT:
            cursor_pos = len(self.search_query) + 2
            self.search_win.move(1, cursor_pos)

    def _refresh_ui(self):
        """Refresh all UI components."""
        self._draw_screen()
        self._draw_search_bar()
        self.screen.refresh()
        self.search_win.refresh()
        self._draw_footer()

        # If in search mode, ensure cursor is in search window
        if self.mode != ChatMenuMode.DEFAULT:
            cursor_pos = len(self.search_query) + 2
            self.search_win.move(1, cursor_pos)
            self.search_win.refresh()

    def _handle_navigation(self, key):
        """Handle navigation key presses."""
        if key == curses.KEY_UP:
            if self.selection - self.scroll_offset == 0:
                if self.scroll_offset > 0:
                    self.selection -= 1
                    self.scroll_offset -= 1
            elif self.selection > 0:
                self.selection -= 1
        elif key == curses.KEY_DOWN:
            if self.selection == len(self.chats) - 1:
                # Fetch more DMs
                self._draw_footer("Loading more chats...")
                self.dm.fetch_next_chat_chunk(20, 20)
                self.chats = self.dm.chats
            if self.selection - self.scroll_offset == self.height - 7:
                if self.selection - self.scroll_offset == self.height - 7:
                    self.selection += 1
                    self.scroll_offset += 1
            elif self.selection < len(self.chats) - 1:
                self.selection += 1

    def _handle_search(self, query):
        """
        Process account search query and return results.
        The query should NOT contains the '@' prefix.
        """
        if not query:
            return None

        try:
            # Show searching indicator
            self._draw_footer("Searching...")

            # Perform search
            search_result = None
            if self.mode == ChatMenuMode.SEARCH_USERNAME:
                search_result = self.dm.search_by_username(query)
            elif self.mode == ChatMenuMode.SEARCH_TITLE:
                search_result = self.dm.search_by_title(query)
            if search_result:
                self.mode = ChatMenuMode.DEFAULT
                self.search_query = ""
                return search_result
            else:
                # Show "No results" briefly
                if self.mode == ChatMenuMode.SEARCH_USERNAME:
                    self._draw_footer(f"No results found for @{query}")
                else:
                    self._draw_footer(f'No results found for "{query}"')
                curses.napms(1500)  # Show for 1.5 seconds
        except DirectThreadNotFound:
            # Show "No results" briefly
            if self.mode == ChatMenuMode.SEARCH_USERNAME:
                self._draw_footer(f"No results found for @{query}")
            else:
                self._draw_footer(f'No results found for "{query}"')
            curses.napms(1500)  # Show for 1.5 seconds
        except Exception as e:
            # Show error briefly
            self._draw_footer(f"Search error: {repr(e)}")
            curses.napms(1500)

        # Clear search input and exit search mode
        self.mode = ChatMenuMode.DEFAULT
        self.search_query = ""
        self._draw_footer()
        return None

    def _select_chat(self):
        """Select the current chat and return it."""
        if self.chats:
            # Clear the screen here to prevent any artifacts from carrying on to the chat UI
            self.screen.clear()
            self.screen.refresh()
            return self.chats[self.selection]
        return None

    def _handle_input(self):
        """Handle user input for navigation and search."""
        # If in search mode, handle search input
        if self.mode != ChatMenuMode.DEFAULT:
            key = self.screen.getch()

            if key == 27:  # ESC key
                self.mode = ChatMenuMode.DEFAULT
                self.search_query = ""
                return None

            if key == ord("\n"):  # Enter key
                query = (
                    self.search_query[1:]
                    if self.mode == ChatMenuMode.SEARCH_USERNAME
                    and self.search_query.startswith("@")
                    else self.search_query
                )
                self.search_query = ""
                result = self._handle_search(query)
                return result

            elif key in (curses.KEY_BACKSPACE, 127):  # Backspace
                self.search_query = self.search_query[:-1]
            elif 32 <= key <= 126:  # Printable characters
                # NOTE: getch returns an integer, get_wch returns a char for printable characters
                # need explicit conversion to char
                self.search_query += chr(key)

            return None

        # Regular menu navigation mode
        key = self.screen.getch()

        # Handle special key: '@' to activate search
        if key == ord("@"):
            self.mode = ChatMenuMode.SEARCH_USERNAME
            self.search_query = "@"
            return None

        # Handle special key: '/' to activate search
        if key == ord("/"):
            self.mode = ChatMenuMode.SEARCH_TITLE
            self.search_query = ""
            return None

        if key in (curses.KEY_UP, curses.KEY_DOWN):
            self._handle_navigation(key)
        elif key == ord("\n"):
            return self._select_chat()
        elif key == ord("j"):  # j key as down arrow alternative
            self._handle_navigation(curses.KEY_DOWN)
        elif key == ord("k"):  # k key as up arrow alternative
            self._handle_navigation(curses.KEY_UP)
        elif key == 27 or key == ord("q"):  # ESC or q to quit
            return Signal.QUIT

        return None

    def run(self) -> DirectChat | Signal:
        """
        Run the chat menu interface.

        Returns:
        - DirectChat object if a chat is selected
        - Signal.QUIT if the user quits
        """
        while True:
            self._refresh_ui()

            result = self._handle_input()
            if result is not None:
                self.screen.erase()
                self.screen.refresh()
                return result
