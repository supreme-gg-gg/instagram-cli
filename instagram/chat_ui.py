"""
How this works:
- The main function start_chat() is the entry point for the chat UI.
- It fetches chat data and starts the main loop.
- The main loop displays the chat menu and allows the user to select a chat.
- After selecting a chat, the chat interface is displayed.
- The chat interface allows the user to send messages and execute commands.
- The user can return to the chat menu or quit the program.
"""

import time
import threading
import curses
from enum import Enum, auto
import typer
from typing import List, Tuple

from instagram.client import ClientWrapper
from instagram.api import DirectMessages, DirectChat
from instagram.chat_commands import cmd_registry

class ChatMode(Enum):
    """
    Enum to represent the different modes of the chat interface.
    """
    CHAT = auto()
    COMMAND = auto()
    REPLY = auto()

class Signal(Enum):
    """
    Enum to represent continue or quit chat.
    NOTE: Please use this instead of True/False to avoid confusion.
    Using true and false have led to unexpected behavior in the past.
    """
    CONTINUE = auto()
    BACK = auto()
    QUIT = auto()

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
        visible_width = self.width - 2
        text_before_cursor = ''.join(self.buffer[:self.cursor_pos])
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
            if char == '\n':
                lines.append(''.join(current_line))
                current_line = []
                current_width = 0
                continue
                
            if current_width >= visible_width:
                lines.append(''.join(current_line))
                current_line = []
                current_width = 0
            
            current_line.append(char)
            current_width += 1
            
        if current_line:
            lines.append(''.join(current_line))
            
        return lines

    def handle_key(self, key: int) -> str | None:
        """Handle a keypress with support for multi-line input"""
        if key == ord('\n'):
            # Send message if Enter is pressed in end of message, 
            # otherwise add new line
            if self.cursor_pos < len(self.buffer):
                self.buffer.insert(self.cursor_pos, '\n')
                self.cursor_pos += 1
                self._adjust_scroll()
            else:
                res = ''.join(self.buffer)
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
        
        elif 32 <= key <= 126:  # Printable characters
            self.buffer.insert(self.cursor_pos, chr(key))
            self.cursor_pos += 1
            self._adjust_scroll()
        
        return None

    def _get_position_from_rowcol(self, row: int, col: int) -> int | None:
        """Convert row and column position to buffer index"""
        text = ''.join(self.buffer)
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
        text = ''.join(self.buffer)
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
            self.window.addstr(1, 1, self.placeholder[:self.width-2])
            self.window.attroff(curses.A_DIM)
        else:
            # Draw visible lines
            for i, line in enumerate(lines[self.scroll_offset:self.scroll_offset + self.current_height]):
                self.window.addstr(i + 1, 1, line[:self.width-2])
        
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


class ChatInterface:
    """
    Class to manage the chat interface.
    Parameters:
    - screen: Curses screen object
    - direct_chat: DirectChat object to display
    """
    def __init__(self, screen, direct_chat: DirectChat):
        self.screen = screen
        self.direct_chat = direct_chat
        self.mode = ChatMode.CHAT
        self.height, self.width = screen.getmaxyx()
        self.messages: List[Tuple[str, str]] = []
        self.selection = 0
        self.selected_message_id = None

        # Define UI element config
        # I believe there is a more scalable way to do configurations
        # it will probably come in next major UI patch with chat command changes to `config <field>=<value>`
        self.config = {
            "layout": "compact",
            "colors": "on"
        }
        
        # Initialize windows
        # Initialize windows with corrected positions and sizes
        total_height = self.height - 1  # Reserve 1 line for status bar
        input_height = 6  # Height for input box (5 lines + border)
        chat_height = total_height - input_height  # Rest of space for chat

        # Create windows from top to bottom with correct positioning
        self.chat_win = curses.newwin(chat_height-1, self.width, 0, 0)
        self.input_win = curses.newwin(input_height, self.width, chat_height, 0)  # Position right after chat window
        self.status_bar = curses.newwin(1, self.width, total_height, 0)  # Position at very bottom
        
        # Initialize input box with correct positioning
        self.input_box = InputBox(self.input_win, 0, chat_height, self.width, max_height=5)
        
        # Setup colors
        curses.start_color()
        curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_YELLOW)  # Chat mode
        curses.init_pair(2, curses.COLOR_BLACK, curses.COLOR_CYAN)    # Command mode
        curses.init_pair(3, curses.COLOR_BLACK, curses.COLOR_GREEN)   # Reply mode
        
        # Setup refresh mechanism
        self.refresh_lock = threading.Lock()
        self.stop_refresh = threading.Event()
        self.start_refresh_thread()

    def start_refresh_thread(self):
        """
        Start a thread to refresh chat messages regularly.
        """
        self.refresher = threading.Thread(target=self._refresh_chat, daemon=True)
        self.refresher.start()

    def _refresh_chat(self):
        """
        Fetch chat history from DirectChat regularly and update the chat window.
        """
        while not self.stop_refresh.is_set():
            try:
                self.direct_chat.fetch_chat_history(num_messages=20)
                new_messages = self.direct_chat.get_chat_history()[0]
                with self.refresh_lock:
                    self.messages.clear()
                    self.messages.extend(new_messages)
                self._update_chat_window()
            except Exception as e:
                self.chat_win.addstr(0, 0, f"Refresh error: {str(e)}")
                self.chat_win.refresh()
            time.sleep(2)

    def _update_chat_window(self):
        """
        Write chat messages to the chat window with word wrapping and colored sender names.
        This version also breaks up extremely long words that cannot fit on one line.
        """
        self.chat_win.erase()
        
        # Initialize colors for sender names
        curses.init_pair(4, curses.COLOR_RED, curses.COLOR_BLACK)
        curses.init_pair(5, curses.COLOR_BLUE, curses.COLOR_BLACK)
        curses.init_pair(6, curses.COLOR_GREEN, curses.COLOR_BLACK)
        
        display_messages = self.messages[-(self.height - 5):]
        current_line = 0
        max_lines = self.height - 9
        
        message_line_map = {}
        current_message_idx = 0
        
        # NOTE: Threading must NOT be used in this function because
        # it is called in frequently in everywhere and results in serious 
        # performance issues and unexpected behavior.
        # stop_event = threading.Event()
        # loading_thread = threading.Thread(target=create_loading_screen, args=(self.screen, stop_event))
        # loading_thread.start()

        for msg in display_messages:
            if current_line >= max_lines:
                break

            sender, content = msg
            sender_text = sender + ": "
            message_line_map[current_message_idx] = current_line

            sender_width = len(sender_text)
            content_width = self.width - sender_width - 1

            # Check if this is the selected message
            is_selected = current_message_idx == self.selection and self.mode == ChatMode.REPLY

            if is_selected:
                self.chat_win.attron(curses.A_REVERSE)
            
            # Color and bold sender name based on hash
            if self.config["colors"] == "on":
                color_idx = (hash(sender) % 3) + 4
                self.chat_win.attron(curses.color_pair(color_idx) | curses.A_BOLD)
                self.chat_win.addstr(current_line, 0, sender_text)
                self.chat_win.attroff(curses.color_pair(color_idx) | curses.A_BOLD)
            else:
                self.chat_win.addstr(current_line, 0, sender_text)

            words = content.split()
            line_buffer = []
            current_width = 0

            def flush_line():
                nonlocal current_line, line_buffer, current_width
                if line_buffer and current_line < max_lines:
                    line_content = " ".join(line_buffer)
                    if is_selected:
                        self.chat_win.attron(curses.A_REVERSE)
                    self.chat_win.addstr(current_line, sender_width, line_content)
                    current_line += 1
                line_buffer.clear()
                current_width = 0

            for word in words:
                while len(word) > 0:
                    space_needed = 1 if line_buffer else 0
                    if current_width + len(word) + space_needed <= content_width:
                        line_buffer.append(word)
                        current_width += len(word) + space_needed
                        word = ""
                    else:
                        space_left = content_width - current_width - space_needed
                        chunk = word[:space_left]
                        word = word[space_left:]
                        line_buffer.append(chunk)
                        flush_line()
                        if current_line >= max_lines:
                            break
                if current_line >= max_lines:
                    break

            if line_buffer and current_line < max_lines:
                flush_line()

            if is_selected:
                self.chat_win.attroff(curses.A_REVERSE)

            # Add small spacing between messages
            if self.config["layout"] != "compact":
                current_line += 1

            current_message_idx += 1

        # stop_event.set()
        # loading_thread.join()

        self.chat_win.refresh()
        self._update_status_bar()

    def _update_status_bar(self, msg: str = None):
        """
        Update the status bar based on the current mode.
        """
        self.status_bar.erase()
        if self.mode == ChatMode.CHAT:
            self.status_bar.bkgd(' ', curses.color_pair(1))
            status_text = "[CHAT] Type :help for commands"
        elif self.mode == ChatMode.REPLY:
            self.status_bar.bkgd(' ', curses.color_pair(3))
            status_text = "[REPLY] Use ↑↓ to select, Enter to confirm, Esc to exit"
        elif self.mode == ChatMode.COMMAND:
            self.status_bar.bkgd(' ', curses.color_pair(2))
            status_text = f"[COMMAND] Command {msg} executed. Press any key to continue"
        else:
            status_text = "Georgian mode"
        
        self.status_bar.addstr(0, 0, status_text[:self.width - 1])
        self.status_bar.refresh()

    def handle_input(self) -> Signal:
        """
        Handle user input based on the current mode.
        Returns Signal enum indicating what to do next.
        """
        if self.mode == ChatMode.REPLY:
            self._handle_reply_input()
        
        self.input_box.clear()
        self.input_box.draw()
        
        while True:
            key = self.screen.getch()
            
            if key == 27:  # ESC
                return Signal.QUIT
                
            result = self.input_box.handle_key(key)
            self.input_box.draw()
            
            if result is not None:  # Enter was pressed
                if not result:  # Empty input
                    continue
                    
                if result.lower() in ("exit", "quit"):
                    return Signal.QUIT
                    
                if len(result) > 1 and result.startswith(':'):
                    self.mode = ChatMode.COMMAND
                    return self._handle_command(result[1:])
                    
                return self._handle_chat_message(result)

    def _handle_reply_input(self) -> bool:
        """
        Handle user input in reply mode.
        """
        while True:
            key = self.screen.getch()
            if key in (curses.KEY_UP, ord('k')) and self.selection > 0:
                self.selection -= 1
                self._update_chat_window()
            elif key in (curses.KEY_DOWN, ord('j')) and self.selection < len(self.messages) - 1:
                self.selection += 1
                self._update_chat_window()
            elif key == 27:  # ESC
                self.mode = ChatMode.CHAT
                self.selected_message_id = None
                self._update_chat_window()
                self._update_status_bar()
                return
            elif key == ord('\n'): # Enter
                # NOTE: temporary fix to adjust the index, seems like all one off
                self.selected_message_id = self.direct_chat.get_message_id(-(self.selection+1))
                return

    def _handle_command(self, command: str) -> Signal:
        """
        Executes a command, listen for special return signals or display the result.
        """
        self.mode = ChatMode.COMMAND
        result = cmd_registry.execute(command, chat=self.direct_chat, screen=self.screen)

        # Handle config changes command
        if isinstance(result, dict):
            for key, value in result.items():
                if key in self.config:
                    self.config[key] = value
            self._update_chat_window()
            self.mode = ChatMode.CHAT
            return Signal.CONTINUE

        # Handle special return signals
        elif result == "__BACK__":
            self.stop_refresh.set()
            return Signal.BACK
        
        elif result == "__REPLY__":
            self.mode = ChatMode.REPLY
            self._update_chat_window()
            return Signal.CONTINUE
        
        # Regular command result display
        else:
            self._update_status_bar(msg=command)
            self._display_command_result(result)
            curses.napms(2000)
            self.mode = ChatMode.CHAT

        return Signal.CONTINUE
    
    def _display_command_result(self, result: str):
        """
        Display the text result of a command in the chat window.
        """
        self.chat_win.erase()
        lines = result.split('\n')
        for idx, line in enumerate(lines):
            if idx < self.height - 5:
                self.chat_win.addstr(idx, 0, line[:self.width - 1])
        self.chat_win.refresh()

    def _handle_chat_message(self, message: str) -> Signal:
        """
        Send a chat message or reply to a selected message.
        """
        try:
            if self.selected_message_id and self.mode == ChatMode.REPLY:
                self.direct_chat.send_reply_text(message, self.selected_message_id)
                self.selected_message_id = None
                # Exit reply mode
                self.mode = ChatMode.CHAT
                self._update_chat_window()
                self._update_status_bar()
            else:
                self.direct_chat.send_text(message)
            return Signal.CONTINUE
        except Exception as e:
            self.chat_win.addstr(0, 0, f"Error sending: {e}"[:self.width - 1])
            self.chat_win.refresh()
            return Signal.CONTINUE

    def run(self) -> Signal:
        """Main loop for the chat interface"""
        self._update_chat_window()
        self._update_status_bar()
        while (input_signal := self.handle_input()) not in [Signal.QUIT, Signal.BACK]:
            pass
        self.stop_refresh.set()
        return input_signal

def create_loading_screen(screen, stop_event: threading.Event):
    """
    Create a loading screen with a spinning icon while fetching chat data.
    """
    screen.clear()
    curses.curs_set(0)
    height, width = screen.getmaxyx()
    loading_text = "Loading chat data..."
    spinner = ['|', '/', '-', '\\']
    idx = 0

    while not stop_event.is_set():
        screen.clear()
        screen.addstr(height // 2, (width - len(loading_text)) // 2, loading_text)
        screen.addstr(height // 2 + 1, width // 2, spinner[idx % len(spinner)])
        screen.refresh()
        idx = (idx + 1) % len(spinner)
        time.sleep(0.2)

    screen.clear()
    screen.refresh()

def start_chat(username: str = None):
    """
    Wrapper function to launch chat UI.
    Logs in the user and pass the client to the curses main loop.
    """
    client = ClientWrapper()
    try:
        client.login_by_session()
    except Exception:
        typer.echo("Please login first.\nTry 'instagram login'")
        return

    curses.wrapper(lambda stdscr: main_loop(stdscr, client, username))

def main_loop(screen, client: ClientWrapper, username: str) -> None:
    """
    Main loop for chat interface. Chat loading happens in the main loop to enable loading screen.
    Parameters:
    - screen: Curses screen object
    - client: ClientWrapper object for dm fetching
    - username: Optional recipient's username to chat with
    """
    # Create a loading screen while fetching chat data
    stop_event = threading.Event()
    loading_thread = threading.Thread(target=create_loading_screen, args=(screen, stop_event))
    loading_thread.start()

    dm = DirectMessages(client)
    # Fetch up to 10 chats with a limit of 20 messages per chat
    # We might want to fetch chat list only if user did not specify a recipient for better performance
    # if username is None:
    dm.fetch_chat_data(num_chats=10, num_message_limit=20)

    stop_event.set()
    loading_thread.join()

    while True:
        if username:
            selected_chat = dm.search_by_username(username)
            if not selected_chat:
                typer.echo(f"Chat with @{username} not found")
                break
            username = None  # Reset username for next loop
        else:
            # wait for user to select a chat
            selected_chat = chat_menu(screen, dm)

        if selected_chat == Signal.QUIT: # user quit
            break

        # continue loop to show chat menu again
        if chat_interface(screen, selected_chat) == Signal.QUIT:
            break

def chat_menu(screen, dm: DirectMessages) -> DirectChat | Signal:
    """
    Display the chat list and allow the user to select one.
    Parameters (passed from main loop):
    - screen: Curses screen object
    - dm: DirectMessages object with a list of chats
    Returns:
    - DirectChat object if a chat is selected, None if the user quits
    """
    curses.start_color()
    curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_YELLOW)

    curses.curs_set(1)
    screen.keypad(True)
    chats = list(dm.chats.values())
    selection = 0
    height, width = screen.getmaxyx()

    search_query = ""
    placeholder = "Search for chat by username"
    search_win = curses.newwin(3, width, height-4, 0)

    # Static footer
    footer = curses.newwin(1, width, height - 1, 0)

    def _draw_footer():
        footer.erase()
        footer.bkgd(' ', curses.color_pair(1))
        footer.addstr(0, 0, "[CHAT MENU] Select a chat (Use arrow keys and press ENTER, or ESC to quit)"[:width - 1])
        footer.refresh()

    while True:
        # Main screen
        screen.clear()
        for idx, chat in enumerate(chats):
            title = chat.get_title()
            y_pos = idx
            x_pos = 2
        
            # Ensure we don't exceed window boundaries
            if y_pos < height:
                if idx == selection:
                    screen.attron(curses.A_REVERSE)
                    # Clear the line first to prevent artifacts
                    screen.addstr(y_pos, 0, " " * (width - 1))
                    screen.addstr(y_pos, x_pos, title[:width - x_pos - 1])
                    screen.attroff(curses.A_REVERSE)
                else:
                    screen.addstr(y_pos, x_pos, title[:width - x_pos - 1])

        # Search bar
        search_win.erase()
        search_win.border()
        if not search_query:
            search_win.attron(curses.A_DIM)
            search_win.addstr(1, 2, placeholder[:width-4])
            search_win.attroff(curses.A_DIM)
        else:
            search_win.addstr(1, 2, search_query[:width-4])

        # Refresh windows
        screen.refresh()
        search_win.refresh()
        _draw_footer()

        key = screen.getch()
        if key == curses.KEY_UP and selection > 0:
            selection -= 1
        elif key == curses.KEY_DOWN and selection < len(chats) - 1:
            selection += 1
        elif key == ord("\n"):
            if search_query:  # If there's a search query, perform search
                try:
                    # Show searching indicator
                    search_win.erase()
                    search_win.border()
                    search_win.addstr(1, 2, "Searching...", curses.A_BOLD)
                    search_win.refresh()
                    _draw_footer()
                    
                    # Perform search
                    search_result = dm.search_by_username(search_query)
                    if search_result:
                        return search_result
                    else:
                        # Show "No results" briefly
                        search_win.erase()
                        search_win.border()
                        search_win.addstr(1, 2, f"No results found for @{search_query}", curses.A_DIM)
                        search_win.refresh()
                        _draw_footer()
                        curses.napms(1500)  # Show for 1.5 seconds
                        search_query = ""  # Clear search query
                except Exception as e:
                    # Show error briefly
                    search_win.erase()
                    search_win.border()
                    search_win.addstr(1, 2, f"Search error: {str(e)}", curses.A_DIM)
                    search_win.refresh()
                    footer.refresh()
                    curses.napms(1500)
                    search_query = ""
            elif chats:
                return chats[selection]
        # Use esc to quit
        elif key == 27:
            return Signal.QUIT
        elif key in (curses.KEY_BACKSPACE, 127): # Backspace
            search_query = search_query[:-1]
        elif 32 <= key <= 126: # Printable characters
            search_query += chr(key)

def chat_interface(screen, direct_chat: DirectChat) -> Signal:
    """
    Display the chat interface for a selected chat.
    Creates and runs a ChatInterface object.
    Parameters:
    - screen: Curses screen object
    - direct_chat: DirectChat object to display after loading chat history
    Returns:
    - True if the user wants to return to chat menu, False if they want to quit
    """
    curses.curs_set(1)
    # screen.clear()

    interface = ChatInterface(screen, direct_chat)
    return interface.run()

if __name__ == "__main__":
    start_chat()
