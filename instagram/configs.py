import yaml
from pathlib import Path
from typing import Any, Optional
import typer

DEFAULT_CONFIG = {
    "language": "en",
    "login": {
        "default_username": None,
        "current_username": None
    },
    "chat": {
        "media_upload_path": "~/instagram/uploads",
        "media_download_path": "~/instagram/downloads"
    },
    "scheduling": {
        "default_schedule_duration": "1h"
    },
    "privacy": {
        "invisible_mode": False
    },
    "advanced": {
        "debug_mode": False,
        "cache_dir": "~/.instagram-cli/cache"
    }
}

class Config:
    def __init__(self):
        self.config_dir = Path.home() / ".instagram-cli"
        self.config_file = self.config_dir / "config.yaml"
        self.config = self._load_config()

    def _load_config(self) -> dict:
        """Load configuration from file or create default if not exists"""
        if not self.config_file.exists():
            self.config_dir.mkdir(parents=True, exist_ok=True)
            self._save_config(DEFAULT_CONFIG)
            return DEFAULT_CONFIG.copy()
        
        with open(self.config_file, 'r') as f:
            return yaml.safe_load(f) or DEFAULT_CONFIG.copy()

    def _save_config(self, config: dict):
        """Save configuration to file"""
        with open(self.config_file, 'w') as f:
            yaml.dump(config, f, default_flow_style=False)

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key (supports dot notation)"""
        try:
            value = self.config
            for k in key.split('.'):
                value = value[k]
            return value
        except (KeyError, TypeError):
            # Try to get default value from DEFAULT_CONFIG
            try:
                default_value = DEFAULT_CONFIG
                for k in key.split('.'):
                    default_value = default_value[k]
                typer.echo(f"Warning: Config key '{key}' not found in config.yaml file, using default value: {default_value}")
                return default_value
            except (KeyError, TypeError):
                return default

    def set(self, key: str, value: Any):
        """Set configuration value by key (supports dot notation)"""
        keys = key.split('.')
        current = self.config
        
        # Navigate to the deepest dict
        for k in keys[:-1]:
            if k not in current:
                current[k] = {}
            current = current[k]
        
        # Set the value
        current[keys[-1]] = value
        self._save_config(self.config)

    def list(self) -> list[tuple[str, Any]]:
        """List all configuration values"""
        def flatten_dict(d: dict, parent_key: str = '') -> list[tuple[str, Any]]:
            items = []
            for k, v in d.items():
                new_key = f"{parent_key}.{k}" if parent_key else k
                if isinstance(v, dict):
                    items.extend(flatten_dict(v, new_key))
                else:
                    items.append((new_key, v))
            return items
        
        return flatten_dict(self.config)

def config(
    get: Optional[str] = typer.Option(None, "--get", help="Get config value"),
    set: Optional[tuple[str, str]] = typer.Option(None, "--set", help="Set config value"),
    list: bool = typer.Option(False, "--list", help="List all config values"),
    edit: bool = typer.Option(False, "--edit", help="Open config file in default editor")
):
    cfg = Config()

    if edit:
        # Open config file in default editor
        import os
        editor = os.environ.get('EDITOR', 'notepad' if os.name == 'nt' else 'nano')
        os.system(f'{editor} "{cfg.config_file}"')
        return

    if get:
        value = cfg.get(get)
        if value is not None:
            typer.echo(value)
        else:
            typer.echo(f"Configuration key '{get}' not found", err=True)
            raise typer.Exit(1)
    
    elif set:
        key, value = set
        # Convert string value to appropriate type
        try:
            value = yaml.safe_load(value)
        except yaml.YAMLError:
            pass
        cfg.set(key, value)
        typer.echo(f"Set {key} = {value}")
    
    elif list:
        for key, value in cfg.list():
            typer.echo(f"{key} = {value}")
    
    else:
        typer.echo("No action specified. Use --help for usage information.")
