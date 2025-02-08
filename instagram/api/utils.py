from datetime import datetime, timedelta
from instagram.client import ClientWrapper
import curses, math, time
from collections import Counter

def show_updates():
    """Fetches and displays latest updates"""

    cl = ClientWrapper().login_by_session()

    data = cl.news_inbox_v1()

    # last_update_time = datetime.fromtimestamp(data['last_updated']).strftime('%Y-%m-%d %H:%M:%S')
    def display_updates(stdscr, data):
        stdscr.clear()
        status = data['status']
        total_updates = len(data.get('new_stories', [])) + len(data.get('old_stories', []))
        story_mentions = data["story_mentions"]["mentions_count_string"]

        stdscr.addstr(0, 0, f"System status: {status}")
        stdscr.addstr(1, 0, f"Total updates available: {total_updates}")
        stdscr.addstr(2, 0, f"Story mentions: {story_mentions}")

        if total_updates > 0:
            stdscr.addstr(4, 0, "Latest Updates:")
            for idx, update in enumerate(data['new_stories'][:5], start=5):
                notif_name = update["notif_name"]
                rich_text = update['args']["rich_text"]
                timestamp = datetime.fromtimestamp(update['args']['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
                stdscr.addstr(idx, 0, f"{notif_name} - {rich_text} (Received at {timestamp})")

        stdscr.refresh()
        stdscr.getch()

    curses.wrapper(display_updates, data)

class CursesBarGraph:
    def __init__(self):
        self._window = None
        self._max = 100  # max graph height

    def __enter__(self):
        self._window = curses.initscr()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        curses.endwin()

    def Update(self, values):
        assert self._window
        h, w = self._window.getmaxyx()
        self._max = max(1, max(values))
        per_bucket = max(1, math.ceil(float(len(values)) / (w - 1)))
        self._window.erase()

        spacing = 2
        max_col_pos = 0
        for i, v in enumerate(_AveragedChunks(values, per_bucket)):
            col_pos = i * spacing
            if col_pos < w:
                self._DrawBar(col_pos, v, h)
                max_col_pos = col_pos

        self._DrawAxisLabels(h, w, max_col_pos, len(values))
        self._window.refresh()

        # Allow quitting by pressing 'q'
        self._window.nodelay(True)
        ch = self._window.getch()
        if ch == ord('q'):
            raise KeyboardInterrupt

    def _DrawBar(self, column_num, value, h):
        bar_len = max(0, min(h - 1, int(h * (value / self._max))))
        self._window.vline((h - 1) - bar_len, column_num, ord('|'), bar_len)

    def _DrawAxisLabels(self, h, w, max_column, num_values):
        self._window.addstr(0, 0, str(self._max))
        self._window.addstr(h - 1, 0, str(0))
        max_column_str = str(num_values)
        self._window.addstr(
            h - 1,
            min(max_column, w - (len(max_column_str) + 1)),
            max_column_str
        )

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
    """Draw bar graph once and wait until the user presses 'q' to quit."""
    with CursesBarGraph() as bar_graph:
        values = get_brainrot_history(last_n_days)
        try:
            bar_graph.Update(values)
            while True:
                time.sleep(0.1)  # Keep the display until 'q' is pressed
        except KeyboardInterrupt:
            pass

if __name__ == '__main__':
    analytics_bar_graph(30)
