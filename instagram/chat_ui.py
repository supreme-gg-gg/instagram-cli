import curses
import time
import threading
from typing import Dict, List
import random

# Mock API Functions
def fetch_chat_list():
    """Simulate API call for fetching chat list."""
    return ["Alice", "Bob", "Charlie", "David"]

def fetch_chat_history(chat):
    """Simulate API fetching chat history."""
    return [f"{chat}: Hello!", f"You: Hi {chat}, how are you?"]

def fetch_new_messages(chat):
    """Simulate real-time new messages appearing."""
    messages = [
        f"{chat}: Are you there?",
        f"{chat}: I need help!",
        f"{chat}: What's up?",
        f"{chat}: Let's meet up later."
    ]
    return random.choice(messages) if random.random() < 0.3 else None  # 30% chance of new message

def send_message(chat, message):
    """Simulate sending a message via API."""
    time.sleep(1)  # Simulate API delay
    return f"You: {message}"


# Main Chat UI
def chat_ui(stdscr):
    """Curses-based chat interface with real-time updates."""
    curses.curs_set(1)  # Show cursor for input
    curses.start_color()
    curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)  # Green for current user
    curses.init_pair(2, curses.COLOR_BLUE, curses.COLOR_BLACK)   # Blue for other user
    curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # Highlighted chat (optional)
    stdscr.clear()
    stdscr.keypad(True)
    height, width = stdscr.getmaxyx()

    # Load chats and histories
    CHATS = fetch_chat_list()
    user_messages: Dict[str, List[str]] = {chat: fetch_chat_history(chat) for chat in CHATS}
    unread_messages: Dict[str, int] = {chat: random.randint(0, 3) for chat in CHATS}  # Simulate unread count

    selected_chat = 0
    chat_scroll = 0
    input_text = ""
    running = True  # Control threading

    # Background thread for fetching messages
    def update_messages():
        while running:
            chat_name = CHATS[selected_chat]
            new_message = fetch_new_messages(chat_name)
            if new_message:
                user_messages[chat_name].append(new_message)
                unread_messages[chat_name] += 1  # Increase unread count
            time.sleep(3)  # Simulate periodic update

    threading.Thread(target=update_messages, daemon=True).start()

    while running:
        stdscr.clear()

        # --- Chat List ---
        stdscr.addstr(1, 2, "Chats", curses.A_BOLD | curses.A_UNDERLINE)
        for i, chat in enumerate(CHATS):
            if i == selected_chat:
                stdscr.attron(curses.A_REVERSE)
            unread = f" ({unread_messages[chat]})" if unread_messages[chat] > 0 else ""
            stdscr.addstr(3 + i, 4, f"{chat}{unread}", curses.A_BOLD if unread else 0)
            if i == selected_chat:
                stdscr.attroff(curses.A_REVERSE)

        # --- Separator ---
        stdscr.addstr(len(CHATS) + 5, 0, "-" * width, curses.A_DIM)

        # --- Chat Messages ---
        chat_area_height = height - (len(CHATS) + 9)  # Space for input box
        chat_name = CHATS[selected_chat]
        all_messages = user_messages[chat_name]

        stdscr.addstr(len(CHATS) + 7, 2, f"Chat with {chat_name}", curses.A_BOLD)

        # Scrollable messages
        for i in range(chat_area_height):
            msg_index = i + chat_scroll
            if msg_index < len(all_messages):
                message = all_messages[msg_index]
                if "You:" in message:
                    # Display current user's messages in green
                    stdscr.attron(curses.color_pair(1))
                    stdscr.addstr(len(CHATS) + 9 + i, 4, message)
                    stdscr.attroff(curses.color_pair(1))
                else:
                    # Display other user's messages in blue
                    stdscr.attron(curses.color_pair(2))
                    stdscr.addstr(len(CHATS) + 9 + i, 4, message)
                    stdscr.attroff(curses.color_pair(2))

        # --- Input Box ---
        stdscr.addstr(height - 3, 2, "Type a message: ", curses.A_DIM)
        stdscr.addstr(height - 2, 2, "> " + input_text)

        stdscr.refresh()

        # --- Key Handling ---
        key = stdscr.getch()

        if key == ord('q'):
            running = False  # Quit
        elif key == curses.KEY_UP:
            chat_scroll = max(0, chat_scroll - 1)
        elif key == curses.KEY_DOWN:
            chat_scroll = min(chat_scroll + 1, max(0, len(all_messages) - chat_area_height))
        elif key == curses.KEY_LEFT:
            # Select previous chat
            selected_chat = max(0, selected_chat - 1)
            chat_scroll = 0  # Reset scroll on new chat
        elif key == curses.KEY_RIGHT:
            # Select next chat
            selected_chat = min(len(CHATS) - 1, selected_chat + 1)
            chat_scroll = 0  # Reset scroll on new chat
        elif key == 10:  # Enter key
            if input_text.strip():
                sent_message = send_message(chat_name, input_text)
                user_messages[chat_name].append(sent_message)
                unread_messages[chat_name] = 0  # Reset unread count after sending
                input_text = ""
                chat_scroll = max(0, len(all_messages) - chat_area_height)
        elif key == 127:  # Backspace
            input_text = input_text[:-1]
        elif 32 <= key <= 126:  # Printable characters
            input_text += chr(key)

    # Cleanup on exit
    running = False

def start_chat():
    """Wrapper function to launch chat UI."""
    
    curses.wrapper(chat_ui)

if __name__ == "__main__":
    start_chat()