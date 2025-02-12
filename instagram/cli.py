import typer
from instagram import auth, chat_ui, api, configs, client
from art import text2art, tprint

app = typer.Typer()

@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    """Base command: Displays name, slogan, and visuals."""

    # If the command is just 'instagram' without any subcommands
    if ctx.invoked_subcommand is not None:
        return
    
    # tprint("InstagramCLI", font="random")
    
    logo = text2art("InstagramCLI", "random")
    
    typer.echo(f"\033[95m{logo}\033[0m")  # Magenta text
    typer.echo("\033[92mThe end of brainrot and scrolling is here.\033[0m")  # Green text

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
def logout(username: str = None):
    """Logout from Instagram"""
    auth.logout(username)

@app.command()
def chat():
    """Open chat UI"""
    chat_ui.start_chat()

@app.command()
def notify():
    """Show latest notifications"""
    api.show_updates()

@app.command()
def stats(days: int = 14):
    """Show analytics"""
    api.analytics_bar_graph(last_n_days=days)

@app.command()
def config(
    get: str = typer.Option(None, "--get", help="Get config value"),
    set: tuple[str, str] = typer.Option(None, "--set", help="Set config value"),
    list: bool = typer.Option(False, "--list", help="List all config values"),
    edit: bool = typer.Option(False, "--edit", help="Open config file in default editor")
):
    """Manage Instagram CLI configuration"""
    configs.config(get, set, list, edit)

@app.command()
def cleanup(d_all: bool = typer.Option(True, "--all", help="Cleanup cache and temporary files")):
    """Cleanup cache and temporary files"""
    client.cleanup(d_all)

if __name__ == "__main__":
    app()
