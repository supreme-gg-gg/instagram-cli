import typer
from instagram import auth, chat_ui, api
from art import text2art
import time

app = typer.Typer()

@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    """Base command: Displays name, slogan, and visuals."""

    # If the command is just 'instagram' without any subcommands
    if ctx.invoked_subcommand is not None:
        return
    
    logo = text2art("InstagramCLI")
    
    typer.echo(f"\033[95m{logo}\033[0m")  # Magenta text
    typer.echo("\033[92mThe end of brainrot and scrolling.\033[0m")  # Green text

    try:
        from importlib.metadata import version
        cli_version = version("instagram")
    except ImportError:
        cli_version = "Unknown"

    messages = [
        "Type 'instagram --help' to see available commands.",
        "Pro Tip: Use arrow keys to navigate chats.",
        "Version: " + cli_version
    ]

    for msg in messages:
        colors = ["\033[94m", "\033[93m", "\033[91m"]  # Blue, Yellow, Red
        color = colors[messages.index(msg) % len(colors)]
        typer.echo(f"{color}{msg}\033[0m")
        # time.sleep(0.5)  # Simulate loading effect

@app.command()
def login(username: str = None, password: str = None):
    """Login to Instagram"""
    auth.login(username, password)

@app.command()
def logout():
    """Logout from Instagram"""
    auth.logout()

@app.command()
def chat():
    """Open chat UI"""
    chat_ui.start_chat()

@app.command()
def notif():
    """Show latest notifications"""
    api.show_updates()

@app.command()
def stats(days: int = 7):
    """Show analytics"""
    api.analytics_bar_graph(last_n_days=days)

if __name__ == "__main__":
    app()
