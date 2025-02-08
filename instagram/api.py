from datetime import datetime, timedelta
from client import Client
import curses
from collections import Counter
import matplotlib.pyplot as plt

def show_updates():
    """Fetches and displays latest updates"""

    cl = Client().login_by_session()

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

def analytics(last_n_days=30):
    """Count the number of reels you liked in the last week and generate a line graph for 
    the number of reels liked per day in the last week"""

    cl = Client().login_by_session()
    data = cl.liked_medias(amount=30)

    last_week = []

    # We start counting from the most recent reel liked
    first_date = data[0].taken_at.date()

    # Collect liked reels in the last week starting from the first date
    for media in data:
        if media.media_type == 2:  # check if it's a reel
            media_date = media.taken_at.date()
            if first_date - media_date < timedelta(days=last_n_days):
                last_week.append(media_date)

    # Count the number of reels liked per day in the last 7 days starting from the first date
    days = [first_date - timedelta(days=i) for i in range(last_n_days)]
    reels_per_day = Counter(last_week)

    x = [str(day) for day in days]
    y = [reels_per_day.get(day, 0) for day in days]

    def plot_line_graph(x, y):
        # Create a plot
        plt.figure(figsize=(10, 6))
        plt.plot(x, y, marker='o', color='b', linestyle='-', markersize=8)
        plt.title(f'Number of Reels Liked Per Day in Last {last_n_days} Days')
        plt.xlabel('Date')
        plt.ylabel('Number of Reels Liked')
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.show()

    plot_line_graph(x, y)

    # def display_analytics(stdscr):
    #     stdscr.clear()
    #     stdscr.addstr(0, 0, "Reels Liked in the Last Week", curses.A_BOLD)
    #     stdscr.addstr(2, 0, "Date", curses.A_UNDERLINE)
    #     stdscr.addstr(2, 20, "Reels Liked", curses.A_UNDERLINE)

    #     for idx, day in enumerate(days, start=3):
    #         reels_liked = reels_per_day[day]
    #         stdscr.addstr(idx, 0, day.strftime('%Y-%m-%d'))
    #         stdscr.addstr(idx, 20, str(reels_liked))

    #     stdscr.refresh()
    #     stdscr.getch()

    # curses.wrapper(display_analytics)

if __name__ == "__main__":
    analytics()