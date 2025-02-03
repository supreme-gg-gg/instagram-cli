import typer
from instagram.client import Client, LoginRequired

def login() -> Client:
    """Login to Instagram"""
    typer.echo("Logging in")
    client = Client()
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

def logout():
    """Logout from Instagram"""
    typer.echo("Logging out")
    client = Client()
    try:
        client.login_by_session()
        client.logout()
        typer.echo("Logged out.")
    except (LoginRequired, FileNotFoundError):
        typer.echo("Not logged in.")