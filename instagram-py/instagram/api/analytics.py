from datetime import datetime, timedelta

# import re
from instagram.client import ClientWrapper
from instagram.api.direct_messages import DirectMessages
import curses
import math
import time
from collections import Counter

from instagram.utils.loading import with_loading_screen
from instagram.utils.notification_utils import (
    get_notification_name,
    format_usernames_in_text,
)


def fetch_updates() -> dict:
    """Fetches latest updates from Instagram and returns them."""
    client = ClientWrapper()
    cl = client.login_by_session()
    dm = DirectMessages(client)
    # Get latest updates
    data = cl.news_inbox_v1()

    # Get unread messages count
    threads_unread = cl.direct_threads(selected_filter="unread", thread_message_limit=1)
    unread_messages = len(threads_unread)

    return {
        "data": data,
        "threads_unread": threads_unread,
        "unread_messages": unread_messages,
        "dm": dm,
    }


def render_updates(stdscr) -> None:
    """Render Instagram updates in a curses window."""

    # Display a loading screen while fetching updates
    updates = with_loading_screen(
        stdscr, fetch_updates, text="Fetching Instagram updates..."
    )
    data = updates["data"]
    threads_unread = updates["threads_unread"]
    unread_messages = updates["unread_messages"]
    dm = updates["dm"]
    index = 0

    def display_updates(stdscr, data) -> None:
        """
        Display updates in a structured format using curses.
        This function is not scrollable and may result in overflow of certain windows.
        This issue might or might not be addressed with a scrollable element.
        """
        # Setup colors
        while True:
            curses.start_color()
            curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)
            curses.init_pair(2, curses.COLOR_CYAN, curses.COLOR_BLACK)
            curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)
            curses.init_pair(4, curses.COLOR_WHITE, curses.COLOR_BLUE)
            curses.init_pair(5, curses.COLOR_BLACK, curses.COLOR_WHITE)
            curses.init_pair(6, curses.COLOR_YELLOW, curses.COLOR_WHITE)
            # Get screen dimensions
            height, width = stdscr.getmaxyx()

            # Adjust window sizes to fit screen
            title_height = 3
            stats_height = 5
            footer_height = 1
            messages_height = 10
            # updates_height = len(data['new_stories']) * 3 + 4 # 3 lines per update
            updates_height = height - (
                title_height + stats_height + footer_height + messages_height
            )

            nonlocal index

            # Create windows with adjusted positions
            title_win = curses.newwin(title_height, width, 0, 0)
            stats_win = curses.newwin(stats_height, width, title_height, 0)
            messages_win = curses.newwin(
                messages_height, width, title_height + stats_height, 0
            )
            updates_win = curses.newwin(
                updates_height, width, title_height + stats_height + messages_height, 0
            )

            # Title block
            title_win.bkgd(" ", curses.color_pair(4))
            title_win.border()
            title_win.addstr(
                1, 2, "Instagram Activity Dashboard".center(width - 4), curses.A_BOLD
            )

            # Stats block
            stats_win.border()
            stats = [
                ("System Status", data["status"]),
                (
                    "Total Updates",
                    str(
                        len(data.get("new_stories", []))
                        + len(data.get("old_stories", []))
                    ),
                ),
            ]

            if "story_mentions" in data:
                stats.append(
                    ("Story Mentions", data["story_mentions"]["mentions_count_string"])
                )

            for idx, (label, value) in enumerate(stats):
                stats_win.addstr(idx + 1, 2, f"▶ {label}:", curses.color_pair(2))
                stats_win.addstr(idx + 1, 20, value, curses.color_pair(1))

            messages_win.border()
            messages_win.addstr(1, 2, "▶ Unread Messages:", curses.color_pair(2))
            messages_win.addstr(1, 20, str(unread_messages), curses.color_pair(1))

            if unread_messages > 0:
                msg_row = 2
                for i in range(0, len(threads_unread), 2):  # Step by 2 to handle pairs
                    if msg_row < messages_height:  # Prevent overflow
                        # First user in pair
                        user1 = threads_unread[i].thread_title or "Unknown"
                        messages_win.addstr(
                            msg_row,
                            4,
                            f"{user1:<30}",
                            curses.color_pair(3)
                            if i != index
                            else curses.color_pair(6),
                        )

                        # Second user in pair (if exists)
                        if i + 1 < len(threads_unread):
                            user2 = threads_unread[i + 1].thread_title or "Unknown"
                            messages_win.addstr(
                                msg_row,
                                35,
                                f"{user2:<30}",
                                curses.color_pair(3)
                                if i + 1 != index
                                else curses.color_pair(6),
                            )

                        msg_row += 1

            # Updates block
            updates_win.border()
            updates_win.addstr(
                1,
                2,
                "━━━ Recent Activity ━━━".center(width - 4),
                curses.color_pair(2) | curses.A_BOLD,
            )

            row = 3
            max_updates = (updates_height - 4) // 3  # Maximum updates that can fit

            # NOTE: I removed this because we are running out of real estates lol
            if len(data["new_stories"]) < max_updates:
                updates = data["new_stories"] + data["old_stories"]
            else:
                updates = data["new_stories"]
            # updates = data["new_stories"][:max_updates]
            for update in updates[:max_updates]:
                notif_name = update["notif_name"]
                notif_name = get_notification_name(notif_name)
                rich_text = update["args"]["rich_text"]
                rich_text = format_usernames_in_text(rich_text)
                timestamp = datetime.fromtimestamp(
                    update["args"]["timestamp"]
                ).strftime("%H:%M %d/%m")

                updates_win.addstr(row, 2, "►", curses.color_pair(2))
                updates_win.addstr(
                    row, 4, notif_name, curses.color_pair(2) | curses.A_BOLD
                )
                updates_win.addstr(row + 1, 4, rich_text[: width - 8])
                updates_win.addstr(row + 1, width - 12, timestamp, curses.color_pair(3))
                row += 3

            # Footer
            stdscr.addstr(
                height - 1,
                1,
                "Use arrow keys and hjkl to navigate unread chats. Press q to exit",
                curses.A_DIM,
            )

            # Refresh all windows
            stdscr.refresh()
            title_win.refresh()
            stats_win.refresh()
            messages_win.refresh()
            updates_win.refresh()
            c = stdscr.getch()
            if c == curses.KEY_LEFT or c == ord("h"):
                index = max(0, index - 1)
            elif c == curses.KEY_RIGHT or c == ord("l"):
                index = min(unread_messages - 1, index + 1)
            elif c == curses.KEY_UP or c == ord("k"):
                index = max(0, index - 2)
            elif c == curses.KEY_DOWN or c == ord("j"):
                index = min(unread_messages - 1, index + 2)
            elif c == ord("\n"):
                from instagram.chat_ui.interface.chat_interface import ChatInterface

                username = threads_unread[index].users[0].username
                chat = with_loading_screen(
                    stdscr, dm.search_by_username, "Fetching Direct Chat", username
                )
                ChatInterface(stdscr, chat).run()
            elif c == ord("q"):
                break

    display_updates(stdscr, data)


def show_updates() -> None:
    curses.wrapper(render_updates)


class CursesBarGraph:
    def __init__(self):
        self._window = None
        self._max = 100  # max graph height

    def __enter__(self):
        self._window = curses.initscr()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        curses.endwin()

    def Update(self, values, hold=False):
        assert self._window
        h, w = self._window.getmaxyx()
        self._max = max(1, max(values))
        per_bucket = max(1, math.ceil(float(len(values)) / (w - 1)))
        self._window.erase()

        spacing = 2
        max_col_pos = 0
        for i, v in enumerate(self._AveragedChunks(values, per_bucket)):
            col_pos = i * spacing
            if col_pos < w:
                self._DrawBar(col_pos, v, h)
                max_col_pos = col_pos

        self._DrawAxisLabels(h, w, max_col_pos, len(values))
        self._window.refresh()

        if hold:
            self._window.nodelay(False)
            ch = self._window.getch()
            while ch != ord("q"):
                ch = self._window.getch()
            raise KeyboardInterrupt

        # Allow quitting by pressing 'q'
        self._window.nodelay(True)
        ch = self._window.getch()
        if ch == ord("q"):
            raise KeyboardInterrupt

    def _DrawBar(self, column_num, value, h):
        bar_len = max(0, min(h - 1, int(h * (value / self._max))))
        self._window.vline((h - 1) - bar_len, column_num, ord("|"), bar_len)

    def _DrawAxisLabels(self, h, w, max_column, num_values):
        self._window.addstr(0, 0, str(self._max))
        self._window.addstr(h - 1, 0, str(0))
        max_column_str = str(num_values)
        self._window.addstr(
            h - 1, min(max_column, w - (len(max_column_str) + 1)), max_column_str
        )

    @staticmethod
    def _AveragedChunks(iterable, n):
        summed_v = 0
        summed_count = 0
        for v in iterable:
            summed_v += v
            summed_count += 1
            if summed_count >= n:
                yield float(summed_v) / summed_count
                summed_v = 0
                summed_count = 0
        if summed_count > 0:
            yield float(summed_v) / summed_count


def get_brainrot_history(last_n_days):
    """Fetches liked Reels data and returns a list of counts per day."""
    cl = ClientWrapper().login_by_session()
    data = cl.liked_medias(amount=30)

    if not data:
        return [0] * last_n_days

    first_date = data[0].taken_at.date()
    last_week = []

    for media in data:
        if media.media_type == 2:
            media_date = media.taken_at.date()
            if 0 <= (first_date - media_date).days < last_n_days:
                last_week.append(media_date)

    days = [first_date - timedelta(days=i) for i in range(last_n_days)]
    reels_per_day = Counter(last_week)
    return [reels_per_day.get(day, 0) for day in days][::-1]


def analytics_bar_graph(last_n_days=7):
    """Draw bar graph gradually and wait until the user presses 'q' to quit."""
    with CursesBarGraph() as bar_graph:
        values = get_brainrot_history(last_n_days)
        try:
            # Start with all zeros
            current_values = [0] * last_n_days

            # Update 2 days at a time
            for i in range(0, last_n_days):
                current_values[i : i + 1] = values[i : i + 1]
                if i >= last_n_days - 1:
                    bar_graph.Update(current_values, hold=True)
                else:
                    bar_graph.Update(current_values)
                time.sleep(0.2)  # Add delay for animation effect

        except KeyboardInterrupt:
            return


if __name__ == "__main__":
    # analytics_bar_graph(30)
    show_updates()
