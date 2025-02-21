# Instagram CLI

The ultimate weapon against brainrot.

![PyPI](https://img.shields.io/pypi/v/instagram-cli)
![Python](https://img.shields.io/pypi/pyversions/instagram-cli)
[![MIT license](https://img.shields.io/github/license/supreme-gg-gg/instagram-cli.svg)](https://github.com/supreme-gg-gg/instagram-cli/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/supreme-gg-gg/instagram-cli.svg)](https://github.com/supreme-gg-gg/instagram-cli/issues)

<!-- ![LOC](https://tokei.rs/b1/github/supreme-gg-gg/instagram-cli?category=code) -->

https://github.com/user-attachments/assets/e9206e14-8141-49b2-8e2c-17c76402e3cb

The world's first open-source CLI (command line interface) + Terminal UI client for Instagram.

## What does it do?

- We transform Instagram from a brainrot hell into productivity tool
- We give back control of social media to the user
- We enable user to do more with less
- We celebrate the art and simplicity of terminal UI
- We preserve the core of social media and protect your attention

> Use Instagram with 100% keyboard control - no mouse clicks or touchscreen taps needed! Perfect for developers and Linux users who love staying on the keyboard 🤣

## Installation

The simplest way to get started is to install the package from PyPI if you have Python installed:

```bash
pip install instagram-cli
```

If you do not have Python installed, you can download and install it from the [official website](https://www.python.org/downloads/).

### Installation from Source

```bash
git clone https://github.com/supreme-gg-gg/instagram-cli.git
cd instagram-cli
pip install .
```

### Docker Installation

You must have Docker installed to use this method. If you do not have Docker installed, you can download and install it from the [official website](https://docs.docker.com/get-docker/).

Build and run Docker image from source:

```bash
git clone https://github.com/supreme-gg-gg/instagram-cli.git
cd instagram-cli
docker build -t instagram-cli .
docker run -it instagram-cli
```

Alternatively, you can pull the pre-built Docker image from Docker Hub (this will available very soon):

```bash
docker run -it supreme-gg-gg/instagram-cli
```

### Pre-built Executables

> NOTE: This option is HIGHLY UNRECOMMENDED unless the other methods do not work for you.

If you do not want to install Python, you can download the pre-built executables from the [releases page](https://github.com/supreme-gg-gg/instagram-cli/releases).

After downloading, the executable can be run from the command line:

```bash
./instagram-cli [OPTIONS] command [ARGS] # for macOS and Linux
instagram-cli.exe [OPTIONS] command [ARGS] # for Windows
```

## Commands

The following commands will be available after installing the package:

```bash
instagram                                  # display title art
instagram --help                           # view available commands

# Authentication
instagram auth login -u                    # login with username and password
instagram auth logout                      # logout and removes session

# Chat Features
instagram chat start                       # start chat interface
instagram chat search -u <username>        # search and open chat by username
instagram chat search -t <text>           # search and open chat by chat title

# Utility Commands
instagram notify                           # view notifications (inbox, followers, mentions)
instagram schedule ls                      # view scheduled messages
instagram stats --days <last_n_days>       # view usage analytics (default: 14 days)
instagram config --get --set --edit        # manage custom configuration
instagram cleanup -t                       # cleanup media and session cache files
```

> All searches in the package uses a custom fuzzy matching based on ratcliff/obershelp similarity algorithm. This means chat search and emoji search will be more flexible and forgiving.

## Chat Commands

The chat interface is the main feature of this package. It allows you to interact with your Instagram chats in a terminal-based interface. All commands have the following syntax:

```bash
:command <args> <long-args>
```

Long arguments should have special enclosures such as `"..."` for strings with spaces and `$...$` for LaTeX code.

- `:help`: view available commands
- `:quit`: quit the application
- `:back`: back to chat menu for selecting chat
- `:reply`: reply mode to select and reply to messages
- `:scrollup`or `:k`: scroll up in chat messages
- `:scrolldown` or `:j`: scroll down in chat messages
- `:schedule <time> "<message>"`: schedule a message, see [scheduling messages](#scheduling-messages)
- `:upload`: upload media using the file navigator
- `:upload <path>`: upload media (photo or video) directly from path
- `:view <index>`: view and download media at index or open URL directly in browser
- `:latex $<expr>$`: render and send LaTeX code as image, see [latex](#latex)

### Emoji

Text with emoji syntax will be rendered as emoji. For example,

`This is an emoji :thumbsup:`

will be rendered as

`This is an emoji 👍`

This does not have to be an exact match with the emoji name. For example, `:thumbsup:` can also be written as `:thumbs_up:`.

### LaTeX

We support LaTeX rendering and sending as images in the chat. For example,

`:latex $\frac{a}{b} + c = d$`

![sample1](https://github.com/supreme-gg-gg/instagram-cli/blob/main/resource/latex_sample_1.png?raw=true)

```bash
:latex $\left( \begin{bmatrix} a & b \\ c & d \end{bmatrix} \cdot \begin{bmatrix} e & f \\ g & h \end{bmatrix} \right) + \begin{bmatrix} i & j \\ k & l \end{bmatrix}^{-1} \times \left( \int_0^1 x^2 \, dx \right) + \begin{bmatrix} \sin(\theta) & \cos(\theta) \\ \tan(\phi) & \ln(\psi) \end{bmatrix}$
```

![sample2](https://github.com/supreme-gg-gg/instagram-cli/blob/main/resource/latex_sample.png?raw=true)

Please note that the LaTeX code **_MUST_** be enclosed in `$` symbols.

You can choose to render with [online API](https://latex.codecogs.com) (default) or local LaTeX installation such as TeX Live, MiKTeX, etc. You can set the rendering method with `instagram config --set latex_rendering_method <online|local>`.

### Scheduling Messages

You can schedule messages to be sent at a later time. The syntax is as follows:

```bash
:schedule <Optional[Y-m-d] HH:MM> "<message>"
```

If the date is not provided, the message will be scheduled for the current day. Input format must be either YYYY-MM-DD HH:MM or HH:MM. **The time must be in 24-hour format, otherwise you might run into warnings for scheduling messages in the past.**

> If you exit the app, the scheduled messages will not be sent but will be restored when you open the app again. You will be prompted by a notification to decide whether to send the scheduled messages or not. We might include system background service in the future to send scheduled messages even when the app is closed.

### Markdown and Code Blocks

Coming soon!
