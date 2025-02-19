# from datetime import datetime
# import threading
# import time
import os
import subprocess
from datetime import datetime
# import tempfile
# from typing import List, Tuple

import tkinter as tk
from tkinter import filedialog
from .commands import CommandRegistry
from instagram.api import DirectChat 

cmd_registry = CommandRegistry()

@cmd_registry.register("quit", "Quit the chat interface", required_args=[], shorthand="q")
def quit_chat(context) -> str:
    """
    Quit the chat interface. Returns a special value that the chat interface will recognize.
    """
    return "__QUIT__"

@cmd_registry.register("upload", "Upload a photo or video", required_args=[], shorthand="u")
def upload_media(context, filepath: str = "") -> str:
    """
    Upload a photo or video to the chat. Supports .jpg, .png, .jpeg, and .mp4 files.
    If no path is provided, opens a file dialog to select the file.
    """
    chat: DirectChat = context["chat"]
    
    if filepath is None or filepath == "":
        root = tk.Tk()
        root.withdraw()  # Hide the main window
        filetypes = [
            ("Image files", "*.jpg *.jpeg *.png"),
            ("Video files", "*.mp4"),
            ("All files", "*.*")
        ]
        filepath = filedialog.askopenfilename(filetypes=filetypes)
        if not filepath:  # User canceled selection
            return "No file selected"

    if not os.path.exists(filepath):
        return f"File not found: {filepath}"

    if filepath.lower().endswith(('.jpg', '.png', '.jpeg')):
        try:
            chat.send_photo(filepath)
            return "Successfully uploaded photo at " + filepath
        except Exception as e:
            return f"Failed to upload photo: {e}"
    elif filepath.lower().endswith('.mp4'):
        try:
            chat.send_video(filepath)
            return "Successfully uploaded video at " + filepath
        except Exception as e:
            return f"Failed to upload video: {e}"
    else:
        return "Unsupported file type"

@cmd_registry.register("back", "Go back to the chat list", shorthand="b")
def back_to_chat_list(context) -> str:
    """
    Go back to the chat list. Returns a special value that the chat interface will recognize.
    """
    return "__BACK__"

@cmd_registry.register("view", "View media in chat by index of media item", required_args=["index"], shorthand="v")
def view_media(context, index: int) -> str:
    """
    View media in chat. Takes the index of the media item to view.
    Downloads the media to a temporary file and opens it with system viewer.
    """
    chat: DirectChat = context["chat"]
    try:
        file_path = chat.media_url_download(int(index))

        if file_path is None:
            return "URL opened in browser"

        # Open with system default application
        if os.name == 'posix':  # macOS and Linux
            subprocess.run(
                ['xdg-open' if os.uname().sysname == 'Linux' else 'open', file_path],
                check=True
            )
        elif os.name == 'nt':  # Windows
            subprocess.run(['start', file_path], shell=True, check=True)
        else:
            return "Unsupported operating system"

        return f"Opening media #{index}"

    except ValueError:
        return "Unsupported media type"

    except Exception as e:
        return f"Error viewing media: {str(e)}"

@cmd_registry.register("reply", "Reply to a message in the chat", required_args=[], shorthand="r")
def reply_to_message(context) -> str:
    """
    Returns the reply signal to allow user to select message to reply to.
    """
    return "__REPLY__"

@cmd_registry.register("config", "Manage Chat UI configuration", required_args=["options"], shorthand="c")
def manage_config(context, options: str) -> dict:
    """
    Manage Chat UI configuration.
    Options should be in format "field=value".
    """
    # Parse options
    config = {}
    for option in options.split():
        field, value = option.split('=')
        config[field] = value
    
    return config

@cmd_registry.register("latex", "Render LaTeX expr and send as image", required_args=["expression"], shorthand="l")
def render_latex(context, expression: str) -> str:
    """
    Render LaTeX expression and send as image.
    TODO: fix local rendering and set local as a config variable
    """
    chat : DirectChat = context["chat"]
    
    try:
        return chat.send_latex_image(expression, local=False)
    except Exception as e:
        return f"Failed to render LaTeX: {e}"

@cmd_registry.register("scrollup", "Scroll up the chat history", required_args=[], shorthand="k")
def scroll_up(context) -> str:
    return "__SCROLL_UP__"

@cmd_registry.register("scrolldown", "Scroll down the chat history", required_args=[], shorthand="j")
def scroll_down(context) -> str:
    return "__SCROLL_DOWN__"

@cmd_registry.register("schedule", "Schedule a message to be sent at a later time, MUST BE 24-hour format", required_args=["time", "message"], shorthand="S")
def schedule_message(context, time: str, message: str) -> str:
    """
    Schedule a message to be sent at a later time.
    """
    chat: DirectChat = context["chat"]
    try:
        # First we need to check if the time is in the correct format
        # We assume the user inputs it as Optional['YYYY-MM-DD'] + 'HH:MM' (don't include :SS)
        if len(time) < 5:
            return "Invalid time format. Please use 'HH:MM' or 'YYYY-MM-DD HH:MM'"
        
        # We first default all seconds to 00
        time = f"{time}:00"
        
        # If the time is in 'HH:MM' format, we add the current date, follow ISO format
        if len(time) == 8:
            time = f"{datetime.now().strftime('%Y-%m-%d')} {time}"
                             
        return chat.schedule_message(time, message)
    except Exception as e:
        return f"Failed to schedule message: {e}"

@cmd_registry.register("help", "Show available commands", shorthand="h")
def show_help(context) -> str:
    """
    Show available commands and their descriptions
    """
    return cmd_registry.get_help()