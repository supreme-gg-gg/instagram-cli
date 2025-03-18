import curses
import threading
from ..components.input_box import InputBox
from ..components.chat_window import ChatWindow
from ..components.status_bar import StatusBar
from ..utils.types import ChatMode, Signal
from ..utils.chat_commands import cmd_registry
from instagram.api import DirectChat
from instagram.configs import Config
import time

class ChatInterface:
    """Main chat interface that coordinates components and handles user input."""
    def __init__(self, screen, direct_chat: DirectChat):
        self.screen = screen
        self.direct_chat = direct_chat
        self.mode = ChatMode.CHAT
        self.height, self.width = screen.getmaxyx()
        self.messages_per_fetch = 20
        self.skip_message_selection = False  # Flag to skip message selection in reply mode
        
        # Initialize components
        self.screen.keypad(True)  # Enable special keys
        self._setup_windows()
        self.start_refresh_thread()

    def _setup_windows(self):
        """Initialize UI components."""
        total_height = self.height - 1
        input_height = 6
        chat_height = total_height - input_height

        self.chat_window = ChatWindow(
            curses.newwin(chat_height-1, self.width, 0, 0),
            chat_height-1,
            self.width
        )
        self.chat_window.set_messages(self.direct_chat.get_chat_history()[0])
        
        self.input_box = InputBox(
            curses.newwin(input_height, self.width, chat_height, 0),
            0, chat_height, self.width
        )
        
        self.status_bar = StatusBar(
            curses.newwin(1, self.width, total_height, 0)
        )

        # Initialize modes of children
        self.set_mode(ChatMode.CHAT)

    def start_refresh_thread(self):
        """
        Start a thread to refresh chat messages regularly.
        """
        # Setup refresh mechanism
        self.refresh_lock = threading.Lock()
        self.stop_refresh = threading.Event()
        self.refresh_enabled = True
        self.refresher = threading.Thread(target=self._refresh_chat, daemon=True)
        self.refresher.start()

    def _refresh_chat(self):
        """
        Fetch chat history from DirectChat regularly and update the chat window.
        Only fetches when fetch_enabled is True.
        """
        while not self.stop_refresh.is_set():
            try:
                if self.refresh_enabled:
                    self.direct_chat.fetch_chat_history(self.messages_per_fetch)
                    new_messages = self.direct_chat.get_chat_history()[0]
                    with self.refresh_lock:
                        # self.messages.clear()
                        # self.messages.extend(new_messages)
                        self.chat_window.set_messages(new_messages)
                    self.chat_window.update()
                    self.direct_chat.mark_as_seen()
            except Exception as e:
                self.status_bar.update(f"Refresh error: {str(e)}", override_default=True)
                # self.chat_window.refresh()
            time.sleep(2)

    def toggle_refresh(self, refresh_enabled: bool = True):
        """Enable/disable automatic API message fetching and refreshing"""
        self.refresh_enabled = refresh_enabled
        # self._update_status_bar(msg=f"Message fetching {'enabled' if self.fetch_enabled else 'disabled'}")

    def handle_input(self) -> Signal:
        """
        Handle user input based on the current mode.
        Returns Signal enum indicating what to do next.
        """
        if not self.skip_message_selection:
            if self.mode == ChatMode.REPLY:
                self._handle_reply_input()
            if self.mode == ChatMode.UNSEND:
                self._handle_unsend_input()
            
        self.input_box.clear()
        self.input_box.draw()
        
        while True:
            try:
                key = self.screen.get_wch()
                
                if key == 27 or key == chr(27):  # ESC
                    return Signal.QUIT
                
                # Handle backspace key explicitly
                if key in (curses.KEY_BACKSPACE, '\b', '\x7f'):
                    key = curses.KEY_BACKSPACE
                
                result = self.input_box.handle_key(key)
                self.input_box.draw()
                
                if result is not None:  # Enter was pressed
                    if len(result) > 1 and result.startswith(':'):
                        # escape sequence "::"
                        if result[1] == ':':
                            result = result[1:]
                        else:
                            self.set_mode(ChatMode.COMMAND)
                            return self._handle_command(result[1:])
                    
                    return self._handle_chat_message(result)
            except curses.error:
                continue

    def _handle_reply_input(self) -> None:
        """
        Handle user input in reply mode.
        """
        while True:
            key = self.screen.get_wch()
            if key in (curses.KEY_UP, 'k') and self.chat_window.selection > self.chat_window.visible_messages_range[0]:
                self.chat_window.selection -= 1
                self.chat_window.update()
            elif key in (curses.KEY_DOWN, 'j') and self.chat_window.selection < self.chat_window.visible_messages_range[1]:
                self.chat_window.selection += 1
                self.chat_window.update()
            elif key == 27 or key == chr(27):  # ESC
                self.set_mode(ChatMode.CHAT)
                self.chat_window.selected_message_id = None
                self.chat_window.update()
                self.status_bar.update()
                return
            elif key in ['\n', '\r', curses.KEY_ENTER]: # Enter
                self.chat_window.selected_message_id = self.chat_window.messages[self.chat_window.selection].id
                return
    
    def _handle_unsend_input(self) -> None:
        """
        Handle user input in unsend mode.
        """
        while True:
            key = self.screen.get_wch()
            if key in (curses.KEY_UP, 'k') and self.chat_window.selection > self.chat_window.visible_messages_range[0]:
                self.chat_window.selection -= 1
                self.chat_window.update()
            elif key in (curses.KEY_DOWN, 'j') and self.chat_window.selection < self.chat_window.visible_messages_range[1]:
                self.chat_window.selection += 1
                self.chat_window.update()
            elif key == 27 or key == chr(27):  # ESC
                self.set_mode(ChatMode.CHAT)
                self.chat_window.selected_message_id = None
                self.chat_window.update()
                self.status_bar.update()
                return
            elif key in ['\n', '\r', curses.KEY_ENTER]: # Enter
                target = self.chat_window.messages[self.chat_window.selection]
                if target.message.sender != "You":
                    self.status_bar.update("You can only unsend your own messages", override_default=True)
                else:
                    self.status_bar.update("Unsending message...", override_default=True)
                    if not self.direct_chat.unsend_message(target.id):
                        self.status_bar.update("We're sorry, we couldn't unsend the message", override_default=True)
                    else:
                        # Exit unsend mode
                        self.set_mode(ChatMode.CHAT)
                        self.chat_window.update()
                        self.status_bar.update()
                        return

    def _handle_command(self, command: str) -> Signal:
        """
        Executes a command, listen for special return signals or display the result.
        """
        self.set_mode(ChatMode.COMMAND)
        result = cmd_registry.execute(command, chat=self.direct_chat, screen=self.screen)

        # Handle config changes command
        if isinstance(result, dict):
            for key, value in result.items():
                if Config().get(f"chat.{key}"):
                    Config().set(f"chat.{key}", value)
            self.chat_window.update()
            self.set_mode(ChatMode.CHAT)
            return Signal.CONTINUE

        # Handle special return signals
        elif result == "__QUIT__":
            self.stop_refresh.set()
            return Signal.QUIT

        elif result == "__BACK__":
            self.stop_refresh.set()
            return Signal.BACK
        
        elif result == "__SCROLL_UP__":
            # Disable refresh while viewing older messages (for performance)
            self.toggle_refresh(False)
            # Increase fetch limit if close to the end
            # Move this to a separate thread??
            if len(self.chat_window.messages_lines) - self.chat_window.height - self.chat_window.scroll_offset < 5:
                # self.messages_per_fetch += 20
                self.status_bar.update(msg="Fetching more messages...", override_default=True)
                self.direct_chat.fetch_older_messages_chunk(self.messages_per_fetch)
                self.chat_window.set_messages(self.direct_chat.get_chat_history()[0])
                self.status_bar.update()
            self.chat_window.scroll_offset = min(self.chat_window.scroll_offset + self.chat_window.height - 1, len(self.chat_window.messages_lines) - self.chat_window.height)
            self.set_mode(ChatMode.CHAT)
            self.chat_window.update()
            return Signal.CONTINUE
        
        elif result == "__SCROLL_DOWN__":
            self.chat_window.scroll_offset = max(self.chat_window.scroll_offset - self.chat_window.height+1, 0)
            # self.messages_per_fetch = max(self.messages_per_fetch - 20, 20)
            # Enable refresh if at the bottom
            if self.chat_window.scroll_offset == 0:
                self.toggle_refresh(True)
            self.set_mode(ChatMode.CHAT)
            self.chat_window.update()
            return Signal.CONTINUE

        elif result.startswith("__REPLY__"):
            self.set_mode(ChatMode.REPLY)
            if len(result) > 9:  # Has index
                index = int(result[9:])
                if 0 <= index < len(self.chat_window.messages):
                    self.chat_window.selection = len(self.chat_window.messages) - 1 - index
                    self.chat_window.selected_message_id = self.chat_window.messages[self.chat_window.selection].id
                    self.skip_message_selection = True
                else:
                    self.status_bar.update("Invalid message index", override_default=True)
                    curses.napms(1000)
                    self.set_mode(ChatMode.CHAT)
                    self.status_bar.update()
                    return Signal.CONTINUE
            else:
                # Default interactive selection
                self.chat_window.selection = min(max(
                    self.chat_window.selection,
                    self.chat_window.visible_messages_range[0]
                ), self.chat_window.visible_messages_range[1])
            self.chat_window.update()
            self.status_bar.update()
            return Signal.CONTINUE
        
        elif result.startswith("__UNSEND__"):
            self.set_mode(ChatMode.UNSEND)
            if len(result) > 10:  # Has index
                index = int(result[10:])
                if 0 <= index < len(self.chat_window.messages):
                    msg = self.chat_window.messages[len(self.chat_window.messages) - 1 - index]
                    if msg.message.sender != "You":
                        self.status_bar.update("You can only unsend your own messages", override_default=True)
                        curses.napms(1000)
                    else:
                        self.status_bar.update("Unsending message...", override_default=True)
                        if not self.direct_chat.unsend_message(msg.id):
                            self.status_bar.update("We're sorry, we couldn't unsend the message", override_default=True)
                            curses.napms(1000)
                    self.set_mode(ChatMode.CHAT)
                    return Signal.CONTINUE
                else:
                    self.status_bar.update("Invalid message index", override_default=True)
                    curses.napms(1000)
                    self.set_mode(ChatMode.CHAT)
                    self.status_bar.update()
                    return Signal.CONTINUE
            # Default interactive selection
            self.chat_window.selection = min(max(
                self.chat_window.selection,
                self.chat_window.visible_messages_range[0]
            ), self.chat_window.visible_messages_range[1])
            self.chat_window.update()
            self.status_bar.update()
            return Signal.CONTINUE
        
        elif result.startswith("__ERROR__"):
            self.status_bar.update(result[9:], override_default=True)
            curses.napms(1000)
            self.set_mode(ChatMode.CHAT)
            self.status_bar.update()
            return Signal.CONTINUE
        
        # Regular command result display
        else:
            self.status_bar.update(msg=command)
            self._display_command_result(result)
            curses.napms(1000)
            self.set_mode(ChatMode.CHAT)
            self.status_bar.update()
            return Signal.CONTINUE
    
    def _display_command_result(self, result: str):
        """
        Display the text result of a command in the chat window.
        """
        # TODO: Move this to chat window class
        self.chat_window.window.erase()
        lines = result.split('\n')
        for idx, line in enumerate(lines):
            if idx < self.height - 5:
                self.chat_window.window.addstr(idx, 0, line[:self.width - 1])
        self.chat_window.window.refresh()

    def _handle_chat_message(self, message: str) -> Signal:
        """
        Send a chat message or reply to a selected message.
        """
        try:
            if self.chat_window.selected_message_id and self.mode == ChatMode.REPLY:
                self.direct_chat.send_reply_text(message, self.chat_window.selected_message_id)
                self.chat_window.selected_message_id = None
                # Exit reply mode
                self.set_mode(ChatMode.CHAT)
                self.skip_message_selection = False
                self.chat_window.update()
                self.status_bar.update()
            else:
                self.direct_chat.send_text(message)
            self.chat_window.scroll_offset = 0
            return Signal.CONTINUE
        except Exception as e:
            self.chat_window.window.addstr(0, 0, f"Error sending: {e}"[:self.width - 1])
            self.chat_window.window.refresh()
            return Signal.CONTINUE

    def set_mode(self, mode: ChatMode) -> None:
        """
        Set chat mode for the component and its children.
        """
        self.mode = mode
        self.chat_window.mode = mode
        self.status_bar.mode = mode

    def run(self) -> Signal:
        """Main loop for the chat interface"""
        self.chat_window.update()
        self.status_bar.update()
        while (input_signal := self.handle_input()) not in [Signal.QUIT, Signal.BACK]:
            pass
        self.stop_refresh.set()
        self.screen.erase()
        self.screen.refresh()
        return input_signal
