import typer
from instagram import auth, chat_ui, api

app = typer.Typer()

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
