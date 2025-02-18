from typing import Callable, Dict, List
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

    def register(self, name: str, help_text: str = "", required_args: List[str] = None, shorthand: str = ""):
        """
        Decorator to register a command
        Usage: @cmd_registry.register("command_name", "Help text", ["arg1", "arg2"], "cmd")
        """
        def decorator(func: Callable):
            args = [p.name for p in inspect.signature(func).parameters.values()]
            required = required_args if required_args is not None else args[1:]  # Skip context
            self.commands[name] = Command(name, shorthand, func, help_text, args, required)
            if shorthand:
                self.shorthands[shorthand] = name
            return func
        return decorator

    def execute(self, command_str: str, **context) -> str:
        """Execute a command string"""
        try:
            # Split into command and rest
            parts = command_str.split(None, 1)

            # The first word is the command name
            cmd_name = parts[0]

            # Check if it's a shorthand and convert to full command name
            if cmd_name in self.shorthands:
                cmd_name = self.shorthands[cmd_name]
            
            if cmd_name not in self.commands:
                return f"Unknown command: {cmd_name}"

            cmd = self.commands[cmd_name]

            # Split the rest into arguments
            args = []

            if len(parts) > 1:
                rest = parts[1]
                # Check if this is a LaTeX expression (starts and ends with $)
                if rest.startswith('$') and rest.endswith('$'):
                    args = [rest[1:-1]]  # Keep LaTeX expression as a single argument
                else:
                    # For non-LaTeX commands, split normally
                    args = rest.split()

            # Check if we have enough required arguments
            if len(args) < len(cmd.required_args):
                return f"Usage: {cmd_name} {' '.join(cmd.required_args)}"
            
            # Pad with None for optional arguments
            while len(args) < len(cmd.args) - 1:  # -1 for context
                args.append(None)
            
            return cmd.func(context, *args)
        except Exception as e:
            return f"Error executing command: {str(e)}"

    def get_help(self) -> str:
        """Get help text for all commands"""
        return "\n".join([
            f"{cmd.name} {f'({cmd.shorthand})' if cmd.shorthand else ''}: {cmd.help_text} "
            f"(Usage: {cmd.name} {' '.join(cmd.required_args)})"
            for cmd in self.commands.values()
        ])