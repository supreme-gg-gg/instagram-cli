"""
How this works:
- The main function start_chat() is the entry point for the chat UI.
- It fetches chat data and starts the main loop.
- The main loop displays the chat menu and allows the user to select a chat.
- After selecting a chat, the chat interface is displayed.
- The chat interface allows the user to send messages and execute commands.
- The user can return to the chat menu or quit the program.
"""

import threading
import curses
import typer
from pathlib import Path

from .client import ClientWrapper
from .api import DirectMessages, DirectChat, MessageScheduler
from .configs import Config

from .chat_ui.interface.chat_interface import ChatInterface
from .chat_ui.interface.chat_menu import chat_menu
from .chat_ui.utils.loading import with_loading_screen
from .chat_ui.utils.types import Signal

def start_chat(username: str | None = None, search_filter: str = "") -> None:
    """
    Wrapper function to launch chat UI.
    Logs in the user and pass the client to the curses main loop.
    """
    client = ClientWrapper()
    try:
        client.login_by_session()
    except Exception:
        typer.echo("Please login first.\nTry 'instagram auth login'")
        return
    
    def init_chat(screen):
        # Initialize scheduler with screen for handling overdue messages (this is only done once)
        path = Path(Config().get("users_dir")) / client.username / "tasks.json"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()
        scheduler = MessageScheduler(client, path)
        scheduler.schedule_tasks_on_startup(screen)
        
        return main_loop(screen, client, username, search_filter)

    curses.wrapper(init_chat)

def main_loop(screen, client: ClientWrapper, username: str | None, search_filter: str = "") -> None:
    """
    Main loop for chat interface. Chat loading happens in the main loop to enable loading screen.
    Parameters:
    - screen: Curses screen object
    - client: ClientWrapper object for dm fetching
    - username: Optional recipient's username to chat with
    - search_filter: Optional filter to apply to chat search
    """
    # First create the DM object
    dm = DirectMessages(client)

    if username is None:
        with_loading_screen(screen, dm.fetch_chat_data, num_chats=10, num_message_limit=20)

    while True:
        if username:
            selected_chat = with_loading_screen(screen, search_chat_list, dm, username, search_filter)
            if not selected_chat:
                typer.echo(f"Chat with @{username} not found")
                break
            username = None  # Reset username for next loop
        else:
            # if chat is empty
            if not dm.chats:
                with_loading_screen(screen, dm.fetch_chat_data, num_chats=10, num_message_limit=20)
            if not dm.chats:
                typer.echo("No chats found. Try again later.")
                break
            # wait for user to select a chat
            selected_chat = chat_menu(screen, dm)

        if selected_chat == Signal.QUIT: # user quit
            break

        # continue loop to show chat menu again
        if chat_interface(screen, selected_chat) == Signal.QUIT:
            break

def search_chat_list(dm: DirectMessages, title: str, filter: str = "") -> DirectChat | None:
    """
    Search for a chat by title or username in DirectMessages object.
    
    Parameters
    ---------------
    - dm: DirectMessages object to search in 
    - title: Title or username to search for
    - filter: Filter to apply to the search, priority follows the order of characters:
      - "u" to search by username
      - "t" to search by title
      - Default is "tu" (search title first, then username)
    
    Returns
    ---------------
    - DirectChat object if found, None if not found
    """
    # Default filter if none provided
    if not filter:
        filter = "tu"
        
    # Map of filter characters to search functions
    search_funcs = {
        'u': dm.search_by_username,
        't': dm.search_by_title
    }
    
    # Try each search method in order of filter chars
    for f in filter:
        if f in search_funcs:
            if chat := search_funcs[f](title):
                return chat
        else:
            raise ValueError(f"Invalid filter character: {f}")
    
    return None

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
