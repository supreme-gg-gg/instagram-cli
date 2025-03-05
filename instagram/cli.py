import typer
from instagram import auth, chat, api, configs, client, __version__
from art import text2art, tprint

# We will expose the following core commands:
app = typer.Typer()
auth_app = typer.Typer()
chat_app = typer.Typer()
schedule_app = typer.Typer()

# This is the base command
@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    """Base command: Displays name, slogan, and visuals."""

    # If the command is just 'instagram' without any subcommands
    if ctx.invoked_subcommand is not None:
        return
    
    # tprint("InstagramCLI", font="random")
    
    logo = text2art("InstagramCLI")
    
    typer.echo(f"\033[95m{logo}\033[0m")  # Magenta text
    typer.echo("\033[92mThe end of brainrot and scrolling is here.\033[0m")  # Green text

    messages = [
        "Type 'instagram --help' to see available commands.",
        "Pro Tip: Use arrow keys to navigate chats.",
        "Version: " + __version__
    ]

    for msg in messages:
        colors = ["\033[94m", "\033[93m", "\033[91m"]  # Blue, Yellow, Red
        color = colors[messages.index(msg) % len(colors)]
        typer.echo(f"{color}{msg}\033[0m")
        # time.sleep(0.5)  # Simulate loading effect

# These are the subcommands
@auth_app.command()
def login(
    use_username: bool = typer.Option(False, "-u", "--username", help="Login using username/password"),
):
    """Login to Instagram"""
    if use_username:
        auth.login_by_username()
    else:
        auth.login()

@auth_app.command()
def logout(username: str = typer.Option(None, "-u", "--username")):
    """Logout from Instagram"""
    auth.logout(username)

@auth_app.command()
def switch_account(
    username: str = typer.Argument(
        ...,  # ... means the argument is required
        help="Username of the account to switch to"
    )
):
    """
    Convenience command for Switching between multiple accounts
    """
    auth.switch_account(username)

@chat_app.command()
def start(ctx: typer.Context):
    """Open chat UI"""
    if ctx.invoked_subcommand is None:
        chat.start_chat(None)

@chat_app.command()
def search(
    username: str,
    _t: bool = typer.Option(False, "-t", "--title", help="Search by thread title", is_flag=True),
    _u: bool = typer.Option(False, "-u", "--username", help="Search by username", is_flag=True)
):
    """Search for a user to chat with. """
    filter = ""
    if _u:
        filter += "u"
    if _t:
        filter += "t"
    chat.start_chat(username, filter)

@schedule_app.command()
def ls():
    """List all scheduled messages"""
    tasks = api.list_all_scheduled_tasks()
    if not tasks:
        typer.echo("No scheduled messages found.")
        return

    # Create table headers
    headers = ["Recipient", "Time", "Message"]
    rows = [[task["display_name"], task["send_time"], task["message"]] for task in tasks]

    # Calculate column widths
    widths = [
        max(len(str(row[i])) for row in [headers] + rows)
        for i in range(len(headers))
    ]

    # Print table header
    header_line = " | ".join(f"{header:<{width}}" for header, width in zip(headers, widths))
    typer.echo("-" * (sum(widths) + len(widths) * 3 - 1))
    typer.echo(header_line)
    typer.echo("-" * (sum(widths) + len(widths) * 3 - 1))

    # Print table rows
    for row in rows:
        row_line = " | ".join(f"{str(cell):<{width}}" for cell, width in zip(row, widths))
        typer.echo(row_line)

    typer.echo("-" * (sum(widths) + len(widths) * 3 - 1))

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
    edit: bool = typer.Option(False, "-e", "--edit", help="Open config file in default editor"),
    reset: bool = typer.Option(False, "-R", "--reset", help="Reset configuration to default")
):
    """Manage Instagram CLI configuration"""
    configs.config(get, set, list, edit, reset)

@app.command()
def cleanup(d_all: bool = typer.Option(True, "-a", "--all", help="Cleanup cache and temporary files")):
    """Cleanup cache and temporary files"""
    client.cleanup(d_all)

# We add the subcommands to the main app
app.add_typer(auth_app, name="auth", help="Authentication related commands (login/logout)")
app.add_typer(chat_app, name="chat", help="Chat related commands (start/search)")
app.add_typer(schedule_app, name="schedule", help="Scheduled message commands (ls)")

if __name__ == "__main__":
    app()
