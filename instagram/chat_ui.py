import curses
from typing import Dict, List
from instagram import api  # Mocked API calls

# Mock chat data (for now)
CHATS = ["Alice", "Bob", "Charlie", "Dave"]
MESSAGES = {
    "Alice": ["Hey!", "How are you?", "Did you finish the project?"],
    "Bob": ["What's up?", "Want to grab lunch?", "See you later."],
    "Charlie": ["Hello!", "Long time no see.", "Hope you're doing well!"],
    "Dave": ["Yo!", "Playing any games lately?", "Let's hang out."],
}

def chat_ui(stdscr):
    """Curses-based chat interface."""
    curses.curs_set(1)  # Show cursor for input
    stdscr.clear()
    stdscr.keypad(True)
    height, width = stdscr.getmaxyx()

    user_messages: Dict[str, List[str]] = {chat: [] for chat in CHATS}  # User-input messages

    selected_chat = 0
    chat_scroll = 0
    input_text = ""

    while True:
        stdscr.clear()

        # --- Chat List ---
        stdscr.addstr(1, 2, "Chats", curses.A_BOLD | curses.A_UNDERLINE)
        for i, chat in enumerate(CHATS):
            if i == selected_chat:
                stdscr.attron(curses.A_REVERSE)
            stdscr.addstr(3 + i, 4, chat)
            if i == selected_chat:
                stdscr.attroff(curses.A_REVERSE)

        # --- Separator ---
        stdscr.addstr(len(CHATS) + 5, 0, "-" * width, curses.A_DIM)

        # --- Chat Messages ---
        chat_area_height = height - (len(CHATS) + 9)  # Space for input box
        chat_name = CHATS[selected_chat]
        all_messages = MESSAGES[chat_name] + user_messages[chat_name]

        stdscr.addstr(len(CHATS) + 7, 2, f"Chat with {chat_name}", curses.A_BOLD)

        # Scrollable messages
        for i in range(chat_area_height):
            msg_index = i + chat_scroll
            if msg_index < len(all_messages):
                stdscr.addstr(len(CHATS) + 9 + i, 4, all_messages[msg_index])

        # --- Input Box ---
        stdscr.addstr(height - 3, 2, "Type a message: ", curses.A_DIM)
        stdscr.addstr(height - 2, 2, "> " + input_text)

        stdscr.refresh()

        # --- Key Handling ---
        key = stdscr.getch()

        if key == ord('q'):
            break  # Quit
        elif key == curses.KEY_UP:
            chat_scroll = max(0, chat_scroll - 1)
        elif key == curses.KEY_DOWN:
            chat_scroll = min(chat_scroll + 1, max(0, len(all_messages) - chat_area_height))
        elif key == curses.KEY_LEFT:
            selected_chat = max(0, selected_chat - 1)
            chat_scroll = 0
        elif key == curses.KEY_RIGHT:
            selected_chat = min(len(CHATS) - 1, selected_chat + 1)
            chat_scroll = 0
        elif key == 10:  # Enter key
            if input_text.strip():
                user_messages[chat_name].append("You: " + input_text)
                input_text = ""
                chat_scroll = max(0, len(all_messages) - chat_area_height)
        elif key == 127:  # Backspace
            input_text = input_text[:-1]
        elif 32 <= key <= 126:  # Printable characters
            input_text += chr(key)

def start_chat():
    """Wrapper function to launch chat UI."""
    curses.wrapper(chat_ui)