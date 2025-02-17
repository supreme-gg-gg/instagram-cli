import typer
from instagram.client import ClientWrapper, LoginRequired
from instagram import configs

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
        client.login(username, password, refresh_session=True)
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
    client = ClientWrapper(username)
    client.login(username, password, refresh_session=True)
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