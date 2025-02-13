from typing import Callable, Dict, List
from dataclasses import dataclass
import inspect

@dataclass
class Command:
    name: str
    func: Callable
    help_text: str
    args: List[str]
    required_args: List[str]

class CommandRegistry:
    def __init__(self):
        self.commands: Dict[str, Command] = {}

    def register(self, name: str, help_text: str = "", required_args: List[str] = None):
        """
        Decorator to register a command
        Usage: @cmd_registry.register("command_name", "Help text", ["arg1", "arg2"])
        """
        def decorator(func: Callable):
            args = [p.name for p in inspect.signature(func).parameters.values()]
            required = required_args if required_args is not None else args[1:]  # Skip context
            self.commands[name] = Command(name, func, help_text, args, required)
            return func
        return decorator

    def execute(self, command_str: str, **context) -> str:
        """Execute a command string"""
        try:
            parts = command_str.split()
            if not parts:
                return "No command specified"
            
            cmd_name = parts[0]
            if cmd_name not in self.commands:
                return f"Unknown command: {cmd_name}"

            cmd = self.commands[cmd_name]
            args = parts[1:] if len(parts) > 1 else []
            
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
            f"{name}: {cmd.help_text} (Usage: {name} {' '.join(cmd.required_args)})"
            for name, cmd in self.commands.items()
        ])