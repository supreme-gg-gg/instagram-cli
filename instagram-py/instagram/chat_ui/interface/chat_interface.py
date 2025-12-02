import curses
import threading
import inspect
from ..components.input_box import InputBox
from ..components.chat_window import ChatWindow
from ..components.status_bar import StatusBar
from ..utils.types import ChatMode, Signal
from ..utils.chat_commands import cmd_registry
from instagram.api import DirectChat, MessageInfo
from instagram.configs import Config
import time
import uuid
from dataclasses import dataclass


@dataclass
class _OptimisticMessageInfo(MessageInfo):
    """
    Temporary message info used for optimistic UI updates.
    This is used to display the message immediately in the UI
    while the actual message is being sent in the background.

    This distincts from MessageInfo which is a real message

    This data class shall be within chat_interface.py to avoid confusion with the parent MessageInfo,
    as this is intended for UI-specific purposes only.
    """

    pending: bool = False
    failed: bool = False


class ChatInterface:
    """Main chat interface that coordinates components and handles user input."""

    def __init__(self, screen, direct_chat: DirectChat):
        self.screen = screen
        self.direct_chat = direct_chat
        self.mode = ChatMode.CHAT
        self.height, self.width = screen.getmaxyx()
        self.messages_per_fetch = 20
        self.skip_message_selection = (
            False  # Flag to skip message selection in reply mode
        )

        # Track optimistic pending messages (tmp_id -> message)
        self.pending_msgs: dict[str, MessageInfo] = {}

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
            curses.newwin(chat_height - 1, self.width, 0, 0),
            chat_height - 1,
            self.width,
        )
        self.chat_window.set_messages(self.direct_chat.get_chat_history()[0])

        self.input_box = InputBox(
            curses.newwin(input_height, self.width, chat_height, 0),
            0,
            chat_height,
            self.width,
        )

        self.status_bar = StatusBar(curses.newwin(1, self.width, total_height, 0))

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
                    if self.stop_refresh.is_set():
                        # Handle edge case where refresh was stopped during fetch
                        return
                    with self.refresh_lock:
                        # self.messages.clear()
                        # self.messages.extend(new_messages)
                        self.chat_window.set_messages(new_messages)
                        # Re-append any optimistic pending messages that are not yet in server list
                        try:
                            existing_ids = {m.id for m in self.chat_window.messages}
                        except Exception:
                            existing_ids = set()
                        for pid, pmsg in list(self.pending_msgs.items()):
                            if pid not in existing_ids:
                                self.chat_window.messages.append(pmsg)
                        # Rebuild lines after merging pending messages
                        self.chat_window._build_message_lines()
                    self.chat_window.update()

                    if Config().get("chat.send_read_receipts", True):
                        self.direct_chat.mark_as_seen()
                    else:
                        # we mark the thread as seen internally but do not send to Instagram
                        self.direct_chat.seen = 1
            except Exception as e:
                self.status_bar.update(
                    f"Refresh error: {str(e)}", override_default=True
                )
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
                if key in (curses.KEY_BACKSPACE, "\b", "\x7f"):
                    key = curses.KEY_BACKSPACE

                result = self.input_box.handle_key(key)
                self.input_box.draw()

                if result is not None:  # Enter was pressed
                    if len(result) > 1 and result.startswith(":"):
                        # escape sequence "::"
                        if result[1] == ":":
                            result = result[1:]
                        else:
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
            if (
                key in (curses.KEY_UP, "k")
                and self.chat_window.selection
                > self.chat_window.visible_messages_range[0]
            ):
                self.chat_window.selection -= 1
                self.chat_window.update()
            elif (
                key in (curses.KEY_DOWN, "j")
                and self.chat_window.selection
                < self.chat_window.visible_messages_range[1]
            ):
                self.chat_window.selection += 1
                self.chat_window.update()
            elif key == 27 or key == chr(27):  # ESC
                self.set_mode(ChatMode.CHAT)
                self.chat_window.selected_message_id = None
                self.chat_window.update()
                self.status_bar.update()
                return
            elif key in ["\n", "\r", curses.KEY_ENTER]:  # Enter
                self.chat_window.selected_message_id = self.chat_window.messages[
                    self.chat_window.selection
                ].id
                return

    def _handle_unsend_input(self) -> None:
        """
        Handle user input in unsend mode.
        """
        while True:
            key = self.screen.get_wch()
            if (
                key in (curses.KEY_UP, "k")
                and self.chat_window.selection
                > self.chat_window.visible_messages_range[0]
            ):
                self.chat_window.selection -= 1
                self.chat_window.update()
            elif (
                key in (curses.KEY_DOWN, "j")
                and self.chat_window.selection
                < self.chat_window.visible_messages_range[1]
            ):
                self.chat_window.selection += 1
                self.chat_window.update()
            elif key == 27 or key == chr(27):  # ESC
                self.set_mode(ChatMode.CHAT)
                self.chat_window.selected_message_id = None
                self.chat_window.update()
                self.status_bar.update()
                return
            elif key in ["\n", "\r", curses.KEY_ENTER]:  # Enter
                target = self.chat_window.messages[self.chat_window.selection]
                if target.message.sender != "You":
                    self.status_bar.update(
                        "You can only unsend your own messages", override_default=True
                    )
                else:
                    self.status_bar.update(
                        "Unsending message...", override_default=True
                    )
                    if not self.direct_chat.unsend_message(target.id):
                        self.status_bar.update(
                            "We're sorry, we couldn't unsend the message",
                            override_default=True,
                        )
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
        # Show command execution status
        self.set_mode(ChatMode.COMMAND)
        self.status_bar.update(msg=command)

        # Execute the command
        result = cmd_registry.execute(
            command, chat=self.direct_chat, screen=self.screen
        )

        # If result is a generator, stream the output
        if inspect.isgenerator(result):
            self.set_mode(ChatMode.COMMAND_RESULT)
            self.status_bar.update(msg=command)
            self._display_streaming_command_result(result)
            self.set_mode(ChatMode.CHAT)
            self.chat_window.update()
            self.status_bar.update()
            return Signal.CONTINUE

        # Otherwise, the result is a string and we handle special return signals first
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
            if (
                len(self.chat_window.messages_lines)
                - self.chat_window.height
                - self.chat_window.scroll_offset
                < 5
            ):
                # self.messages_per_fetch += 20
                self.status_bar.update(
                    msg="Fetching more messages...", override_default=True
                )
                self.direct_chat.fetch_older_messages_chunk(self.messages_per_fetch)
                self.chat_window.set_messages(self.direct_chat.get_chat_history()[0])
                self.status_bar.update()
            self.chat_window.scroll_offset = min(
                self.chat_window.scroll_offset + self.chat_window.height - 1,
                len(self.chat_window.messages_lines) - self.chat_window.height,
            )
            self.set_mode(ChatMode.CHAT)
            self.chat_window.update()
            return Signal.CONTINUE

        elif result == "__SCROLL_DOWN__":
            self.chat_window.scroll_offset = max(
                self.chat_window.scroll_offset - self.chat_window.height + 1, 0
            )
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
                    self.chat_window.selection = (
                        len(self.chat_window.messages) - 1 - index
                    )
                    self.chat_window.selected_message_id = self.chat_window.messages[
                        self.chat_window.selection
                    ].id
                    self.skip_message_selection = True
                else:
                    self.status_bar.update(
                        "Invalid message index", override_default=True
                    )
                    curses.napms(1000)
                    self.set_mode(ChatMode.CHAT)
                    self.status_bar.update()
                    return Signal.CONTINUE
            else:
                # Default interactive selection
                self.chat_window.selection = min(
                    max(
                        self.chat_window.selection,
                        self.chat_window.visible_messages_range[0],
                    ),
                    self.chat_window.visible_messages_range[1],
                )
            self.chat_window.update()
            self.status_bar.update()
            return Signal.CONTINUE

        elif result.startswith("__UNSEND__"):
            self.set_mode(ChatMode.UNSEND)
            if len(result) > 10:  # Has index
                index = int(result[10:])
                if 0 <= index < len(self.chat_window.messages):
                    msg = self.chat_window.messages[
                        len(self.chat_window.messages) - 1 - index
                    ]
                    if msg.message.sender != "You":
                        self.status_bar.update(
                            "You can only unsend your own messages",
                            override_default=True,
                        )
                        curses.napms(1000)
                    else:
                        self.status_bar.update(
                            "Unsending message...", override_default=True
                        )
                        if not self.direct_chat.unsend_message(msg.id):
                            self.status_bar.update(
                                "We're sorry, we couldn't unsend the message",
                                override_default=True,
                            )
                            curses.napms(1000)
                    self.set_mode(ChatMode.CHAT)
                    return Signal.CONTINUE
                else:
                    self.status_bar.update(
                        "Invalid message index", override_default=True
                    )
                    curses.napms(1000)
                    self.set_mode(ChatMode.CHAT)
                    self.status_bar.update()
                    return Signal.CONTINUE
            # Default interactive selection
            self.chat_window.selection = min(
                max(
                    self.chat_window.selection,
                    self.chat_window.visible_messages_range[0],
                ),
                self.chat_window.visible_messages_range[1],
            )
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
            # Display result and wait for key press
            self.set_mode(ChatMode.COMMAND_RESULT)
            self.status_bar.update(msg=command)
            self._display_command_result(result)
            self.set_mode(ChatMode.CHAT)
            self.chat_window.update()
            self.status_bar.update()
            return Signal.CONTINUE

    def _display_command_result(self, result: str):
        """
        Display the text result of a command in the chat window.
        This is a blocking operation that waits for user key press.
        """
        self.chat_window.set_custom_content(result)
        # Clear any buffered input that occurred during command execution
        curses.flushinp()
        # Handle command result mode - wait for any key press
        self.screen.get_wch()  # Wait for any key press
        self.chat_window.clear_custom_content()  # Clear content after display

    def _display_streaming_command_result(self, result_generator):
        """
        Display the streaming text result of a command in the chat window.
        """
        self.chat_window.set_custom_content("")
        curses.flushinp()
        full_response = ""
        try:
            for chunk in result_generator:
                full_response += chunk
                self.chat_window.set_custom_content(full_response)
                self.chat_window.update()
        except Exception as e:
            self.status_bar.update(f"Streaming error: {e}", override_default=True)
            curses.napms(2000)

        # After streaming is complete, wait for a key press to exit
        self.status_bar.update("Response streaming complete. Press any key...")
        self.screen.get_wch()
        self.chat_window.clear_custom_content()

    def _handle_chat_message(self, message: str) -> Signal:
        """
        Send a chat message or reply to a selected message.
        Implements optimistic UI: append pending message locally, send in background,
        replace with server-provided messages on success, remove on failure.
        """

        try:
            # Prepare processed message for optimistic display
            processed_message = self.direct_chat._replace_emojis(message)

            # Build temporary OptimisticMessageInfo for optimistic UI
            tmp_id = f"tmp:{uuid.uuid4()}"
            pending_msg = _OptimisticMessageInfo(
                id=tmp_id,
                message=type(
                    "M", (), {"sender": "You", "content": processed_message}
                )(),
                reactions=None,
                reply_to=None,
                pending=True,
                failed=False,
            )

            # Append optimistically under lock and update UI
            with self.refresh_lock:
                self.chat_window.messages.append(pending_msg)
                # Track pending optimistic message so refresh won't drop it
                self.pending_msgs[tmp_id] = pending_msg
                # ensure we render the latest
                self.chat_window.scroll_offset = 0
                self.chat_window._build_message_lines()
            self.chat_window.update()
            self.status_bar.update("Sending...", override_default=True)

            # Background sender thread
            def _send_in_background(tmp_id_local, msg_text, is_reply, reply_to_id):
                send_success = False
                try:
                    if is_reply and reply_to_id:
                        # send reply and let refresher pick up authoritative state
                        self.direct_chat.send_reply_text(msg_text, reply_to_id)
                    else:
                        self.direct_chat.send_text(msg_text)
                    send_success = True
                except Exception as send_exc:
                    send_success = False
                    # record exception locally if needed later (currently ignored)
                    _ = send_exc

                # After send completes, update UI under lock
                try:
                    with self.refresh_lock:
                        # Find index of temporary message
                        idx = next(
                            (
                                i
                                for i, m in enumerate(self.chat_window.messages)
                                if m.id == tmp_id_local
                            ),
                            None,
                        )
                        if send_success:
                            # Refresh authoritative messages from server and replace
                            try:
                                self.direct_chat.fetch_chat_history(
                                    self.messages_per_fetch
                                )
                                server_msgs = self.direct_chat.get_chat_history()[0]
                                # Replace entire list with server messages
                                self.chat_window.set_messages(server_msgs)
                                # Remove this pending entry from tracking if server now has it
                                if tmp_id_local in self.pending_msgs:
                                    del self.pending_msgs[tmp_id_local]
                                # Re-append any other pending messages that are not in server list
                                try:
                                    existing_ids = {
                                        m.id for m in self.chat_window.messages
                                    }
                                except Exception:
                                    existing_ids = set()
                                for pid, pmsg in list(self.pending_msgs.items()):
                                    if pid not in existing_ids:
                                        self.chat_window.messages.append(pmsg)
                                self.chat_window._build_message_lines()
                            except Exception:
                                # If refresh failed, just remove pending flag so UI keeps the optimistic message
                                if idx is not None and idx < len(
                                    self.chat_window.messages
                                ):
                                    self.chat_window.messages[idx].pending = False
                        else:
                            # Remove the optimistic message to avoid stale pending items
                            if idx is not None and idx < len(self.chat_window.messages):
                                self.chat_window.messages.pop(idx)
                            # Remove from pending tracking as well
                            if tmp_id_local in self.pending_msgs:
                                del self.pending_msgs[tmp_id_local]
                finally:
                    # Ensure UI updated and status cleared
                    self.chat_window.update()
                    self.status_bar.update()

            # Decide whether this is a reply
            is_reply = (
                self.chat_window.selected_message_id and self.mode == ChatMode.REPLY
            )
            reply_to_id = self.chat_window.selected_message_id if is_reply else None

            sender_thread = threading.Thread(
                target=_send_in_background,
                args=(tmp_id, processed_message, is_reply, reply_to_id),
                daemon=True,
            )
            sender_thread.start()

            # Reset reply state if applicable
            if is_reply:
                self.chat_window.selected_message_id = None
                self.set_mode(ChatMode.CHAT)
                self.skip_message_selection = False

            return Signal.CONTINUE
        except Exception as e:
            # On any local error, show message and continue
            self.chat_window.window.addstr(
                0, 0, f"Error sending: {e}"[: self.width - 1]
            )
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
