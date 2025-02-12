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
        self.messages = []
        self.selection = 0
        self.selected_message_id = None
        
        # Initialize windows
        self.chat_win = curses.newwin(self.height - 4, self.width, 0, 0)
        self.input_win = curses.newwin(3, self.width, self.height - 4, 0)
        self.status_bar = curses.newwin(1, self.width, self.height - 1, 0)
        
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
        Write chat messages to the chat window.
        """
        self.chat_win.erase()
        display_messages = self.messages[-(self.height - 5):]
        for idx, msg in enumerate(display_messages):
            if idx < self.height - 5:
                if idx == self.selection and self.mode == ChatMode.REPLY:
                    self.chat_win.attron(curses.A_REVERSE)
                    self.chat_win.addstr(idx, 0, msg[:self.width - 1])
                    self.chat_win.attroff(curses.A_REVERSE)
                else:
                    self.chat_win.addstr(idx, 0, msg[:self.width - 1])
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
            status_text = "[REPLY] Use ↑↓ to select, Enter to confirm, Esc to cancel"
        elif self.mode == ChatMode.COMMAND:
            self.status_bar.bkgd(' ', curses.color_pair(2))
            status_text = f"[COMMAND] Command {msg} executed. Press any key to continue"
        else:
            status_text = "Georgian mode"
        
        self.status_bar.addstr(0, 0, status_text[:self.width - 1])
        self.status_bar.refresh()

    def handle_input(self) -> bool:
        """
        Handle user input based on the current mode.
        Returns False if the user wants to quit.
        """
        if self.mode == ChatMode.REPLY:
            self._handle_reply_input()
        
        # Clear and redraw input window with border
        self.input_win.erase()
        self.input_win.border()
        self.input_win.refresh()
        
        curses.echo()
        user_input = self.input_win.getstr(1, 1).decode().strip()
        curses.noecho()

        if user_input.lower() in ("exit", "quit"):
            return Signal.QUIT

        if len(user_input) > 1 and user_input.startswith(':'):
            return self._handle_command(user_input[1:])
        
        return self._handle_chat_message(user_input)

    def _handle_reply_input(self) -> bool:
        """
        Handle user input in reply mode.
        """
        while True:
            key = self.screen.getch()
            if key == curses.KEY_UP and self.selection > 0:
                self.selection -= 1
                self._update_chat_window()
            elif key == curses.KEY_DOWN and self.selection < len(self.messages) - 1:
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
        self._update_status_bar(msg=command)
        if result == "__BACK__":
            self.stop_refresh.set()
            return Signal.BACK
        elif result == "__REPLY__":
            self.mode = ChatMode.REPLY
            self._update_chat_window()
            return Signal.CONTINUE
        else:
            self._display_command_result(result)
            curses.napms(3000)
            self.mode = ChatMode.CHAT
            self._update_status_bar()
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
        while (input_signal := self.handle_input()) not in [Signal.QUIT, Signal.BACK]:
            pass
        self.stop_refresh.set()
        return input_signal

def start_chat(username: str = None):
    """
    Wrapper function to launch chat UI.
    Fetches chat data and starts the main loop.
    """
    client = ClientWrapper()
    try:
        client.login_by_session()
    except Exception as e:
        typer.echo("Please login first.\nTry 'instagram login'")
        return

    dm = DirectMessages(client)
    # Fetch up to 10 chats with a limit of 20 messages per chat
    # We might want to fetch chat list only if user did not specify a recipient for better performance
    # if username is None:
    dm.fetch_chat_data(num_chats=10, num_message_limit=20)
    curses.wrapper(lambda stdscr: main_loop(stdscr, dm, username))

def main_loop(screen, dm: DirectMessages, username: str) -> None:
    """
    Main loop for chat interface.
    Parameters:
    - screen: Curses screen object
    - dm: DirectMessages object with a list of chats fetched
    - username: Optional recipient's username to chat with
    """
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

        if not selected_chat: # user quit
            break

        # continue loop to show chat menu again
        if chat_interface(screen, selected_chat) == Signal.QUIT:
            break

def chat_menu(screen, dm: DirectMessages) -> DirectChat | None:
    """
    Display the chat list and allow the user to select one.
    Parameters (passed from main loop):
    - screen: Curses screen object
    - dm: DirectMessages object with a list of chats
    Returns:
    - DirectChat object if a chat is selected, None if the user quits
    """
    curses.curs_set(1)
    screen.keypad(True)
    chats = list(dm.chats.values())
    selection = 0
    height, width = screen.getmaxyx()

    search_query = ""
    placeholder = "Search for chat by username"
    search_win = curses.newwin(3, width, height-3, 0)

    while True:
        screen.clear()
        screen.addstr(0, 0, "Select a chat (Use arrow keys and press ENTER, or press 'q' to quit):")
        for idx, chat in enumerate(chats):
            title = chat.get_title()
            y_pos = idx + 2
            x_pos = 2  # Add left margin
        
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

        screen.refresh()

        # Search bar
        search_win.erase()
        search_win.border()
        if not search_query:
            search_win.attron(curses.A_DIM)
            search_win.addstr(1, 2, placeholder[:width-4])
            search_win.attroff(curses.A_DIM)
        else:
            search_win.addstr(1, 2, search_query[:width-4])
        search_win.refresh()

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
                        curses.napms(1500)  # Show for 1.5 seconds
                        search_query = ""  # Clear search query
                except Exception as e:
                    # Show error briefly
                    search_win.erase()
                    search_win.border()
                    search_win.addstr(1, 2, f"Search error: {str(e)}", curses.A_DIM)
                    search_win.refresh()
                    curses.napms(1500)
                    search_query = ""
            elif chats:
                return chats[selection]
        elif key in (ord("q"), ord("Q")):
            return None
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
    screen.clear()

    interface = ChatInterface(screen, direct_chat)
    return interface.run()

if __name__ == "__main__":
    start_chat()
