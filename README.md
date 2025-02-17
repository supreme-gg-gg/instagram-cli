# instagram-cli

The ultimate weapon against brainrot.

https://github.com/user-attachments/assets/81d87c0d-e39f-4af6-8337-d411a240a659

> The page will be updated soon with more information.

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

If you do not want to install Python, you can download the pre-built executables from the [releases page]().

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
instagram stats --days <last_n_days>       # view usage analytics (default: 14 days)
instagram config --get --set --edit        # manage custom configuration
instagram cleanup -t                       # cleanup media and session cache files
```

> All searches in the package uses a custom fuzzy matching based on ratcliff/obershelp similarity algorithm. This means chat search and emoji search will be more flexible and forgiving.

## Chat Commands

The following commands should be typed and sent in the chat box in chat interface:

- `:help`: view available commands
- `:quit`: quit the application
- `:back`: back to chat menu for selecting chat
- `:reply`: reply mode to select and reply to messages
- `:scrollup`or `:k`: scroll up in chat messages
- `:scrolldown` or `:j`: scroll down in chat messages
- `:upload`: upload media using the file navigator
- `:upload <path>`: upload media (photo or video) directly from path
- `:view <index>`: view and download media at index or open URL directly in browser
- `:latex $<expr>$`: render and send LaTeX code as image

### Emoji

Text with emoji syntax will be rendered as emoji. For example,

`This is an emoji :thumbsup:`

will be rendered as

`This is an emoji 👍`

This does not have to be an exact match with the emoji name. For example, `:thumbsup:` can also be written as `:thumbs_up:`.

### LaTeX

We support LaTeX rendering and sending as images. For example,

`:latex $\frac{a}{b} + c = d$`
`:latex $\int{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$`

will render the LaTeX code and send the image in chat.

![sample1](resource/latex_sample_1.png)
![sample2](resource/latex_sample_2.png)

Please note that the LaTeX code **_MUST_** be enclosed in `$` symbols.

You can choose to render with [online API](https://latex.codecogs.com) (default) or local LaTeX installation such as TeX Live, MiKTeX, etc. You can set the rendering method with `instagram config --set latex_rendering_method <online|local>`.

### Markdown

Coming soon!

### Code Blocks

Coming soon!
