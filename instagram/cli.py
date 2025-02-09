import typer
from instagram import auth, chat_ui, api, configs

app = typer.Typer()

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
def notif():
    """Show latest notifications"""
    api.show_updates()

@app.command()
def stats(days: int = 7):
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

if __name__ == "__main__":
    app()
