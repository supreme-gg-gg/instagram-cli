import curses
import random
from datetime import datetime, timedelta

# Mock data for demonstration
user_activity = {
    'posts': random.randint(50, 200),
    'likes': random.randint(100, 5000),
    'comments': random.randint(50, 1000),
    'followers': random.randint(2000, 10000),
    'logins': random.randint(10, 30),
    'post_dates': [datetime.now() - timedelta(days=i) for i in range(30)],
}

def get_activity_stats():
    total_likes = user_activity['likes']
    total_posts = user_activity['posts']
    avg_likes_per_post = total_likes // total_posts if total_posts else 0

    return {
        'total_posts': total_posts,
        'avg_likes_per_post': avg_likes_per_post,
        'total_comments': user_activity['comments'],
        'total_followers': user_activity['followers'],
        'total_logins': user_activity['logins'],
        'follower_growth': random.randint(-100, 500),
        'active_days': len([date for date in user_activity['post_dates'] if date > datetime.now() - timedelta(days=30)]),
    }

def display_stats(stdscr):
    # Clear the screen and set up color pairs
    stdscr.clear()
    curses.start_color()
    curses.init_pair(1, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # Yellow on black
    curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)   # Green on black
    curses.init_pair(3, curses.COLOR_RED, curses.COLOR_BLACK)     # Red on black
    curses.init_pair(4, curses.COLOR_CYAN, curses.COLOR_BLACK)    # Cyan on black
    
    # Get the screen dimensions
    height, width = stdscr.getmaxyx()

    # Ensure there is enough space for the border and content
    if height < 10 or width < 40:
        stdscr.addstr(0, 0, "Terminal size is too small! Please resize the terminal.", curses.A_BOLD)
        stdscr.refresh()
        stdscr.getch()  # Wait for user input before quitting
        return

    # Get stats
    stats = get_activity_stats()

    # Create a border box for the stats layout
    stdscr.attron(curses.A_BOLD)
    top_border = "+" + "-" * (max(width - 2, 0)) + "+"
    stdscr.addstr(0, 0, top_border[:width])
    for i in range(1, height - 1):
        if width > 1:
            stdscr.addstr(i, 0, "|")
            stdscr.addstr(i, width - 1, "|")
    if height > 1:
        bottom_border = "+" + "-" * (max(width - 2, 0)) + "+"
        stdscr.addstr(height - 1, 0, bottom_border[:width])
    stdscr.attroff(curses.A_BOLD)

    # Start displaying the stats inside the box
    y_pos = 2

    # Header
    stdscr.attron(curses.A_BOLD)
    stdscr.addstr(y_pos, 2, "Instagram Activity Stats", curses.A_UNDERLINE)
    y_pos += 1
    stdscr.attroff(curses.A_BOLD)

    # Stats Display
    stdscr.attron(curses.color_pair(1))  # Yellow for header stats
    stdscr.addstr(y_pos, 2, f"Total Posts: {stats['total_posts']}")
    y_pos += 1
    stdscr.addstr(y_pos, 2, f"Average Likes Per Post: {stats['avg_likes_per_post']}")
    y_pos += 1
    stdscr.addstr(y_pos, 2, f"Total Comments: {stats['total_comments']}")
    y_pos += 1
    stdscr.addstr(y_pos, 2, f"Total Followers: {stats['total_followers']}")
    y_pos += 1
    stdscr.addstr(y_pos, 2, f"Follower Growth: {stats['follower_growth']}")
    y_pos += 1
    stdscr.addstr(y_pos, 2, f"Total Logins This Month: {stats['total_logins']}")
    y_pos += 1
    stdscr.addstr(y_pos, 2, f"Active Days in Last 30 Days: {stats['active_days']}")
    y_pos += 1
    stdscr.attroff(curses.color_pair(1))

    # Add a separator line between stats
    stdscr.addstr(y_pos, 2, "-" * (width - 4))
    y_pos += 1

    # Footer with some additional info (you can add more features here later)
    stdscr.attron(curses.color_pair(4))  # Cyan for footer
    stdscr.addstr(y_pos, 2, "Press 'q' to quit")
    stdscr.attroff(curses.color_pair(4))

    # Wait for user input
    while True:
        key = stdscr.getch()
        if key == ord('q'):  # Quit if user presses 'q'
            break

def main():
    curses.wrapper(display_stats)

if __name__ == "__main__":
    main()