from instagram.commands import CommandRegistry

cmd_registry = CommandRegistry()

@cmd_registry.register("upload", "Upload a photo or video")
def upload_media(context, filepath: str):
    
    # Mock implementation
    return f"Uploading media from {filepath}..."

@cmd_registry.register("schedule", "Schedule a message")
def schedule_message(context, time: str, message: str):
    # Mock implementation
    return f"Scheduled message '{message}' for {time}"

@cmd_registry.register("help", "Show available commands")
def show_help(context):
    return cmd_registry.get_help()
