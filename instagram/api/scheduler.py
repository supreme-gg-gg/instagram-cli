import sched
import time
import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional
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

        # Schedule all pending tasks on startup
        self.schedule_pending_tasks()
    
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

    def send_notifications_for_pending(self):
        """Send notifications for pending messages."""
        for task in self.tasks:
            if datetime.strptime(task["send_time"], "%Y-%m-%d %H:%M:%S") < datetime.now():
                print(f"Notification: Message scheduled for {task['send_time']} overdue.")

    def save_tasks(self):
        """Save tasks to JSON file."""
        with open(self.task_file, "w") as f:
            json.dump(self.tasks, f, indent=4)

    def add_task(self, thread_id: str, send_time: str, message: str) -> str:
        """
        Schedule a new task.
        - `send_time` should be in ISO format: 'YYYY-MM-DD HH:MM:SS'
        """
        try:
            dt = datetime.strptime(send_time, "%Y-%m-%d %H:%M:%S")
            delay = (dt - datetime.now().replace(microsecond=0)).total_seconds()
            
            if delay <= 0:
                return "Error: Cannot schedule a message in the past."
            
            task = {"thread_id": thread_id, "send_time": send_time, "message": message}
            self.tasks.append(task)
            self.save_tasks()

            # Schedule execution
            self.scheduler.enter(delay, 1, self.execute_task, argument=(task,))

            self.start_scheduler()

            return f"Scheduled message for {send_time}"

        except ValueError:
            return "Error: Invalid datetime format. Use 'YYYY-MM-DD HH:MM:SS'."

    def schedule_pending_tasks(self):
        """Schedule all tasks that haven't been executed yet."""
        now = datetime.now()
        for task in self.tasks:
            dt = datetime.strptime(task["send_time"], "%Y-%m-%d %H:%M:%S")
            delay = (dt - now).total_seconds()
            if delay > 0:
                self.scheduler.enter(delay, 1, self.execute_task, argument=(task,))

    def execute_task(self, task):
        """Execute scheduled task and remove from storage."""
        print(f"\n[SENDING MESSAGE] Thread ID: {task['thread_id']} | Message: {task['message']}")
        
        self.client.insta_client.direct_answer(task["thread_id"], task["message"])

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