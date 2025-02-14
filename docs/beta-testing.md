# Beta Testing Guide

Thank you for your interest in beta testing our app! We are excited to have you onboard and you will be part of the effort to transform Instagram from a brainrot hell into a productive tool. Instagram CLI is an extremely easy to use and simple tool that let you control how you want to use social media! We are (probably) the world's first and only open-sourced CLI (Command Line Interface) + TUI (Terminal User Interface) client for Instagram and we are looking forward to your feedback and suggestions.

This guide will help you get started with the beta testing process. If you haven't, please read the [README](./README.md) file to get an overview of the app.

> This entire process will take around 10-15 minutes depending on your familiarity with Python and CLI tools. Make sure you complete the feedback [survey](https://forms.gle/5iZVECm54YWKLCYeA) after testing the app.

## Installation

You must have the Python programming language installed on your system to run this app. If you don't have Python installed, you can download it from the official website: [python.org](https://www.python.org/).

During beta testing, the package will not be available on PyPI, so you will also need `Git` to obtain the package. Git is a version control system that helps track changes in source code. It comes pre-installed on most UNIX-like systems (e.g. MacOS, Linux). Windows users might need to install [Git for Windows](https://git-scm.com/downloads/win).
You will have to clone the repository and install the package manually. Here's how you can do it:

1. Open the terminal and clone the repository using the following command:

   ```bash
   git clone https://github.com/supreme-gg-gg/instagram-cli.git
   cd instagram-cli
   ```

2. Create a virtual environment using the following command (recommended, but not required if you know what you are doing):

   ```bash
   python -m venv venv
   source venv/bin/activate # for UNIX-like systems
   .\venv\Scripts\activate # for Windows
   ```

3. Install the package using the following command:

   ```bash
    pip install -e .
   ```

This will automatically install all the dependencies required to run the app. We use curses for terminal UI (it is one of the oldest and most widely used libraries for creating terminal-based applications). On most UNIX-like systems, this comes pre-installed. If you are on Windows, the `windows-curses` package should be installed in the last command.

> NOTE: moving ahead, windows users might face some issues with the TUI. (see below). If you encounter any other issues, please report it.

## General Instructions

Before you start testing the app, make sure you have an Instagram account. If you don't have one, you can create one [here](https://www.instagram.com/). The application will NOT store any of your data since it is totally local. We recommend using a dummy account in the rare case that something goes wrong and messes up your account.

> Up until this point, we have not encountered any issue with Instagram's API on any test accounts. However, if you face any issue, please report it.

### Reporting Issues

If you encounter any issues while using the app, please report them on the GitHub repository. **ALL BUGS SHALL BE REPORTED ONLY ON THE GITHUB REPOSITORY**. Please follow the issue template for opening bug reports. If the issue already exists, do not open duplicate issues. Instead, you can comment on the existing issue.

### Feedback Survey

After you have tested the app, please fill out the [beta testing survey](https://forms.gle/5iZVECm54YWKLCYeA). Feature requetss can be done through the survey or by opening an issue on the GitHub repository.

## Steps to Test

The following section will guide you over a basic tutorial of the app.

1. First, let's login to your Instagram account!

   ```bash
   instagram login
   ```

   This will save a session cache so you don't have to login every time you run the app.

2. Let's have a look at the available commands.

   ```bash
   instagram --help
   ```

   For each of the commands below, you can run it with the `--help` flag to see the available options.

3. Wondering if you got any new followers, mentions, or unread messages? Let's check it out!

   ```bash
   instagram notify
   ```

4. Now, let's see how much you brainrotted over the last 30 days.

   ```bash
   instagram stats --days 30
   ```

> There is a known issue when running this command for Windows users. You might get an error like this:
   ```
    ...
    Error: window.vline() returned ERR
   ```
   In this case you won't be able to access analytics right now. We will fix this asap.

5. **Lastly it's time for the main feature of the app, the chat! Let's boot up the chat interface...**

   ```bash
   instagram chat
   ```

6. Inside the chat window, select a chat using arrow keys and hit enter to open the chat.

7. Tired of just sending text messages? Let's power up the chat with some useful commands!

   - `:help`: Get a list of available commands.
   - `:back`: Return to chat list.
   - `:reply`: Select and reply to a message.
   - `:upload`: Upload an image or video, **opens a file navigator**.
   - `:upload <path>`: Upload an image or video, directly from the path.
   - `:view <index>`: View and download media at a specific index. This supports images, videos, and opens URL **directly in your browser**.

   Make sure to test all the commands and features in the chat interface!

8. Couldn't find the person you were looking for in the chat menu? You can simply search for them (by username) in the search box in the chat list page!

   Alternatively, you can head straight to the chat with:

   ```bash
   instagram chat --username <username>
   ```

9. Once you are done testing, you can logout using the following command:

   ```bash
   instagram logout
   ```

10. Cleanup the cache and session files using the following command:

    ```bash
    instagram cleanup
    ```

## Troubleshooting

### Login Issues
If you receive messages like "We detected automated behavior on your account" or "We detected unusual activity on your account" when trying to log in, don't panic! This is a common security measure from Instagram. Simply:
1. Open the Instagram mobile app
2. Follow the verification instructions shown
3. Try logging in through the CLI again
> None of our test accounts have been banned or restricted due to these security checks.

### Windows Display Issues
The interface might appear visually broken on Windows systems. This is a known issue currently under investigation. We're working on a fix.

### Other Issues
For any other issues you encounter, please:
1. Check the existing issues on GitHub
2. If not found, create a new issue with detailed information about the problem
3. Include your system information and steps to reproduce the issue

## Conclusion

Thank you for participating in the beta testing process. Make sure you fill out the [feedback survey](https://forms.gle/5iZVECm54YWKLCYeA) after testing the app and open issues on the GitHub repository for any bugs or feature requests. If you are interested in using the package, the stable version will be available on PyPI soon. Stay tuned and have fun returning to brainrotting! 🧠🔥
