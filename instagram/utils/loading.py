import curses
import threading
import time
from typing import Callable


def create_loading_screen(screen, stop_event: threading.Event, text):
    """Create a loading screen with a spinning icon."""
    screen.clear()
    curses.curs_set(0)
    height, width = screen.getmaxyx()
    loading_text = text
    spinner = ["|", "/", "-", "\\"]
    idx = 0

    while not stop_event.is_set():
        screen.clear()
        screen.addstr(height // 2, (width - len(loading_text)) // 2, loading_text)
        screen.addstr(height // 2 + 1, width // 2, spinner[idx % len(spinner)])
        screen.refresh()
        idx = (idx + 1) % len(spinner)
        time.sleep(0.2)

    screen.clear()
    screen.refresh()


def with_loading_screen(screen, func: Callable, text="Loading", *args, **kwargs):
    """Execute function while showing loading screen."""
    stop_event = threading.Event()
    loading_thread = threading.Thread(
        target=create_loading_screen, args=(screen, stop_event, text)
    )
    loading_thread.start()
    try:
        result = func(*args, **kwargs)
    finally:
        stop_event.set()
        loading_thread.join()

    return result
