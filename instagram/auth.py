import typer
from rich.progress import Progress, SpinnerColumn, TextColumn
from instagram.client import ClientWrapper, LoginRequired
from instagram import configs
from pathlib import Path

def _with_spinner(action: str, func, *args, **kwargs):
    """Helper function to run an operation with a spinner"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task(description=action, total=None)
        return func(*args, **kwargs)

def login() -> ClientWrapper:
    """Login to Instagram"""
    config = configs.Config()
    current_username = config.get("login.current_username", None)
    
    # If we have a current username, try to use that first
    client = ClientWrapper(current_username)
    try:

        _with_spinner(
            f"Attempting to login by session...",
            client.login_by_session,
        )

        typer.echo(f"Logged in as {client.username}")
        return client
    except (LoginRequired, FileNotFoundError):
        # Session invalid or not found, proceed with new login
        typer.echo("Cannot log in via session, logging in with username and password.")
        username = typer.prompt("Username")
        password = typer.prompt("Password", hide_input=True)
        verification_code = ""
        if typer.confirm("Do you use 2FA (2 Factor Authentication) ?"):
            verification_code = typer.prompt("Provide your verification code (From The Auth App, SMS not supported)")
        
        # Wrap only the login operation with spinner
        _with_spinner(
            f"Logging in as {username} with password...",
            client.login,
            username,
            password,
            refresh_session=True,
            verification_code=verification_code
        )
        
        if client:
            typer.echo(f"Logged in as {client.username}")
            return client
        else:
            typer.echo("Login failed.")

def login_by_username() -> ClientWrapper:
    """Login to Instagram using username and password"""
    username = typer.prompt("Username")
    password = typer.prompt("Password", hide_input=True)
    verification_code = ""
    if typer.confirm("Do you use 2FA (2 Factor Authentication) ?"):
        verification_code = typer.prompt("Provide your verification code (From The Auth App, SMS not supported)")
    
    client = ClientWrapper(username)
    # Wrap only the login operation with spinner
    _with_spinner(
        f"Logging in as {username} with password...",
        client.login,
        username,
        password,
        refresh_session=True,
        verification_code=verification_code
    )
    
    if client:
        typer.echo(f"Logged in as {client.username}")
        return client
    else:
        typer.echo("Login failed.")

def logout(username=None):
    """Logout from Instagram"""
    # Get current username from config if none provided
    if not username:
        config = configs.Config()
        username = config.get("login.current_username")
    
    if username:
        client = ClientWrapper(username)
        try:
            client.login_by_session()
            # Wrap logout operation with spinner
            _with_spinner(f"Logging out {username}...", client.logout)
            # Clear both current and default username if they match
            config = configs.Config()
            if config.get("login.default_username") == username:
                config.set("login.default_username", None)
            typer.echo(f"Logged out @{username}.")
        except (LoginRequired, FileNotFoundError):
            typer.echo(f"@{username} not logged in.")
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
    session_path = Path(configs.Config().get("advanced.users_dir")) / username / "session.json"
    if not session_path.exists():
        typer.echo(f"Cannot switch to @{username}. No session found.\nTry logging in with @{username} first.")
        return
    
    configs.Config().set("login.current_username", username)
    typer.echo(f"Switched to @{username}")
