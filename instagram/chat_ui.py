import time
import threading
import curses
import typer

from .client import ClientWrapper
from .api.direct_messages import DirectMessages

def start_chat():
    """Wrapper function to launch chat UI."""
    client = ClientWrapper()
    try:
        client.login_by_session()
    except Exception as e:
        typer.echo("Please login first.\nTry 'instagram login'")
        return

    dm = DirectMessages(client)
    # Fetch up to 10 chats with a limit of 20 messages per chat
    dm.fetch_chat_data(num_chats=10, num_message_limit=20)
    curses.wrapper(lambda stdscr: main_loop(stdscr, dm))


def main_loop(screen, dm: DirectMessages):
    selected_chat = chat_menu(screen, dm)
    if selected_chat:
        chat_interface(screen, selected_chat)


def chat_menu(screen, dm: DirectMessages):
    """Display the chat list and allow the user to select one."""
    curses.curs_set(0)
    screen.keypad(True)
    chats = list(dm.chats.values())
    selection = 0

    while True:
        screen.clear()
        screen.addstr(0, 0, "Select a chat (Use arrow keys and press ENTER, or press 'q' to quit):")
        for idx, chat in enumerate(chats):
            # Display a simplified chat name built from the participants' usernames.
            participants = ", ".join([user.username for user in chat.thread.users])
            if idx == selection:
                screen.attron(curses.A_REVERSE)
                screen.addstr(idx + 2, 0, participants)
                screen.attroff(curses.A_REVERSE)
            else:
                screen.addstr(idx + 2, 0, participants)
        screen.refresh()

        key = screen.getch()
        if key == curses.KEY_UP and selection > 0:
            selection -= 1
        elif key == curses.KEY_DOWN and selection < len(chats) - 1:
            selection += 1
        elif key == ord("\n"):
            return chats[selection]
        elif key in (ord("q"), ord("Q")):
            return None


def chat_interface(screen, direct_chat):
    """Display a chat conversation view with auto-refreshing history and input line."""
    curses.curs_set(1)
    screen.clear()
    height, width = screen.getmaxyx()

    # Create a separate window for chat history and input
    chat_win = curses.newwin(height - 3, width, 0, 0)
    input_win = curses.newwin(3, width, height - 3, 0)

    # Shared data and control flag for refreshing
    messages = []
    refresh_lock = threading.Lock()
    stop_refresh = threading.Event()

    def refresh_chat():
        while not stop_refresh.is_set():
            try:
                direct_chat.fetch_chat_history(num_messages=20)
                new_messages = direct_chat.get_chat_history()
                with refresh_lock:
                    messages.clear()
                    messages.extend(new_messages)
                # Redraw chat window
                chat_win.erase()
                with refresh_lock:
                    # Only show the last messages that fit in the chat window
                    display_messages = messages[-(height - 4):]
                for idx, msg in enumerate(display_messages):
                    chat_win.addstr(idx, 0, msg[:width - 1])
                chat_win.refresh()
            except Exception:
                # In production, you’d log the error
                pass
            time.sleep(2)

    refresher = threading.Thread(target=refresh_chat, daemon=True)
    refresher.start()

    # Input loop for sending messages.
    while True:
        input_win.erase()
        input_win.border()
        input_prompt = "Type your message (or 'exit' to quit): "
        input_win.addstr(1, 2, input_prompt)
        input_win.refresh()

        curses.echo()
        user_input = input_win.getstr(1, len(input_prompt) + 2).decode().strip()
        curses.noecho()

        if user_input.lower() in ("exit", "quit"):
            stop_refresh.set()
            break

        try:
            # Send the message via API call (this call may take a few seconds)
            direct_chat.send_text(user_input)
        except Exception as e:
            # Optionally display error on screen.
            chat_win.addstr(0, 0, f"Error sending message: {e}"[:width-1])
            chat_win.refresh()

    # Give a moment for the refresh thread to exit before returning.
    time.sleep(0.5)


if __name__ == "__main__":
    start_chat()
