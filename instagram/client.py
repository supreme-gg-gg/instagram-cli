import typer
import instagrapi
from instagrapi.exceptions import LoginRequired
from pathlib import Path
from instagram.configs import Config

class SessionManager:
    def __init__(self, username: str | None) -> None:
        """
        Initialize a session manager with a username. 
        If no username is provided, the first session file found will be used.
        """
        self.username = username
        if username is None:
            self.username = self.get_default_username()
            if not self.username:
                raise ValueError("No username provided and no default username found in config")
    
    def get_default_username(self) -> str | None:
        """Get default username from config, falling back to default_username if current_username is not set"""
        current = Config().get("login.current_username")
        if current:
            return current
        
        default = Config().get("login.default_username")
        if default:
            return default
            
        return None
    
    def get_session_path(self) -> Path:
        """Get path to session file in user's home directory"""
        return self.ensure_session_dir() / "session.json"

    def ensure_session_dir(self):
        """Ensure session directory exists"""
        if not self.username:
            raise ValueError("Username is not set")
        session_dir = Path(Config().get("advanced.users_dir")) / self.username
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
        self.session_manager = SessionManager(username)
        self.username = self.session_manager.username
        self.insta_client = None

    def login(self, username: str | None = None, password: str | None = None, refresh_session: bool = False, verification_code = ""):
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
            # typer.echo("Attempting to login with username and password...")
            cl.login(username, password, verification_code=verification_code)
            cl.get_timeline_feed()
        except Exception as e:
            typer.echo(f"Failed to login: {e}")
            raise typer.Exit(code=1)
        
        self.insta_client = cl
        self.session_manager.save_session(self)
        Config().set("login.current_username", username)
        
        # If first time logging in no default username, set this as default
        if not Config().get("login.default_username"):
            Config().set("login.default_username", username)

        return cl

    def login_by_session(self) -> instagrapi.Client:
        """
        Login using session file
        If this fails it will prompt the user to cleanup and relogin.
        NOTE: This may happen intermittently due to Instagram's security measures.
        """
        if not self.session_manager.username:
            raise FileNotFoundError("No session file found.")
        session_path = self.session_manager.get_session_path()

        cl = instagrapi.Client()
        cl.delay_range = [1, 3]
        # typer.echo("Attempting to login with session...")
        cl.load_settings(str(session_path))
        session_id = cl.settings["authorization_data"]["sessionid"]
        try:
            cl.login_by_sessionid(session_id)
            # NOTE: I commented out the line below since I suspect it is causing API issues and slows down
            # cl.get_timeline_feed()  # Test if session is valid
        except Exception as e:
            typer.echo(f"Failed to login with session: {e}")
            typer.echo("Suggested action: 'instagram cleanup' and relogin.")
        self.insta_client = cl
        self.username = cl.username
        self.session_manager.username = cl.username
        self.session_manager.save_session(self)
        Config().set("login.current_username", cl.username)

        return cl

    def logout(self):
        """Logout from Instagram"""
        self.insta_client.logout()
        self.session_manager.delete_session()
        Config().set("login.current_username", None)

def cleanup(delete_all: bool) -> None:
    """Cleanup cache and temporary files"""
    Config().set("login.current_username", None)
    typer.echo("Config cleaned up")
    
    # make sure cleanup works independently of the session manager
    users_dir = Path(Config().get("advanced.users_dir"))
    if users_dir.exists():
        for user_dir in users_dir.iterdir():
            session_file = user_dir / "session.json"
            if session_file.exists():
                session_file.unlink()
        typer.echo("Session files cleaned up")

    if not delete_all:
        return

    cache_dir = Path(Config().get("advanced.cache_dir")).expanduser()
    media_dir = Path(Config().get("advanced.media_dir")).expanduser()
    generated_dir = Path(Config().get("advanced.generated_dir")).expanduser()

    # Cleanup
    typer.echo(f"Cleaning up cache: {str(cache_dir), str(media_dir), str(generated_dir)}")
    if cache_dir.exists():
        for file in cache_dir.iterdir():
            file.unlink()
    
    if media_dir.exists():
        for file in media_dir.iterdir():
            file.unlink()

    if generated_dir.exists():
        for file in generated_dir.iterdir():
            file.unlink()
            
    typer.echo("Cleanup complete")
