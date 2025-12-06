from typing import Callable, Dict, List, Generator
from dataclasses import dataclass
import inspect
import re


@dataclass
class Command:
    name: str
    shorthand: str
    func: Callable
    help_text: str
    args: List[str]
    required_args: List[str]


class CommandRegistry:
    def __init__(self):
        self.commands: Dict[str, Command] = {}
        self.shorthands: Dict[str, str] = {}  # Maps shorthand to full command name

    def register(
        self,
        name: str,
        help_text: str = "",
        required_args: List[str] = None,
        shorthand: str = "",
    ):
        """
        Decorator to register a command
        Usage: @cmd_registry.register("command_name", "Help text", ["arg1", "arg2"], "cmd")
        """

        def decorator(func: Callable):
            args = [p.name for p in inspect.signature(func).parameters.values()]
            required = (
                required_args if required_args is not None else args[1:]
            )  # Skip context
            self.commands[name] = Command(
                name, shorthand, func, help_text, args, required
            )
            if shorthand:
                self.shorthands[shorthand] = name
            return func

        return decorator

    def execute(self, command_str: str, **context) -> str | Generator:
        """Execute a command string"""
        parsed = self.parse_command(command_str)
        if isinstance(parsed, str):
            return parsed

        cmd_name = parsed["command"]
        args = parsed["args"]

        if cmd_name in self.commands:
            cmd = self.commands[cmd_name]
            if len(args) < len(cmd.required_args):
                return f"Error: Missing arguments. Usage: {cmd.name} {' '.join(cmd.required_args)}"
            return cmd.func(context, *args)
        elif cmd_name in self.shorthands:
            full_cmd_name = self.shorthands[cmd_name]
            cmd = self.commands[full_cmd_name]
            if len(args) < len(cmd.required_args):
                return f"Error: Missing arguments. Usage: {cmd.name} {' '.join(cmd.required_args)}"
            return cmd.func(context, *args)
        else:
            return f"Error: Command not found: {cmd_name}"

    @staticmethod
    def parse_command(command_str: str):
        """
        Parse a command string into a dictionary.
        Supports:
          1. Only command, e.g., :quit
          2. Commands with short arguments: :view 0
          3. Commands with both short and long arguments: :schedule time "this is a long message"
          4. Commands with only long arguments: :latex $this is latex code$

        NOTE: This assumes the ":" prefix has already been stripped when handled by ChatUI.

        Long arguments (enclosed in "" or $$) are returned as single tokens.
        """
        # "([^"]+)"  - matches double-quoted content,
        # \$([^$]+)\$ - matches dollar-sign enclosed content,
        # (\S+) - matches non-whitespace sequence.
        pattern = r'"([^"]+)"|\$([^$]+)\$|(\S+)'
        matches = re.findall(pattern, command_str)
        tokens = []
        for group in matches:
            # Each match is a tuple of three elements; one is set.
            token = group[0] or group[1] or group[2]
            tokens.append(token)
        if not tokens:
            return "Error: Empty command string."

        return {"command": tokens[0], "args": tokens[1:]}

    def get_help(self) -> str:
        """Get help text for all commands"""
        return "\n".join(
            [
                f"{cmd.name} {f'({cmd.shorthand})' if cmd.shorthand else ''}: {cmd.help_text} "
                f"(Usage: {cmd.name} {' '.join(cmd.required_args)})"
                for cmd in self.commands.values()
            ]
        )
