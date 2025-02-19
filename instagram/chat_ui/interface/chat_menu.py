import curses
from instagram.api.direct_messages import DirectMessages, DirectChat
from ..utils.types import Signal

# TODO: Refactor this function into a class
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
    curses.init_pair(7, curses.COLOR_BLACK, curses.COLOR_YELLOW)
    curses.init_pair(8, curses.COLOR_RED, curses.COLOR_BLACK)

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
        footer.bkgd(' ', curses.color_pair(7))
        footer.addstr(0, 0, "[CHAT MENU] Select a chat (Use arrow keys and press ENTER, or ESC to quit)"[:width - 1])
        footer.refresh()

    while True:
        # Main screen
        screen.clear()
        for idx, chat in enumerate(chats):
            title = chat.get_title()
            is_seen = chat.seen
            #is_seen = chat.is_seen()
            x_pos = 2
        
            # Ensure we don't exceed window boundaries
            if idx < height - 6:
                if idx == selection:
                    screen.attron(curses.A_REVERSE)
                    # Clear the line first to prevent artifacts
                    screen.addstr(idx, 0, " " * (width - 1))
                    screen.addstr(idx, x_pos, title[:width - x_pos - 1])
                    screen.attroff(curses.A_REVERSE)
                else:
                    # We add conditional styling based on seen status
                    # Refer to DirectMessages for this
                    if is_seen is not None and is_seen == 1:
                        screen.attron(curses.color_pair(8) | curses.A_BOLD)
                        screen.addstr(idx, x_pos, "→ " + title[:width - x_pos - 3])
                        screen.attroff(curses.color_pair(8) | curses.A_BOLD)
                    else:
                        screen.addstr(idx, x_pos, title[:width - x_pos - 1])

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
            # Add this so use can use the same quit command as chat
            if search_query and search_query == ':quit':
                return Signal.QUIT
            
            # NOTE: You MUST add the "@" symbol to search by username
            if search_query and search_query.startswith("@"):
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

