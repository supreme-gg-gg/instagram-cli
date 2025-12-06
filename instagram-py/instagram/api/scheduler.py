import sched
import time
import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
from instagram.client import ClientWrapper


class MessageScheduler:
    """
    A simple message scheduler that uses the `sched` module to schedule messages.
    Messages are stored in a JSON file for persistence.
    It is implemented as a singleton class to ensure there is only one instance running.
    Once initialized on chat startup, it will load any pending tasks from the JSON file
    and other interfaces can access it by calling `MessageScheduler.get_instance()`.

    NOTE: you must provide a filepath when creating the instance for the first time.
    Subsequent calls to `get_instance()` will return the same instance.
    """

    _instance: Optional["MessageScheduler"] = None
    _lock = threading.Lock()

    def __new__(cls, client: ClientWrapper = None, task_file: Path = None):
        with cls._lock:
            if cls._instance is None:
                if task_file is None or not task_file.exists():
                    raise ValueError(
                        "Task file path is required and must exist for initial creation."
                    )
                if client is None:
                    raise ValueError(
                        "ClientWrapper instance is required for initial creation"
                    )
                instance = super().__new__(cls)
                instance._initialized = False
                instance.client = client
                cls._instance = instance
            return cls._instance

    def __init__(self, client: ClientWrapper = None, task_file: Path = None):
        # Only initialize once
        if self._initialized:
            return

        self.scheduler = sched.scheduler(time.time, time.sleep)
        self.task_file = task_file
        self.client = client
        self.tasks = self.load_tasks()
        self._initialized = True
        self.running = False

        if self.tasks and not self.running:
            self.schedule_tasks_on_startup()

    def start_scheduler(self):
        """Start the scheduler in a separate thread if it's not already running."""
        if not self.running:
            self.running = True
            threading.Thread(target=self._run_scheduler, daemon=True).start()

    def _run_scheduler(self):
        """Internal method to run the scheduler."""
        while self.running:
            self.scheduler.run(blocking=False)  # non blocking
            time.sleep(60)  # check new tasks

    def load_tasks(self):
        """Load scheduled tasks from JSON file."""
        if not self.task_file.exists():
            return []
        with open(self.task_file, "r") as f:
            try:
                tasks = json.load(f)
                return tasks
            except json.JSONDecodeError:  # Handle empty file
                return []

    def save_tasks(self):
        """Save tasks to JSON file."""
        with open(self.task_file, "w") as f:
            json.dump(self.tasks, f, indent=4)

    def add_task(
        self,
        thread_id: str,
        send_time: str,
        message: str,
        display_name: str | None = None,
    ) -> str:
        """
        Schedule a new task.
        - `send_time` should be in ISO format: 'YYYY-MM-DD HH:MM:SS'
        """
        try:
            dt = datetime.strptime(send_time, "%Y-%m-%d %H:%M:%S")
            delay = (dt - datetime.now().replace(microsecond=0)).total_seconds()

            if delay <= 0:
                return "Error: Cannot schedule a message in the past. **Make sure you use 24-hour format.**"

            task = {"thread_id": thread_id, "send_time": send_time, "message": message}
            if display_name:
                task["display_name"] = display_name
            self.tasks.append(task)
            self.save_tasks()

            # Schedule execution
            self.scheduler.enter(delay, 1, self.execute_task, argument=(task,))

            self.start_scheduler()

            return f"Scheduled message for {send_time}"

        except ValueError:
            return "Error: Invalid datetime format. Use 'YYYY-MM-DD HH:MM:SS'."

    def handle_overdue_tasks(self, screen, overdue: List[Dict]) -> None:
        """
        Handle overdue tasks using curses interface.
        This function displays the overdue tasks in a centered window.
        """
        import curses

        # Save current screen state
        curses.def_prog_mode()
        screen.clear()

        # Get screen dimensions and calculate window size
        height, width = screen.getmaxyx()
        win_height = min(len(overdue) * 4 + 5, height // 2)
        win_width = min(width - 4, 80)  # Set max width to 80 or screen width - 4

        # Calculate center position
        start_y = (height - win_height) // 2
        start_x = (width - win_width) // 2

        win = curses.newwin(win_height, win_width, start_y, start_x)
        win.box()

        # Setup colors
        curses.start_color()
        curses.init_pair(1, curses.COLOR_WHITE, curses.COLOR_RED)
        curses.init_pair(2, curses.COLOR_BLACK, curses.COLOR_WHITE)

        # Display header centered in window
        header = "OVERDUE MESSAGES"
        header_x = (win_width - len(header)) // 2
        win.addstr(1, header_x, header, curses.A_BOLD | curses.color_pair(1))

        current_task = 0
        while current_task < len(overdue):
            task = overdue[current_task]

            # Clear window and redraw border and header for each task
            win.clear()
            win.box()
            win.addstr(1, header_x, header, curses.A_BOLD | curses.color_pair(1))

            # Display task details
            line = 2
            win.addstr(line, 2, f"Scheduled for: {task['send_time']}")
            line += 1
            if "display_name" in task:
                win.addstr(line, 2, f"Chat with: {task['display_name']}")
                line += 1
            win.addstr(line, 2, f"Message: {task['message'][: win_width - 4]}")
            line += 1
            win.addstr(
                line, 2, "Press (S)end now, (D)elete, or (Q)uit", curses.color_pair(2)
            )

            win.refresh()

            # Wait for user input from the window
            key = win.getch()
            if key in (ord("s"), ord("S")):
                try:
                    self.execute_task(task)
                    status = "Message sent successfully"
                except Exception as e:
                    status = f"Error: {str(e)}"
                win.addstr(line + 1, 2, status.ljust(win_width - 4))
                win.refresh()
                curses.napms(1000)  # Show status for 1 second
                current_task += 1
            elif key in (ord("d"), ord("D")):
                self.remove_task(task)
                current_task += 1
            elif key in (ord("q"), ord("Q")):
                break

        # Clear the window and refresh the main screen
        win.clear()
        screen.clear()
        curses.reset_prog_mode()

    def schedule_tasks_on_startup(self, screen=None):
        """Schedule pending tasks and handle overdue ones if screen is provided."""
        now = datetime.now()

        overdue = []

        # Schedule remaining valid tasks
        for task in self.tasks.copy():
            dt = datetime.strptime(task["send_time"], "%Y-%m-%d %H:%M:%S")
            delay = (dt - now).total_seconds()

            if delay > 0:
                self.scheduler.enter(delay, 1, self.execute_task, argument=(task,))
            else:
                overdue.append(task)

        if overdue and screen:
            self.handle_overdue_tasks(screen, overdue)

        # Start the scheduler
        self.start_scheduler()

    def execute_task(self, task):
        """Execute scheduled task and remove from storage."""
        # print(f"\n[SENDING MESSAGE] Thread ID: {task['thread_id']} | Message: {task['message']}")
        self.client.insta_client.direct_answer(task["thread_id"], task["message"])

        self.remove_task(task)

    def cancel_latest_task(self) -> str:
        """Cancel the latest scheduled task."""
        if self.tasks:
            task = self.tasks[-1]
            self.remove_task(task)
            return f"Cancelled task for {task['send_time']}"
        return "Error: No tasks to cancel."

    def remove_task(self, task: dict) -> None:
        """Remove a task."""
        if task in self.tasks:
            self.tasks.remove(task)
            self.save_tasks()

    @classmethod
    def get_instance(
        cls, client: ClientWrapper = None, task_file: Path = None
    ) -> "MessageScheduler":
        """Get or create the MessageScheduler instance"""
        return cls(client, task_file)

    @classmethod
    def clear_instance(cls):
        """Clear the singleton instance (mainly for testing)"""
        with cls._lock:
            cls._instance = None


# Example usage
if __name__ == "__main__":
    scheduler = MessageScheduler.get_instance()
    scheduler.add_task(
        "12345", "2025-02-09 15:30:00", "Hello, this is a scheduled message!"
    )
