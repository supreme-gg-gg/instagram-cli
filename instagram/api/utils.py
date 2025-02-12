import logging

def setup_logging(name: str):
    """
    Logging is the de-facto standard for debugging in this project.
    This is because you can't simply print to console when running terminal app lol.
    This function sets up logging for the file with the given name.
    """
    logging.basicConfig(filename="debug.log", level=logging.DEBUG)

    # Configure logging to only capture logs from this script
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)  # Set desired log level

    # Optional: Define log format
    formatter = logging.Formatter('%(levelname)s: %(message)s')

    # Create file handler
    file_handler = logging.FileHandler('debug.log')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    # Apply handler to your logger
    logger.addHandler(file_handler)

    # Disable all other loggers (dependencies) 
    logging.getLogger().setLevel(logging.CRITICAL)

    return logger