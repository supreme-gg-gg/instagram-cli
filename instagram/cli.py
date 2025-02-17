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

<<<<<<< Updated upstream
@app.command()
def login(username: str = typer.Option(None, "-u", "--username"),
         password: str = typer.Option(None, "-p", "--password")):
=======
# These are the subcommands
@auth_app.command()
def login(
    use_username: bool = typer.Option(False, "-u", "--username", help="Login using username/password"),
):
>>>>>>> Stashed changes
    """Login to Instagram"""
    auth.login(username, password)

<<<<<<< Updated upstream
@app.command()
=======
@auth_app.command()
>>>>>>> Stashed changes
def logout(username: str = typer.Option(None, "-u", "--username")):
    """Logout from Instagram"""
    auth.logout(username)

@app.command()
def chat(username: str = typer.Option(None, "-u", "--username")):
    """Open chat UI"""
<<<<<<< Updated upstream
    chat_ui.start_chat(username)
=======
    if ctx.invoked_subcommand is None:
        chat_ui.start_chat(None)

@chat_app.command()
def search(
    username: str,
    _u: bool = typer.Option(
        False,
        "-u", "--username", 
        help="Search by username"
    ),
    _t: bool = typer.Option(
        False,
        "-t", "--title", 
        help="Search by thread title"
    )
):
    """Search for a user to chat with. """
    filter = "u" if _u else ""
    filter += "t" if _t else ""
    chat_ui.start_chat(username, filter)
>>>>>>> Stashed changes

@app.command()
def notify():
    """Show latest notifications"""
    api.show_updates()

@app.command()
def stats(days: int = typer.Option(14, "-d", "--days", help="Number of days to show analytics")):
    """Show analytics"""
    api.analytics_bar_graph(last_n_days=days)

@app.command()
def config(
    get: str = typer.Option(None, "-g", "--get", help="Get config value"),
    set: tuple[str, str] = typer.Option(None, "-s", "--set", help="Set config value"),
    list: bool = typer.Option(False, "-l", "--list", help="List all config values"),
    edit: bool = typer.Option(False, "-e", "--edit", help="Open config file in default editor")
):
    """Manage Instagram CLI configuration"""
    configs.config(get, set, list, edit)

@app.command()
def cleanup(d_all: bool = typer.Option(True, "-a", "--all", help="Cleanup cache and temporary files")):
    """Cleanup cache and temporary files"""
    client.cleanup(d_all)

if __name__ == "__main__":
    app()
