import sched
import time
import json
import threading
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
from instagram.client import ClientWrapper

import logging
logger = logging.getLogger(__name__)
logging.basicConfig(filename='logs.log', level=logging.DEBUG)

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
    _instance: Optional['MessageScheduler'] = None
    _lock = threading.Lock()
    
    def __new__(cls, client: ClientWrapper = None, task_file: Path = None):
        with cls._lock:
            if cls._instance is None:
                if task_file is None or not task_file.exists():
                    raise ValueError("Task file path is required and must exist for initial creation.")
                if client is None:
                    raise ValueError("ClientWrapper instance is required for initial creation")
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
            self.scheduler.run(blocking=False) # non blocking
            time.sleep(60) # check new tasks

    def load_tasks(self):
        """Load scheduled tasks from JSON file."""
        if not self.task_file.exists():
            return []
        with open(self.task_file, "r") as f:
            try:
                tasks = json.load(f)
                return tasks
            except json.JSONDecodeError: # Handle empty file
                return []

    def save_tasks(self):
        """Save tasks to JSON file."""
        with open(self.task_file, "w") as f:
            json.dump(self.tasks, f, indent=4)

    def add_task(self, thread_id: str, send_time: str, message: str, display_name: str | None = None) -> str:
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

    def get_overdue_tasks(self) -> List[Dict]:
        """Get list of overdue tasks that need user attention."""
        now = datetime.now()
        overdue = []
        
        for task in self.tasks.copy():
            dt = datetime.strptime(task["send_time"], "%Y-%m-%d %H:%M:%S")
            delay = (dt - now).total_seconds()
            
            if delay <= 0:
                overdue.append(task)
                
        return overdue

    def handle_overdue_tasks(self, screen) -> None:
        """
        Handle overdue tasks using curses interface.
        This should be called when starting the chat interface.
        """
        import curses  # Import here to avoid circular imports
        
        overdue = self.get_overdue_tasks()
        if not overdue:
            return

        # Save current terminal state
        curses.def_prog_mode()
        screen.clear()

        # Create window for overdue messages
        height, width = screen.getmaxyx()
        win_height = min(len(overdue) * 4 + 5, height - 2)
        win = curses.newwin(win_height, width - 4, 2, 2)
        win.box()

        # Setup colors
        curses.init_pair(1, curses.COLOR_WHITE, curses.COLOR_RED)
        curses.init_pair(2, curses.COLOR_BLACK, curses.COLOR_WHITE)

        # Display header
        header = "OVERDUE MESSAGES"
        win.addstr(1, (width - 6 - len(header)) // 2, header, curses.A_BOLD | curses.color_pair(1))
        
        current_task = 0
        while current_task < len(overdue):
            task = overdue[current_task]
            
            # Display task info
            current_line = current_task * 4 + 2
            win.addstr(current_line, 2, f"Scheduled for: {task['send_time']}")
            current_line += 1
            if "display_name" in task:
                win.addstr(current_line, 2, f"Chat with: {task['display_name']}")
                current_line += 1
            win.addstr(current_line, 2, f"Message: {task['message'][:width-8]}")
            current_line += 1
            win.addstr(current_line, 2, "Press (S)end now, (D)elete, or (Q)uit", curses.color_pair(2))
            
            win.refresh()
            
            # Handle input
            key = screen.getch()
            if key in (ord('s'), ord('S')):
                try:
                    self.execute_task(task)
                    status = "Message sent successfully"
                except Exception as e:
                    status = f"Error sending message: {str(e)}"
                win.addstr(current_task * 4 + 4, 2, status.ljust(width-6))
                win.refresh()
                curses.napms(1000)  # Show status for 1 second
                current_task += 1
            elif key in (ord('d'), ord('D')):
                self.remove_task(task)
                current_task += 1
            elif key in (ord('q'), ord('Q')):
                break
            
            # Clear window for next task
            if current_task < len(overdue):
                win.clear()
                win.box()
                win.addstr(1, (width - 6 - len(header)) // 2, header, curses.A_BOLD | curses.color_pair(1))

        # Restore terminal state
        screen.clear()
        curses.reset_prog_mode()
        screen.refresh()

    def schedule_tasks_on_startup(self, screen=None):
        """Schedule pending tasks and handle overdue ones if screen is provided."""
        now = datetime.now()
        
        # Handle overdue tasks if we have a screen
        if screen:
            self.handle_overdue_tasks(screen)
        
        # Schedule remaining valid tasks
        for task in self.tasks.copy():
            dt = datetime.strptime(task["send_time"], "%Y-%m-%d %H:%M:%S")
            delay = (dt - now).total_seconds()
            
            if delay > 0:
                self.scheduler.enter(delay, 1, self.execute_task, argument=(task,))
        
        # Start the scheduler
        self.start_scheduler()


    def execute_task(self, task):
        """Execute scheduled task and remove from storage."""
        # print(f"\n[SENDING MESSAGE] Thread ID: {task['thread_id']} | Message: {task['message']}")
        logger.debug(f"Executing task: {task}")
        self.client.insta_client.direct_answer(task["thread_id"], task["message"])

        self.remove_task(task)

    def remove_task(self, task: dict) -> None:
        """Remove a task."""
        if task in self.tasks:
            self.tasks.remove(task)
            self.save_tasks()

    @classmethod
    def get_instance(cls, client: ClientWrapper = None, task_file: Path = None) -> 'MessageScheduler':
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
    scheduler.add_task("12345", "2025-02-09 15:30:00", "Hello, this is a scheduled message!")