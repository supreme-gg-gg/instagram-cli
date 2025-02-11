from instagram.commands import CommandRegistry
from instagram.api import DirectChat
from datetime import datetime
import threading
import time
from typing import List, Tuple

cmd_registry = CommandRegistry()

@cmd_registry.register("upload", "Upload a photo or video")
def upload_media(context, filepath: str) -> str:
    """
    Upload a photo or video to the chat. Supports .jpg, .png, .jpeg, and .mp4 files.
    Takes a file path relative from where the command is run.
    """
    chat: DirectChat = context["chat"]
    if filepath == "":
        return "No file specified"
    
    if filepath.endswith(".jpg") or filepath.endswith(".png") or filepath.endswith(".jpeg"):
        try:
            chat.send_photo(filepath)
            return "Successfully uploaded photo at " + filepath
        except Exception as e:
            return f"Failed to upload photo: {e}"
    elif filepath.endswith(".mp4"):
        try:
            chat.send_video(filepath)
        except Exception as e:
            return f"Failed to upload video: {e}"
    else:
        return "Unsupported file type"

@cmd_registry.register("back", "Go back to the chat list")
def back_to_chat_list(context) -> str:
    """
    Go back to the chat list. Returns a special value that the chat interface will recognize.
    """
    return "__BACK__"

# TODO: Index all the media when loading and show them when rendering chat, keep track of index
# TODO: Use the index to get the right media, download it, and show it using default viewer on device, not terminal
# We won't support watching reels because this is anti-brainrot lmao
"""
Helpful api:
photo_path = cl.photo_download(cl.media_pk_from_url('https://www.instagram.com/p/BgqFyjqloOr/'))
video_path = cl.video_download(cl.media_pk_from_url('https://www.instagram.com/p/B3rFQPblq40/'))
"""

# @cmd_registry.register("view", "View media in chat")
# def view_media(context, index: int):
#     raise NotImplementedError("Not implemented yet")

# # Store scheduled messages as (timestamp, message, chat) tuples
# scheduled_messages: List[Tuple[float, str, DirectChat]] = []
# scheduler_lock = threading.Lock()
# stop_scheduler = threading.Event()

# def scheduler_thread():
#     """Background thread that checks and sends scheduled messages"""
#     while not stop_scheduler.is_set():
#         now = time.time()
#         with scheduler_lock:
#             # Find messages that should be sent
#             to_send = [(msg, chat) for ts, msg, chat in scheduled_messages if ts <= now]
#             # Remove them from scheduled list
#             scheduled_messages[:] = [(ts, msg, chat) for ts, msg, chat in scheduled_messages if ts > now]
            
#         # Send messages outside the lock
#         for msg, chat in to_send:
#             try:
#                 chat.send_text(msg)
#             except Exception as e:
#                 print(f"Failed to send scheduled message: {e}")
        
#         time.sleep(1)  # Check every second

# # Start scheduler thread
# scheduler = threading.Thread(target=scheduler_thread, daemon=True)
# scheduler.start()

# @cmd_registry.register("schedule", "Schedule a message (format: HH:MM message)")
# def schedule_message(context, time_str: str, *message_parts: str):
#     chat: DirectChat = context['chat']
    
#     try:
#         # Parse time (HH:MM)
#         hour, minute = map(int, time_str.split(':'))
#         now = datetime.now()
#         schedule_time = now.replace(hour=hour, minute=minute)
        
#         # If the time is in the past, schedule for tomorrow
#         if schedule_time < now:
#             schedule_time = schedule_time.replace(day=now.day + 1)
        
#         # Join message parts back together
#         message = ' '.join(message_parts)
#         if not message:
#             return "No message specified"
            
#         # Add to scheduled messages
#         with scheduler_lock:
#             scheduled_messages.append((schedule_time.timestamp(), message, chat))
            
#         return f"Message scheduled for {schedule_time.strftime('%H:%M')}"
        
#     except ValueError:
#         return "Invalid time format. Use HH:MM"

# @cmd_registry.register("list", "List all scheduled messages")
# def list_scheduled(context):
#     with scheduler_lock:
#         if not scheduled_messages:
#             return "No scheduled messages"
            
#         return "\n".join([
#             f"{datetime.fromtimestamp(ts).strftime('%H:%M')} - {msg[:30]}..."
#             for ts, msg, _ in scheduled_messages
#         ])

# @cmd_registry.register("clear", "Clear all scheduled messages")
# def clear_scheduled(context):
#     with scheduler_lock:
#         count = len(scheduled_messages)
#         scheduled_messages.clear()
#         return f"Cleared {count} scheduled messages"

@cmd_registry.register("help", "Show available commands")
def show_help(context) -> str:
    """
    Show available commands and their descriptions
    """
    return cmd_registry.get_help()
