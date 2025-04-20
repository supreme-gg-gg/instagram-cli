from typing import Tuple
import logging
from difflib import SequenceMatcher
from typing import List, TypeVar, Callable, Optional, Union, Literal
import random
import time
import json
from pathlib import Path
from uuid import uuid4
import typer
from instagram.configs import Config

import instagrapi
from instagrapi import Client
import instagrapi.config
from instagrapi.exceptions import ClientError, UserNotFound, DirectThreadNotFound, ClientNotFoundError
import instagrapi.image_util
from instagrapi.types import User, DirectThread, DirectMessage
from instagrapi.extractors import extract_direct_thread, extract_direct_message
from instagrapi.exceptions import ClientError, UserNotFound
from instagrapi.types import User
from instagrapi.utils import dumps
from instagrapi.mixins.direct import SELECTED_FILTER, BOX

import requests
from PIL import Image, ImageOps

def setup_logging(name: str):
    """
    Logging is the de-facto standard for debugging in this project.
    This is because you can't simply print to console when running terminal app lol.
    This function sets up logging for the file with the given name.
    """
    logging.basicConfig(filename="debug.log", level=logging.DEBUG)

    # Configure logging to only capture logs from this script
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)  # Set desired log level

    # Optional: Define log format
    formatter = logging.Formatter('%(levelname)s: %(message)s')

    # Create file handler
    file_handler = logging.FileHandler('debug.log')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    # Apply handler to your logger
    logger.addHandler(file_handler)

    # Disable all other loggers (dependencies) 
    logging.getLogger().setLevel(logging.CRITICAL)

    return logger


def user_info_by_username_private(self: Client, username: str, use_cache: bool = True) -> User:
    """
    Get user object from username

    This is a modified version of the user_info_by_username method from the instagrapi library and only uses private API for faster results.

    Parameters
    ----------
    self: Client
        The instagrapi Client object
    username: str
        User name of an instagram account
    use_cache: bool, optional
        Whether or not to use information from cache, default value is True

    Returns
    -------
    User
        An object of User type
    """

    # Disable all other loggers (dependencies) so no http errors would be printed to console
    # This must be done again here to ensure all of them are actually disabled at the moment
    # See https://stackoverflow.com/a/36208664
    logging.getLogger().setLevel(logging.CRITICAL)

    username = str(username).lower()
    if not use_cache or username not in self._usernames_cache:
        user = self.user_info_by_username_v1(username)
        self._users_cache[user.pk] = user
        self._usernames_cache[user.username] = user.pk
    return self.user_info(self._usernames_cache[username])

def direct_threads_chunk(
    self: Client,
    amount: int = 20,
    selected_filter: SELECTED_FILTER = "",
    box: BOX = "",
    thread_message_limit: Optional[int] = None,
    cursor: str = None
) -> Tuple[List[DirectThread], str]:
    """
    Get direct message threads

    Parameters
    ----------
    amount: int, optional
        Minimum number of media to return, default is 20
    selected_filter: str, optional
        Filter to apply to threads (flagged or unread)
    box: str, optional
        Box to gather threads from (primary or general) (business accounts only)
    thread_message_limit: int, optional
        Thread message limit, deafult is 10
    cursor: str, optional
        Cursor for pagination, default is None

    Returns
    -------
    List[DirectThread]
        A list of objects of DirectThread
    str
        New cursor for pagination
    """

    threads = []
    # self.private_request("direct_v2/get_presence/")
    while True:
        threads_chunk, cursor = self.direct_threads_chunk(
            selected_filter, box, thread_message_limit, cursor
        )
        for thread in threads_chunk:
            threads.append(thread)

        if not cursor or (amount and len(threads) >= amount):
            break
    # if amount:
    #     threads = threads[:amount]
    return (threads, cursor)

def direct_thread_chunk(self: Client, thread_id: int, amount: int = 20, cursor: str = None) -> Tuple[DirectThread, str]:
    """
    Get a chunk of messages in a direct message thread along with the thread's metadata

    This is a modified version of the direct_thread method from the instagrapi library.

    Parameters
    ----------
    thread_id: int
        Unique identifier of a Direct Message thread

    amount: int, optional
        Minimum number of media to return, default is 20
    
    cursor: str, optional
        Cursor for pagination, default is None

    Returns
    -------
    Tuple[DirectThread, str]
        A tuple containing the DirectThread object and the cursor for the next chunk of messages
    """
    assert self.user_id, "Login required"
    params = {
        "visual_message_return_type": "unseen",
        "direction": "older",
        "seq_id": "40065",  # 59663
        "limit": "20",
    }
    items = []
    while True:
        if cursor:
            params["cursor"] = cursor
        try:
            result = self.private_request(
                f"direct_v2/threads/{thread_id}/", params=params
            )
        except ClientNotFoundError as e:
            raise DirectThreadNotFound(e, thread_id=thread_id, **self.last_json)
        thread = result["thread"]
        for item in thread["items"]:
            items.append(item)
        cursor = thread.get("oldest_cursor")
        if not cursor or not thread.get("has_older", False) or (amount and len(items) >= amount):
            break
    # We don't want to slice items here because it will break the pagination
    # if amount:
    #     items = items[:amount]
    thread["items"] = items
    return (extract_direct_thread(thread), cursor)

def direct_send_media(
    self: Client,
    path: Path,
    user_ids: List[int] = [],
    thread_ids: List[int] = [],
    content_type: str = "photo",
) -> DirectMessage:
    """
    Send a direct media file of any aspect ratio to list of users or threads

    This is a modified version of the direct_send_file method from the instagrapi library.

    Parameters
    ----------
    path: Path
        Path to file that will be posted on the thread
    user_ids: List[int]
        List of unique identifier of Users id
    thread_ids: List[int]
        List of unique identifier of Direct Message thread id
    
    content_type: str, optional
        Type of content to send, either 'photo' or 'video', default is 'photo'

    Returns
    -------
    DirectMessage
        An object of DirectMessage
    """
    assert self.user_id, "Login required"
    assert (user_ids or thread_ids) and not (
        user_ids and thread_ids
    ), "Specify user_ids or thread_ids, but not both"
    method = f"configure_{content_type}"
    token = self.generate_mutation_token()
    nav_chains = [
        (
            "6xQ:direct_media_picker_photos_fragment:1,5rG:direct_thread:2,"
            "5ME:direct_quick_camera_fragment:3,5ME:direct_quick_camera_fragment:4,"
            "4ju:reel_composer_preview:5,5rG:direct_thread:6,5rG:direct_thread:7,"
            "6xQ:direct_media_picker_photos_fragment:8,5rG:direct_thread:9"
        ),
        (
            "1qT:feed_timeline:1,7Az:direct_inbox:2,7Az:direct_inbox:3,"
            "5rG:direct_thread:4,6xQ:direct_media_picker_photos_fragment:5,"
            "5rG:direct_thread:6,5rG:direct_thread:7,"
            "6xQ:direct_media_picker_photos_fragment:8,5rG:direct_thread:9"
        ),
    ]
    kwargs = {}
    data = {
        "action": "send_item",
        "is_shh_mode": "0",
        "send_attribution": "direct_thread",
        "client_context": token,
        "mutation_token": token,
        "nav_chain": random.choices(nav_chains),
        "offline_threading_id": token,
    }
    if content_type == "video":
        data["video_result"] = ""
        kwargs["to_direct"] = True
    if content_type == "photo":
        data["send_attribution"] = "inbox"
        data["allow_full_aspect_ratio"] = "true"
    if user_ids:
        data["recipient_users"] = dumps([[int(uid) for uid in user_ids]])
    if thread_ids:
        data["thread_ids"] = dumps([int(tid) for tid in thread_ids])
    path = Path(path)
    upload_id = str(int(time.time() * 1000))
    match content_type:
        case "photo":
            upload_id, width, height = photo_rupload(self, path, upload_id)[:3]
        case "video":
            upload_id, width, height = self.video_rupload(path, upload_id)[:3]
    data["upload_id"] = upload_id
    # data['content_type'] = content_type
    result = self.private_request(
        f"direct_v2/threads/broadcast/{method}/",
        data=self.with_default_data(data),
        with_signature=False,
    )
    return extract_direct_message(result["payload"])

def photo_rupload(
    self: Client,
    path: Path,
    upload_id: str = "",
    to_album: bool = False,
    for_story: bool = False,
) -> tuple:
    """
    Upload photo to Instagram

    Parameters
    ----------
    path: Path
        Path to the media
    upload_id: str, optional
        Unique upload_id (String). When None, then generate automatically. Example from video.video_configure
    to_album: bool, optional
    for_story: bool, optional
        Useful for resize util only

    Returns
    -------
    tuple
        (Upload ID for the media, width, height)
    """
    assert isinstance(path, Path), f"Path must been Path, now {path} ({type(path)})"
    valid_extensions = [".jpg", ".jpeg", ".png", ".webp"]
    if path.suffix.lower() not in valid_extensions:
        raise ValueError(
            "Invalid file format. Only JPG/JPEG/PNG/WEBP files are supported."
        )
    image_type = "image/jpeg"
    if path.suffix.lower() == ".png":
        image_type = "image/png"
    elif path.suffix.lower() == ".webp":
        image_type = "image/webp"

    # upload_id = 516057248854759
    upload_id = upload_id or str(int(time.time() * 1000))
    assert path, "Not specified path to photo"
    waterfall_id = str(uuid4())
    # upload_name example: '1576102477530_0_7823256191'
    upload_name = "{upload_id}_0_{rand}".format(
        upload_id=upload_id, rand=random.randint(1000000000, 9999999999)
    )
    # media_type: "2" when from video/igtv/album thumbnail, "1" - upload photo only
    rupload_params = {
        "retry_context": '{"num_step_auto_retry":0,"num_reupload":0,"num_step_manual_retry":0}',
        "media_type": "1",  # "2" if upload_id else "1",
        "xsharing_user_ids": "[]",
        "upload_id": upload_id,
        "image_compression": json.dumps(
            {"lib_name": "moz", "lib_version": "3.1.m", "quality": "80"}
        ),
    }
    if to_album:
        rupload_params["is_sidecar"] = "1"
    if for_story:
        photo_data, photo_size = instagrapi.image_util.prepare_image(
            str(path),
            max_side=1080,
            aspect_ratios=(9 / 16, 90 / 47),
            max_size=(1080, 1920),
        )  # Story must be 1080x1920
    else:
        photo_data, photo_size = instagrapi.image_util.prepare_image(
            str(path), 
            max_size=(4096, 4096),  # TODO: Allow configurable max size
            aspect_ratios=None  # Disable cropping
        )
    photo_len = str(len(photo_data))
    headers = {
        "Accept-Encoding": "gzip",
        "X-Instagram-Rupload-Params": json.dumps(rupload_params),
        "X_FB_PHOTO_WATERFALL_ID": waterfall_id,
        "X-Entity-Type": image_type,
        "Offset": "0",
        "X-Entity-Name": upload_name,
        "X-Entity-Length": photo_len,
        "Content-Type": "application/octet-stream",
        "Content-Length": photo_len,
    }
    response = self.private.post(
        "https://{domain}/rupload_igphoto/{name}".format(
            domain=instagrapi.config.API_DOMAIN, name=upload_name
        ),
        data=photo_data,
        headers=headers,
    )
    self.request_log(response)
    if response.status_code != 200:
        self.logger.error(
            "Photo Upload failed with the following response: %s", response
        )
        last_json = self.last_json  # local variable for read in sentry
        raise PhotoNotUpload(response.text, response=response, **last_json)
    with Image.open(path) as im:
        width, height = im.size
    return upload_id, width, height

T = TypeVar("T")
def fuzzy_match(
    query: str,
    items: List[Union[str, T]],
    n: int = 1,
    cutoff: float = 0.6,
    getter: Optional[Callable[[Union[str, T]], str]] = None,
    key: Callable[[str], str] = lambda x: x.lower(),
    use_partial_ratio: bool = False
) -> Union[List[Tuple[Union[str, T], float]], Tuple[Union[str, T], float], None]:
    """
    Find the closest matching items using fuzzy string matching.
    This is an implementation of the fuzzywuzzy library without the dependency.
    Uses built-in SequenceMatcher to find similarity ratio between strings.
    
    Parameters:
    - query: String to match against
    - items: List of strings or objects to search through
    - n: Number of matches to return (if 1, returns single match or None)
    - cutoff: Minimum similarity ratio (0.0 to 1.0) required for matches
    - getter: Function to extract string from object (default: str)
    - key: Function to transform strings before comparison (default: lowercase)
    - use_partial_ratio: Use partial ratio instead of simple ratio (default: False)
    
    Returns:
    - If n=1: Tuple of (matched item, similarity ratio) or None if no match
    - If n>1: List of tuples (matched item, similarity ratio), sorted by ratio descending
    """
    if not items:
        return [] if n > 1 else None
    
    matcher = SequenceMatcher(None, key(query))
    matches = []

    for item in items:

        # Get string to match from item
        if getter is None:
            if isinstance(item, str):
                extracted = item
            else:
                extracted = str(item)
        else:
            extracted = getter(item)

        if use_partial_ratio:
            # Find the best matching substring
            s2 = key(extracted)
            matcher.set_seq2(s2)
            blocks = matcher.get_matching_blocks()
            ratios = []
            for _, j, size in blocks:
                if size == 0:
                    continue
                block = s2[j:j+size]
                m = SequenceMatcher(None, key(query), block)
                ratios.append(m.ratio())
            ratio = max(ratios) if ratios else 0
        else:
            matcher.set_seq2(key(extracted))
            ratio = matcher.ratio()
            
        if ratio >= cutoff:
            matches.append((item, ratio))
    
    matches.sort(key=lambda x: x[1], reverse=True)
    matches = matches[:n]
    
    return matches[0] if n == 1 and matches else matches if matches else None

def render_latex_online(latex_expr, output_path="latex_online.png", padding=None):
    """
    Render LaTeX expression and save as image online.
    More flexible and doesn't require LaTeX to be installed on your system.
    """
    # Encode LaTeX expression properly
    latex_expr = latex_expr.replace(" ", "%20")
    url = f"https://latex.codecogs.com/png.latex?\\dpi{{300}}\\bg_white {latex_expr}"
    
    # Fetch image from API
    response = requests.get(url)
    if response.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(response.content)
        
        # Open the image and add padding only if specified
        img = Image.open(output_path)
        if padding is not None:
            img = ImageOps.expand(img, border=padding, fill="white")
        img.save(output_path)

        return output_path
    else:
        raise requests.RequestException("Failed to fetch LaTeX image from API: " + response.text)

def render_latex_local(latex_expr, output_path="latex_local.png", padding=None):
    """
    Render LaTeX expression and save as image locally.
    NOTE: THIS REQUIRES LATEX TO BE INSTALLED ON YOUR SYSTEM.
    """
    import matplotlib.pyplot as plt

    # Create figure
    fig, ax = plt.subplots(figsize=(4, 2), dpi=300)  # High DPI for better resolution
    ax.text(0.5, 0.5, f"${latex_expr}$", fontsize=20, ha='center', va='center')
    ax.axis("off")
    plt.savefig(output_path, bbox_inches='tight', pad_inches=0.1, dpi=300)

    return output_path

def list_all_scheduled_tasks(filepath: str = None) -> list[dict]:
    """
    List all scheduled tasks for the current user from the JSON file.
    """
    if filepath is None:
        username = Config().get("login.current_username")
        if not username:
            typer.echo("You are not logged in. Please login first.\nSuggested action: `instagram auth login`")
            return []
        filepath = Path(Config().get("advanced.users_dir")) / username / "tasks.json"

    if not Path(filepath).exists():
        return []

    with open(filepath, "r") as f:
        return json.load(f)

def cancel_scheduled_task_by_index(index: int, filepath: str = None) -> str:
    """
    Cancel a scheduled task by index from the JSON file.
    NOTE: This does not need to involve the scheduler itself because
    on scheduler startup it will then load the new JSON tasks.
    """
    if filepath is None:
        username = Config().get("login.current_username")
        if not username:
            typer.echo("You are not logged in. Please login first.\nSuggested action: `instagram auth login`")
            return "You are not logged in. Please login first."
        filepath = Path(Config().get("advanced.users_dir")) / username / "tasks.json"

    tasks = list_all_scheduled_tasks(filepath)

    if index < 0 or index >= len(tasks):
        return "Invalid index. No task was cancelled."

    tasks.pop(index)

    with open(filepath, "w") as f:
        json.dump(tasks, f, indent=4)

    return f"Cancelled task at index {index}."
