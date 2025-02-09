import time
import threading
import curses
import typer

from instagram.client import ClientWrapper
from instagram.api import DirectMessages, DirectChat
from instagram.chat_commands import cmd_registry

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


def chat_menu(screen, dm: DirectMessages) -> DirectChat:
    """Display the chat list and allow the user to select one."""
    curses.curs_set(0)
    screen.keypad(True)
    chats = list(dm.chats.values())
    selection = 0
    height, width = screen.getmaxyx()

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
    curses.curs_set(1)
    screen.clear()
    height, width = screen.getmaxyx()

    curses.start_color()
    curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_YELLOW)  # Chat mode color
    curses.init_pair(2, curses.COLOR_BLACK, curses.COLOR_CYAN)    # Command mode color

    # Enlarge the bottom input window to 3 lines instead of 2
    chat_win = curses.newwin(height - 4, width, 0, 0)
    input_win = curses.newwin(3, width, height - 4, 0)
    status_bar = curses.newwin(1, width, height - 1, 0)

    mode = "chat"
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
                chat_win.erase()
                display_messages = messages[-(height - 5):]
                for idx, msg in enumerate(display_messages):
                    if idx < height - 5:  # Prevent overflow
                        chat_win.addstr(idx, 0, msg[:width - 1])
                chat_win.refresh()
            except Exception as e:
                print(e)
                chat_win.addstr(0, 0, f"Refresh error: {str(e)}")
                chat_win.refresh()
            time.sleep(2)

    # Do initial refresh before starting the thread
    try:
        direct_chat.fetch_chat_history(num_messages=20)
        messages.extend(direct_chat.get_chat_history())
        display_messages = messages[-(height - 5):]
        for idx, msg in enumerate(display_messages):
            if idx < height - 5:
                chat_win.addstr(idx, 0, msg[:width - 1])
        chat_win.refresh()
    except Exception as e:
        print(e)
        chat_win.addstr(0, 0, f"Initial refresh error: {str(e)}")
        chat_win.refresh()

    refresher = threading.Thread(target=refresh_chat, daemon=True)
    refresher.start()

    while True:
        # Update status bar based on mode
        status_bar.erase()
        if mode == "chat":
            status_bar.bkgd(' ', curses.color_pair(1))
            status_text = "[CHAT MODE] Send ':' to enter command mode"
        else:
            status_bar.bkgd(' ', curses.color_pair(2))
            status_text = "[COMMAND MODE] Send ENTER to return to chat mode"
        status_bar.addstr(0, 0, status_text)
        status_bar.refresh()

        # Update input window
        input_win.erase()
        input_win.border()
        input_win.refresh()

        curses.echo()
        user_input = input_win.getstr(1, 1).decode().strip()
        curses.noecho()

        if user_input.lower() in ("exit", "quit"):
            stop_refresh.set()
            break

        # Vim-like toggling
        if mode == "chat" and user_input == ":":
            mode = "command"
            continue
        elif mode == "command" and user_input == "":
            mode = "chat"
            continue

        if mode == "chat":
            try:
                direct_chat.send_text(user_input)
            except Exception as e:
                chat_win.addstr(0, 0, f"Error sending: {e}"[:width - 1])
                chat_win.refresh()
        else:
            # Execute command and show result
            result = cmd_registry.execute(user_input, chat=direct_chat, screen=screen)
            
            # Clear chat window and display result
            chat_win.erase()
            lines = result.split('\n')
            for idx, line in enumerate(lines):
                if idx < height - 5:  # Prevent overflow
                    chat_win.addstr(idx, 0, line[:width - 1])
            chat_win.refresh()
                
            # Show brief notification in status bar NOTE: doesn't work
            # status_bar.erase()
            # status_bar.bkgd(' ', curses.color_pair(2))
            # status_bar.addstr(0, 0, "[COMMAND] Result shown above")
            # status_bar.refresh()

    time.sleep(0.5)

if __name__ == "__main__":
    start_chat()
