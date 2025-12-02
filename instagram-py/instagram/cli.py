import typer
from instagram import auth, chat, api, configs, client, __version__
from art import text2art
from rich.console import Console
from rich.table import Table

# We will expose the following core commands:
app = typer.Typer()
auth_app = typer.Typer()
chat_app = typer.Typer()
schedule_app = typer.Typer()


@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    version: bool = typer.Option(
        False, "--version", "-v", help="Show version information", is_flag=True
    ),
    help_flag: bool = typer.Option(
        False, "-h", "--help", help="Show help message", is_eager=True, is_flag=True
    ),
):
    """
    Base command: Displays name, slogan, and visuals.
    """
    # -h alias for --help implementation
    if help_flag:
        typer.echo(ctx.get_help())
        raise typer.Exit()

    # If the command is just 'instagram' without any subcommands
    if ctx.invoked_subcommand is not None:
        return

    if version:
        typer.echo(f"InstagramCLI v{__version__}")
        return

    # tprint("InstagramCLI", font="random")

    logo = text2art("InstagramCLI")

    typer.echo(f"\033[95m{logo}\033[0m")  # Magenta text
    typer.echo(
        "\033[92mThe end of brainrot and doomscrolling is here.\033[0m"
    )  # Green text

    messages = [
        "Type 'instagram --help' to see available commands.",
        "Pro Tip: Use vim-motion ('k', 'j') to navigate chats and messages.",
        "Version: " + __version__,
    ]

    for msg in messages:
        colors = ["\033[94m", "\033[93m", "\033[91m"]  # Blue, Yellow, Red
        color = colors[messages.index(msg) % len(colors)]
        typer.echo(f"{color}{msg}\033[0m")
        # time.sleep(0.5)  # Simulate loading effect


@auth_app.command()
def login(
    use_username: bool = typer.Option(
        False, "-u", "--username", help="Login using username/password"
    ),
):
    """Login to Instagram"""
    try:
        if use_username:
            auth.login_by_username()
        else:
            auth.login()
    except KeyboardInterrupt:
        typer.echo("\nLogin cancelled by user.")
    except Exception as e:
        typer.echo(f"An error occurred: {e}")


@auth_app.command()
def logout(username: str = typer.Option(None, "-u", "--username")):
    """Logout from Instagram"""
    auth.logout(username)


@auth_app.command()
def switch(
    username: str = typer.Argument(
        ...,  # mark argument as required
        help="Username of the account to switch to",
    ),
):
    """
    Convenience command for switching between multiple accounts
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
    _t: bool = typer.Option(
        False, "-t", "--title", help="Search by thread title", is_flag=True
    ),
    _u: bool = typer.Option(
        False, "-u", "--username", help="Search by username", is_flag=True
    ),
):
    """Search for a user to chat with."""
    filter = ""
    if _u:
        filter += "u"
    if _t:
        filter += "t"
    chat.start_chat(username, filter)


@schedule_app.command()
def ls():
    """List all scheduled messages"""

    console = Console()
    tasks = api.list_all_scheduled_tasks()

    if not tasks:
        typer.echo("No scheduled messages found.")
        return

    table = Table("Index", "Recipient", "Time", "Message")

    for idx, task in enumerate(tasks):
        table.add_row(
            str(idx), task["display_name"], task["send_time"], task["message"]
        )

    console.print(table)


@schedule_app.command()
def cancel(
    task_id: int = typer.Argument(
        ...,  # mark argument as required
        help="ID of the scheduled message to cancel",
    ),
):
    """Cancel a scheduled message"""
    api.cancel_scheduled_task_by_index(task_id)


@app.command()
def notify():
    """Show latest notifications"""
    api.show_updates()


@app.command()
def stats(
    days: int = typer.Option(
        14, "-d", "--days", help="Number of days to show analytics"
    ),
):
    """Show analytics"""
    api.analytics_bar_graph(last_n_days=days)


@app.command()
def config(
    get: str = typer.Option(None, "-g", "--get", help="Get config value"),
    set: tuple[str, str] = typer.Option(None, "-s", "--set", help="Set config value"),
    list: bool = typer.Option(False, "-l", "--list", help="List all config values"),
    edit: bool = typer.Option(
        False, "-e", "--edit", help="Open config file in default editor"
    ),
    reset: bool = typer.Option(
        False, "-R", "--reset", help="Reset configuration to default"
    ),
):
    """Manage Instagram CLI configuration"""
    configs.config(get, set, list, edit, reset)


@app.command()
def cleanup(
    d_all: bool = typer.Option(
        False, "-a", "--all", help="Cleanup cache and temporary files"
    ),
):
    """Cleanup cache and temporary files"""
    client.cleanup(d_all)


# We add the subcommands to the main app
app.add_typer(
    auth_app, name="auth", help="Authentication commands (login/logout/switch)"
)
app.add_typer(chat_app, name="chat", help="Chat commands (start/search)")
app.add_typer(schedule_app, name="schedule", help="Scheduled message commands (ls)")

if __name__ == "__main__":
    app()
