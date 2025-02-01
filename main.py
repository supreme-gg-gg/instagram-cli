import curses

def main(stdscr):
    curses.curs_set(1)  # Show cursor for input
    stdscr.clear()
    stdscr.keypad(True)  # Enable arrow keys
    height, width = stdscr.getmaxyx()

    # Mock chat list and messages
    chats = ["Alice", "Bob", "Charlie", "Dave"]
    messages = {
        "Alice": ["Hey!", "How are you?", "Did you finish the project?"],
        "Bob": ["What's up?", "Want to grab lunch?", "See you later."],
        "Charlie": ["Hello!", "Long time no see.", "Hope you're doing well!"],
        "Dave": ["Yo!", "Playing any games lately?", "Let's hang out."],
    }
    user_messages = {chat: [] for chat in chats}  # Store user input per chat

    selected_chat = 0
    chat_scroll = 0
    input_text = ""

    while True:
        stdscr.clear()

        # --- Draw Chat List (Top Section) ---
        stdscr.addstr(1, 2, "Chats", curses.A_BOLD | curses.A_UNDERLINE)
        for i, chat in enumerate(chats):
            if i == selected_chat:
                stdscr.attron(curses.A_REVERSE)
            stdscr.addstr(3 + i, 4, chat)
            if i == selected_chat:
                stdscr.attroff(curses.A_REVERSE)

        # --- Separator Line ---
        stdscr.addstr(len(chats) + 5, 0, "-" * width, curses.A_DIM)

        # --- Chat Window (Middle Section) ---
        chat_area_height = height - (len(chats) + 9)  # Space for input box
        chat_name = chats[selected_chat]
        all_messages = messages[chat_name] + user_messages[chat_name]  # Combine mock & user messages

        stdscr.addstr(len(chats) + 7, 2, f"Chat with {chat_name}", curses.A_BOLD)
        
        # Display Messages (Scrollable)
        for i in range(chat_area_height):
            msg_index = i + chat_scroll
            if msg_index < len(all_messages):
                stdscr.addstr(len(chats) + 9 + i, 4, all_messages[msg_index])

        # --- Input Box (Bottom Section) ---
        stdscr.addstr(height - 3, 2, "Type a message: ", curses.A_DIM)
        stdscr.addstr(height - 2, 2, "> " + input_text)  # Show user input

        # Refresh screen
        stdscr.refresh()

        # Handle key inputs
        key = stdscr.getch()

        if key == ord('q'):
            break  # Quit
        elif key == curses.KEY_UP:
            if chat_scroll > 0:
                chat_scroll -= 1  # Scroll up messages
        elif key == curses.KEY_DOWN:
            if chat_scroll < len(all_messages) - chat_area_height:
                chat_scroll += 1  # Scroll down messages
        elif key == curses.KEY_LEFT:
            selected_chat = max(0, selected_chat - 1)
            chat_scroll = 0  # Reset scroll when switching chat
        elif key == curses.KEY_RIGHT:
            selected_chat = min(len(chats) - 1, selected_chat + 1)
            chat_scroll = 0  # Reset scroll when switching chat
        elif key == 10:  # Enter key (send message)
            if input_text.strip():
                user_messages[chat_name].append("You: " + input_text)
                input_text = ""  # Clear input
                chat_scroll = max(0, len(all_messages) - chat_area_height)  # Adjust scroll
        elif key == 127:  # Backspace
            input_text = input_text[:-1]
        elif 32 <= key <= 126:  # Printable characters
            input_text += chr(key)

curses.wrapper(main)