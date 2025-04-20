import typer
from instagram.client import ClientWrapper, LoginRequired
from instagram import configs
from pathlib import Path

def login() -> ClientWrapper:
    """Login to Instagram"""
    typer.echo("Logging in")
    client = ClientWrapper()
    try:
        client.login_by_session()
    except (LoginRequired, FileNotFoundError):
        typer.echo("Cannot log in via session, logging in with username and password.")
        username = typer.prompt("Username")
        password = typer.prompt("Password", hide_input=True)
        verification_code = ""
        if typer.confirm("Do you use 2FA (2 Factor Authentication) ?"):
            verification_code=typer.prompt("Provide your verification code (From The Auth App, SMS not supported)") 
        client.login(username, password, refresh_session=True, verification_code=verification_code)
    if client:
        typer.echo(f"Logged in as {client.username}")
        return client
    else:
        typer.echo("Login failed.")

def login_by_username() -> ClientWrapper:
    """Login to Instagram using username and password"""
    typer.echo("Logging in")
    username = typer.prompt("Username")
    password = typer.prompt("Password", hide_input=True)
    verification_code = ""
    if typer.confirm("Do you use 2FA (2 Factor Authentication) ?"):
        verification_code=typer.prompt("Provide your verification code (From The Auth App, SMS not supported)") 
    client = ClientWrapper(username)
    client.login(username, password, refresh_session=True, verification_code=verification_code)
    if client:
        typer.echo(f"Logged in as {client.username}")
        return client
    else:
        typer.echo("Login failed.")

def logout(un=None):
    """Logout from Instagram"""
    typer.echo("Logging out")
    client = ClientWrapper(un)
    try:
        client.login_by_session()
        client.logout()
        typer.echo("Logged out.")
    except (LoginRequired, FileNotFoundError):
        typer.echo("Not logged in.")

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
