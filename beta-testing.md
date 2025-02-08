# Beta Testing Guide

Thank you for your interest in beta testing our app! We are excited to have you on board and look forward to your feedback. This guide will help you get started with the beta testing process.

## Installation

You must have the Python programming language installed on your system to run this app. If you don't have Python installed, you can download it from the official website: [python.org](https://www.python.org/).

For now the package is not available on PyPI, so you will have to clone the repository and install the package manually. Here's how you can do it:

1. Clone the repository using the following command:

   ```bash
   git clone https://github.com/supreme-gg-gg/instagram-cli.git
   cd instagram-cli
   ```

2. Create a virtual environment using the following command:

   ```bash
   python -m venv venv
   source venv/bin/activate # for UNIX-like systems
   .\venv\Scripts\activate # for Windows
   ```

3. Install the package using the following command:

   ```bash
    pip install .
    pip install -e . # or if you wish to make changes to the code
   ```

This will automatically install all the dependencies required to run the app. We use curses to make a simplistic CLI interface. On most UNIX-like systems, this comes pre-installed. However, if you are on Windows, you will need to install the `windows-curses` package using the following command:

```bash
pip install windows-curses
```

## General Instructions

Before you start testing the app, make sure you have an Instagram account. If you don't have one, you can create one [here](https://www.instagram.com/). We recommend using a test account to avoid any issues with your personal account.

> Please note that we are not responsible for any issues that may arise from using the app with your personal account. However, we have never encountered any issues during our own testing. Also note that we do not store any user data. Everything is stored locally on your machine.

### Reporting Issues

If you encounter any issues while using the app, please report them on the GitHub repository. Please follow the issue template.

### Beta Testing Survey

After you have tested the app, please fill out the beta testing survey.

### Providing Feedback

Public beta testing feedback should all be submitted through the survey Google form. This includes any potential feature improvements, or new feature suggestions.

## Usage

You will then test the following features:

1. **Login**: You will be able to log in to your Instagram account using the app.

```bash
instagram login --username <username> --password <password> # if you don't use the flag, you will be prompted to enter your username and password
instagram login # if you have already logged in
```

2. **Statistics**: See how much you brainrotted over the last n days.

```bash
instagram stats --days <n> # if you don't use the flag, the default value is 7
```

3. **Notifications**: Get notifications for people liking your posts, stories, mentions, followers, etc.

```bash
instagram notif
```

And lastly, our most important feature:

4. **Chat**: Send messages to your friends.

```bash
instagram chat
```

### Chat Commands

- `/help`: Get a list of available commands.
- `/exit`: Exit the chat.
- `/schedule <time> <message>`: Schedule a message to be sent at a specific time.
- `/image <path>`: Send an image to the chat.
- `/video <path>`: Send a video to the chat.

## Conclusion

Thank you for participating in the beta testing process. Your feedback is invaluable to us, and we appreciate your time and effort in helping us improve our app. If you have any questions or need further assistance, please feel free to reach out to us. Happy testing! 🚀
