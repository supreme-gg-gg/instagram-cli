import typer
from instagram import auth, chat_ui, config

app = typer.Typer()

@app.command()
def login():
    """Login to Instagram"""
    auth.login()

@app.command()
def logout():
    """Logout from Instagram"""
    auth.logout()

@app.command()
def chat():
    """Open chat UI"""
    chat_ui.start_chat()

# @app.command()
# def config():
#     """Edit configuration"""
#     config.configure()

if __name__ == "__main__":
    app()