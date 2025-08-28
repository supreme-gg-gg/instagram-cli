import os
import yaml
import subprocess
from datetime import datetime, timedelta
from typing import Generator

import tkinter as tk
from tkinter import filedialog
import openai
from .commands import CommandRegistry
from instagram.api import DirectChat
from instagram.configs import Config

cmd_registry = CommandRegistry()


@cmd_registry.register(
    "quit", "Quit the chat interface", required_args=[], shorthand="q"
)
def quit_chat(context) -> str:
    """
    Quit the chat interface. Returns a special value that the chat interface will recognize.
    """
    return "__QUIT__"


@cmd_registry.register(
    "upload", "Upload a photo or video", required_args=[], shorthand="u"
)
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
            ("All files", "*.*"),
        ]
        filepath = filedialog.askopenfilename(filetypes=filetypes)
        if not filepath:  # User canceled selection
            return "No file selected"

    if not os.path.exists(filepath):
        return f"File not found: {filepath}"

    if filepath.lower().endswith((".jpg", ".png", ".jpeg")):
        try:
            chat.send_photo(filepath)
            return "Successfully uploaded photo at " + filepath
        except Exception as e:
            return f"Failed to upload photo: {e}"
    elif filepath.lower().endswith(".mp4"):
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


@cmd_registry.register(
    "view",
    "View media in chat by index of media item",
    required_args=["index"],
    shorthand="v",
)
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
        if os.name == "posix":  # macOS and Linux
            subprocess.run(
                ["xdg-open" if os.uname().sysname == "Linux" else "open", file_path],
                check=True,
            )
        elif os.name == "nt":  # Windows
            subprocess.run(["start", file_path], shell=True, check=True)
        else:
            return "Unsupported operating system"

        return f"Opening media #{index}"

    except ValueError:
        return "Unsupported media type"

    except Exception as e:
        return f"Error viewing media: {str(e)}"


@cmd_registry.register(
    "reply", "Reply to a message in the chat", required_args=[], shorthand="r"
)
def reply_to_message(context, index: str = None) -> str:
    """
    Returns the reply signal to allow user to select message to reply to.
    If index is provided, directly selects that message.
    """
    if index is not None:
        try:
            return f"__REPLY__{int(index)}"
        except ValueError:
            return "__ERROR__Invalid message index"
    return "__REPLY__"


@cmd_registry.register("unsend", "Unsend a message", required_args=[], shorthand="d")
def unsend_message(context, index: str = None) -> str:
    """
    Unsend a message. Returns the unsend signal to allow user to select message to unsend.
    If index is provided, directly unsends that message.
    """
    if index is not None:
        try:
            return f"__UNSEND__{int(index)}"
        except ValueError:
            return "__ERROR__Invalid message index"
    return "__UNSEND__"


@cmd_registry.register(
    "config",
    "Get or set a config value in the chat interface",
    required_args=["options"],
    shorthand="c",
)
def manage_config(context, options: str) -> str:
    """
    Manage Chat UI configuration.
    Options should be in format "field=value" for set or "field" for get
    """
    # Parse options and get or set config values
    config = Config()

    if "=" not in options:
        field = options.strip()
        if not field:
            return "No configuration key provided."
        value = config.get(field)
        if value is None:
            return f"Configuration key '{field}' not found."
        return f"{field} = {value}"

    field, value_str = options.split("=", 1)
    try:
        value = yaml.safe_load(value_str)
        config.set(field, value)
    except Exception as e:
        return f"Failed to set {field}: {e}"

    return f"Successfully set {field} to {value}"


@cmd_registry.register(
    "latex",
    "Render LaTeX expr and send as image",
    required_args=["expression"],
    shorthand="l",
)
def render_latex(context, expression: str) -> str:
    """
    Render LaTeX expression and send as image.
    TODO: fix local rendering and set local as a config variable
    """
    chat: DirectChat = context["chat"]

    try:
        return chat.send_latex_image(expression, local=False)
    except Exception as e:
        return f"Failed to render LaTeX: {e}"


@cmd_registry.register(
    "scrollup", "Scroll up the chat history", required_args=[], shorthand="k"
)
def scroll_up(context) -> str:
    return "__SCROLL_UP__"


@cmd_registry.register(
    "scrolldown", "Scroll down the chat history", required_args=[], shorthand="j"
)
def scroll_down(context) -> str:
    return "__SCROLL_DOWN__"


@cmd_registry.register(
    "schedule",
    "Schedule a message to be sent at HH:MM (24 hour format)",
    required_args=["time", "message"],
    shorthand="S",
)
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


@cmd_registry.register(
    "cancel", "Cancel the LATEST scheduled message", required_args=[], shorthand="C"
)
def cancel_latest_message(context) -> str:
    """
    Cancel a scheduled message.
    """
    chat: DirectChat = context["chat"]
    try:
        return chat.cancel_latest_scheduled_message()
    except Exception as e:
        return f"Failed to cancel scheduled message: {e}"


@cmd_registry.register(
    "delay",
    "Delay the chat interface for a specified time",
    required_args=["seconds", "message"],
    shorthand="d",
)
def delay_sending_message(context, seconds: str, message: str) -> str:
    """
    Delay sending the message for a specified time using the scheduler as backend.
    """
    chat: DirectChat = context["chat"]
    try:
        # First check if the time is in the correct format
        if int(seconds) < 0:
            return "Invalid time format. Please use a positive integer for seconds"

        # Convert this into a future datetime compatible with the scheduler
        future_time = datetime.now() + timedelta(seconds=int(seconds))
        future_time = future_time.strftime("%Y-%m-%d %H:%M:%S")

        # Schedule the message
        return chat.schedule_message(future_time, message)
    except Exception as e:
        return f"Failed to delay message: {e}"


@cmd_registry.register(
    "summarize",
    "Summarize the chat history",
    required_args=[],
    shorthand="s",
)
def summarize_chat_history(context, depth: int = -1) -> str | Generator:
    """
    Summarize the chat history using an OpenAI-compatible API endpoint.
    Parameters:
    - depth (int): The depth of the summary (how many messages to include).
      Setting to -1 means including all messages.

    TODO: Handle media and maybe send them to the LLM too
    """
    chat: DirectChat = context["chat"]
    messages, media = chat.get_chat_history()

    message_count = len(messages)
    start_index = 0

    if depth != -1:
        try:
            depth = int(depth)
            if depth < -1:
                raise ValueError
        except ValueError:
            return "Invalid depth value. Please provide a valid integer."

    if depth > message_count:
        chat.fetch_chat_history(depth)
        messages, media = chat.get_chat_history()
    if depth > 0 and depth < message_count:
        start_index = message_count - depth

    if not messages:
        return "No messages found to summarize."

    try:
        # Get config values
        config = Config()
        endpoint = config.get("llm.endpoint")
        api_key = config.get("llm.api_key")
        model = config.get("llm.model")
        streaming = config.get("llm.streaming")
        temperature = float(config.get("llm.temperature", 0.7))
        max_tokens = int(config.get("llm.max_tokens", 1000))

        if not endpoint:
            return "LLM endpoint not configured. Set it using: :config llm.endpoint=URL"

        if not model:
            return (
                "LLM model not configured. Set it using: :config llm.model=MODEL_NAME"
            )

        # Format messages for the LLM
        chat_title = chat.get_title()

        # Convert chat history to formatted text
        conversation_text = f"Chat title: {chat_title}\n\n"

        for msg_info in messages[start_index:]:
            sender = msg_info.message.sender
            content = msg_info.message.content

            if msg_info.reply_to:
                reply_sender = msg_info.reply_to.sender
                reply_content = msg_info.reply_to.content
                conversation_text += f"{sender} (replying to {reply_sender}'s '{reply_content}'): {content}\n"
            else:
                conversation_text += f"{sender}: {content}\n"

            if msg_info.reactions:
                reaction_text = ", ".join(
                    [f"{user}: {emoji}" for user, emoji in msg_info.reactions.items()]
                )
                conversation_text += f"[Reactions: {reaction_text}]\n"

            conversation_text += "\n"

        # Create LLM request
        system_prompt = config.get(
            "llm.summary_system_prompt",
            "You are a helpful assistant that summarizes Instagram direct message conversations. "
            "Your task is to create a concise summary of the conversation that includes: "
            "1. The main topics discussed in the conversation. "
            "2. Any action items, decisions, or plans mentioned. "
            "The summary should be objective and focus on the content of the conversation. "
            "Write in a clear, concise style suitable for quick reading. "
            "You must not try to format your output with bold or italics text. Do not use asterisks (*).",
        )

        # Configure OpenAI client
        openai.base_url = endpoint
        if api_key:
            openai.api_key = api_key
        else:
            # Some local endpoints don't require an API key
            openai.api_key = ""

        # Make API call to the OpenAI-compatible endpoint
        response = openai.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Here is the conversation to summarize:\n\n{conversation_text}",
                },
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            stream=streaming,
        )

        if streaming:

            def stream_summary():
                yield f"Chat Summary for: {chat_title}\n\n"
                for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content

            return stream_summary()
        else:
            summary = response.choices[0].message.content.strip()
            return f"Chat Summary for: {chat_title}\n\n{summary}"

    except Exception as e:
        return f"Failed to summarize chat: {str(e)}"


@cmd_registry.register("help", "Show available commands", shorthand="h")
def show_help(context) -> str:
    """
    Show available commands and their descriptions
    """
    return cmd_registry.get_help()
