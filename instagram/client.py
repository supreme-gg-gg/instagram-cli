import typer
import instagrapi
from instagrapi.exceptions import LoginRequired
from pathlib import Path
from instagram import configs

class SessionManager:
    def __init__(self, username: str | None) -> None:
        """
        Initialize a session manager with a username. 
        If no username is provided, the first session file found will be used.
        """
        self.username = username
        if username is None:
            self.username = self.get_default_username()
    
    def get_default_username(self) -> str | None:
        # Fall back to default username if current username is not set
        return configs.Config().get("login.current_username", configs.Config().get("login.default_username", ""))
            
        # session_dir = self.ensure_session_dir()
        # session_files = list(session_dir.glob("*.json"))
        # if session_files:
        #     return session_files[0].stem
        # else:
        #     return ""
    
    def get_session_path(self) -> Path:
        """Get path to session file in user's home directory"""
        return Path.home() / ".instagram-cli" / f"{self.username}.json"

    def ensure_session_dir(self):
        """Ensure session directory exists"""
        session_dir = Path.home() / ".instagram-cli"
        session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir

    def save_session(self, client: "ClientWrapper"):
        """Save client session"""
        self.ensure_session_dir()
        try:
            client.insta_client.dump_settings(str(self.get_session_path()))
        except AttributeError:
            raise AttributeError("insta_client is not initialized.")
    
    def delete_session(self):
        """Delete session file"""
        session_path = self.get_session_path()
        if session_path.exists():
            session_path.unlink()

class ClientWrapper:
    def __init__(self, username: str | None = None) -> None:
        self.config = configs.Config()
        self.session_manager = SessionManager(username)
        self.username = self.session_manager.username
        self.insta_client = None

    def login(self, username: str | None = None, password: str | None = None, refresh_session: bool = False):
        """
        Attempts to login to Instagram using either the provided session information
        or the provided username and password.
        """
        if username:
            self.username = username
            self.session_manager.username = username
        else:
            if not self.username:
                raise ValueError("Username is required.")
            username = self.username
        
        cl = instagrapi.Client()
        cl.delay_range = [1, 3]
        session_is_invalid = False
        if not refresh_session:
            try:
                cl = self.login_by_session()
                return cl
            except LoginRequired:
                session_path = self.session_manager.get_session_path()
                typer.echo("Session is invalid, logging in with username and password.")
                session_is_invalid = True
            except FileNotFoundError:
                session_is_invalid = False
                typer.echo("No session file found, logging in with username and password.")
        
        if session_is_invalid:
            cl.load_settings(str(session_path))
            old_session = cl.get_settings()
            # use the same device uuids across logins
            cl.set_settings({})
            cl.set_uuids(old_session["uuids"])
        if not username or not password:
            raise ValueError("Username and password are required.")
        try:
            typer.echo("Attempting to login with username and password...")
            cl.login(username, password)
            cl.get_timeline_feed()
        except Exception as e:
            typer.echo(f"Failed to login: {e}")
            raise typer.Exit(code=1)
        
        self.insta_client = cl
        self.session_manager.save_session(self)
        self.config.set("login.current_username", username)
        return cl

    def login_by_session(self):
        session_path = self.session_manager.get_session_path()
        
        cl = instagrapi.Client()
        cl.delay_range = [1, 3]
        typer.echo(f"Attempting to login with session...")
        cl.load_settings(str(session_path))
        sessionId = cl.settings["authorization_data"]["sessionid"]
        cl.login_by_sessionid(sessionId)
        cl.get_timeline_feed()  # Test if session is valid
        self.insta_client = cl
        self.session_manager.save_session(self)
        self.config.set("login.current_username", cl.username)
        return cl

    def logout(self):
        """Logout from Instagram"""
        self.insta_client.logout()
        self.session_manager.delete_session()
        self.config.set("login.current_username", None)
