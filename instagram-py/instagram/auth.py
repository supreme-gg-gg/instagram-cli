import typer
from instagram.client import ClientWrapper, LoginRequired
from instagram import configs
from pathlib import Path
from rich.console import Console
from rich.spinner import Spinner
from rich.live import Live
from instagram.client import spinner_controller_var


class SpinnerController:
    """
    This is pretty much a simplified version of the Progress class in the Rich docs.
    The Progress class is really powerful but kind of difficult to understand, since our need
    is very simple we can just make our own simple spinner controller.
    """

    def __init__(self, message="Working..."):
        # Create a console object (like stdout) and spinner renderable object
        self.console = Console()
        self.spinner = Spinner("dots", text=message, style="green")
        self.live = None

    def start(self):
        if self.live is None:
            # Live here allows us to animate the spinner by refreshing it in the console
            self.live = Live(self.spinner, refresh_per_second=10, console=self.console)
            self.live.__enter__()  # This starts the spinner

    def stop(self):
        if self.live is not None:
            self.live.__exit__(None, None, None)
            self.live = None

    def update(self, message):
        # Update the spinner text, refresh handled by Live
        self.spinner.text = message


def login() -> ClientWrapper | None:
    """Login to Instagram"""
    config = configs.Config()
    current_username = config.get("login.current_username", None)

    client = ClientWrapper(current_username)

    # Create a spinner controller object and set it in the context variable
    spinner_controller = SpinnerController("Logging in...")
    token = spinner_controller_var.set(spinner_controller)
    spinner_controller.start()  # Start the spinner
    try:
        client.login_by_session()
        spinner_controller.stop()
        spinner_controller_var.reset(token)
        typer.echo(f"Logged in as {client.username}")
        return client
    except (LoginRequired, FileNotFoundError):
        # If login by session fails, try login by username
        # First stop the spinner since login_by_session() will start a new spinner
        spinner_controller.stop()
        spinner_controller_var.reset(token)
        typer.echo("Cannot log in via session, logging in with username and password.")
        return login_by_username()


def login_by_username() -> ClientWrapper | None:
    """Login to Instagram using username and password"""
    username = typer.prompt("Username")
    password = typer.prompt("Password", hide_input=True)
    verification_code = ""
    if typer.confirm("Do you use 2FA (2 Factor Authentication) ?"):
        verification_code = typer.prompt(
            "Provide your verification code (From The Auth App, SMS not supported)"
        )
    client = ClientWrapper(username)
    spinner_controller = SpinnerController("Logging in...")
    token = spinner_controller_var.set(spinner_controller)
    spinner_controller.start()
    try:
        client.login(
            username,
            password,
            refresh_session=True,
            verification_code=verification_code,
        )
        typer.echo(f"Logged in as {client.username}")
        return client
    except Exception as e:
        typer.echo(f"Error logging in: {e}")
        return None
    finally:
        spinner_controller.stop()
        spinner_controller_var.reset(token)


def logout(username=None):
    """Logout from Instagram"""
    # Get current username from config if none provided
    if not username:
        config = configs.Config()
        username = config.get("login.current_username")

    if username:
        client = ClientWrapper(username)
        spinner_controller = SpinnerController(f"Logging out {username}...")
        token = spinner_controller_var.set(spinner_controller)
        spinner_controller.start()
        try:
            client.login_by_session()
            client.logout()
            # Clear both current and default username if they match
            config = configs.Config()
            if config.get("login.default_username") == username:
                config.set("login.default_username", None)
            typer.echo(f"Logged out @{username}.")
        except (LoginRequired, FileNotFoundError):
            typer.echo(f"@{username} not logged in.")
        finally:
            spinner_controller.stop()
            spinner_controller_var.reset(token)
    else:
        typer.echo("No active session found.")


def switch_account(username):
    """
    Convenience function for Switching between multiple accounts

    Functionally the same as:
    ```
    instagram ocnfig --set login.current_username <username>
    ````
    """
    # Check if session exists
    session_path = (
        Path(configs.Config().get("advanced.users_dir")) / username / "session.json"
    )
    if not session_path.exists():
        typer.echo(
            f"Cannot switch to @{username}. No session found.\nTry logging in with @{username} first."
        )
        return

    configs.Config().set("login.current_username", username)
    typer.echo(f"Switched to @{username}")
