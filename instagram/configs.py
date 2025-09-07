import yaml
from pathlib import Path
from typing import Any, Optional
import typer
import pathlib
from rich.console import Console
from rich.panel import Panel

console = Console(color_system="auto")

DEFAULT_CONFIG = {
    "language": "en",
    "login": {"default_username": None, "current_username": None},
    "chat": {"layout": "compact", "colors": True, "send_read_receipts": True},
    "scheduling": {
        "default_schedule_duration": "01:00"  # 1 hour
    },
    "privacy": {"invisible_mode": False},
    "llm": {
        "endpoint": "http://localhost:11434/v1/",
        "api_key": "",
        "model": "gemma3:270m",
        "temperature": 0.7,
        "max_tokens": 1000,
        "streaming": False,
        "summary_system_prompt": (
            "You are a helpful assistant that summarizes Instagram direct message conversations. "
            "Your task is to create a concise summary of the conversation that includes: "
            "1. The main topics discussed in the conversation. "
            "2. Any action items, decisions, or plans mentioned. "
            "The summary should be objective and focus on the content of the conversation. "
            "Write in a clear, concise style suitable for quick reading. "
            "You must not try to format your output with bold or italics text. Do not use asterisks (*)."
        ),
    },
    "advanced": {
        "debug_mode": False,
        "data_dir": str(pathlib.Path.home() / ".instagram-cli"),
        "georgist_credits": 627,
    },
}
DEFAULT_CONFIG["advanced"]["users_dir"] = str(
    pathlib.Path(DEFAULT_CONFIG["advanced"]["data_dir"]) / "users"
)
DEFAULT_CONFIG["advanced"]["cache_dir"] = str(
    pathlib.Path(DEFAULT_CONFIG["advanced"]["data_dir"]) / "cache"
)
DEFAULT_CONFIG["advanced"]["media_dir"] = str(
    pathlib.Path(DEFAULT_CONFIG["advanced"]["data_dir"]) / "media"
)
DEFAULT_CONFIG["advanced"]["generated_dir"] = str(
    pathlib.Path(DEFAULT_CONFIG["advanced"]["data_dir"]) / "generated"
)


class Config:
    """Configuration manager for Instagram CLI - Singleton Pattern"""

    _instance = None
    _config = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Config, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize the configuration"""
        self.config_dir = Path(DEFAULT_CONFIG["advanced"]["data_dir"])
        self.config_file = self.config_dir / "config.yaml"
        self._load_config()

    def _load_config(self) -> None:
        """Load configuration from file or create default if not exists"""
        if not self.config_file.exists():
            self.config_dir.mkdir(parents=True, exist_ok=True)
            self._save_config(DEFAULT_CONFIG)
            self._config = DEFAULT_CONFIG.copy()
            return

        with open(self.config_file, "r") as f:
            self._config = yaml.safe_load(f) or DEFAULT_CONFIG.copy()

    def _save_config(self, config: dict):
        """Save configuration to file"""
        with open(self.config_file, "w") as f:
            yaml.dump(config, f, default_flow_style=False)
        self._config = config

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key (supports dot notation)"""
        try:
            value = self._config
            for k in key.split("."):
                value = value[k]
            return value
        except (KeyError, TypeError):
            try:
                default_value = DEFAULT_CONFIG
                for k in key.split("."):
                    default_value = default_value[k]
                return default_value
            except (KeyError, TypeError):
                return default

    def set(self, key: str, value: Any):
        """Set configuration value by key (supports dot notation)"""
        keys = key.split(".")
        current = self._config

        for k in keys[:-1]:
            if k not in current:
                current[k] = {}
            current = current[k]

        current[keys[-1]] = value
        self._save_config(self._config)

    def list(self) -> list[tuple[str, Any]]:
        """List all configuration values"""

        def flatten_dict(d: dict, parent_key: str = "") -> list[tuple[str, Any]]:
            items = []
            for k, v in d.items():
                new_key = f"{parent_key}.{k}" if parent_key else k
                if isinstance(v, dict):
                    items.extend(flatten_dict(v, new_key))
                else:
                    items.append((new_key, v))
            return items

        return flatten_dict(self._config)

    def reload(self):
        """Reload configuration from file"""
        self._load_config()


def config(
    get: Optional[str] = typer.Option(None, "--get", help="Get config value"),
    set: Optional[tuple[str, str]] = typer.Option(
        None, "--set", help="Set config value"
    ),
    list: bool = typer.Option(False, "--list", help="List all config values"),
    edit: bool = typer.Option(
        False, "--edit", help="Open config file in default editor"
    ),
    reset: bool = False,
):
    cfg = Config()

    if reset:
        cfg._save_config(DEFAULT_CONFIG)
        console.print("Configuration reset to default")
        return

    if edit:
        import os

        editor = os.environ.get("EDITOR", "notepad" if os.name == "nt" else "nano")
        os.system(f'{editor} "{cfg.config_file}"')
        cfg.reload()  # Reload config after editing
        return

    if get:
        value = cfg.get(get)
        if value is not None:
            panel = Panel(
                f"[cyan]{get}[/cyan]: [green]{value}[/green]",
                title="[bold white]CONFIG VALUE[/bold white]",
                border_style="magenta",
            )
            console.print(panel)
        else:
            panel = Panel(
                f"[white]Configuration key '{get}' not found[/white]",
                title="[white]ERROR[/white]",
                border_style="red",
            )
            console.print(panel)
            raise typer.Exit(1)
    elif set:
        key, value = set
        try:
            value = yaml.safe_load(value)
        except yaml.YAMLError:
            pass
        cfg.set(key, value)
        panel = Panel(
            f"[cyan]{key}[/cyan] set to [green]{value}[/green]",
            title="[bold white]CONFIG UPDATED[/bold white]",
            border_style="green",
        )
        console.print(panel)

    elif list:
        console.print()
        grouped = {}
        for key, value in cfg.list():
            section = key.split(".")[0]
            grouped.setdefault(section, []).append((key, value))

        for section, items in grouped.items():
            lines = []
            for key, value in items:
                lines.append(f"[cyan]{key}[/cyan]: [white]{value}[/white]")

            panel_content = "\n".join(lines)
            panel = Panel(
                panel_content,
                title=f"[bold white]{section.upper()}[/]",
                border_style="blue",
            )
            console.print(panel)

    else:
        console.print("No action specified. Use --help for usage information.")
