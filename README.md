# Instagram CLI

The ultimate weapon against brainrot. The fastest, lightest, and most portable Instagram client.

$$
\text{Instagram}_{\text{CLI}} = \lim_{\text{screen time} \to 0} \text{Productivity} \to \infty
$$

[![npm](https://img.shields.io/npm/v/@i7m/instagram-cli?style=flat-square)](https://www.npmjs.com/package/@i7m/instagram-cli)
[![downloads](https://img.shields.io/npm/dm/@i7m/instagram-cli?style=flat-square)](https://www.npmjs.com/package/@i7m/instagram-cli)
![PyPI](https://img.shields.io/pypi/v/instagram-cli)
[![PyPI Downloads](https://static.pepy.tech/badge/instagram-cli)](https://pepy.tech/projects/instagram-cli)
![Python](https://img.shields.io/pypi/pyversions/instagram-cli)
[![MIT license](https://img.shields.io/github/license/supreme-gg-gg/instagram-cli.svg)](https://github.com/supreme-gg-gg/instagram-cli/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/supreme-gg-gg/instagram-cli.svg)](https://github.com/supreme-gg-gg/instagram-cli/issues)

https://github.com/user-attachments/assets/3dd65afe-b0d7-4554-9b3c-1e37111ae27d

> [!WARNING]
> This project is not affiliated with, authorized, or endorsed by Instagram. This is an independent and unofficial project. Using it might violate Meta's Terms of Service. Use at your own risk.

## What does it do?

- We transform Instagram from a brainrot hell into productivity tool
- We allow you to focus on meaningful conversations
- We celebrate the art and simplicity of **terminal UI (TUI)**

> [!TIP]
> Use Instagram with 100% keyboard control - no mouse clicks or touchscreen taps needed! Perfect for developers and Linux users who love staying on the keyboard 🤣

## Typescript Client

We recommend using the TypeScript client whenever possible. It is more secure, performant, feature-rich, actively developed, and works on all platforms including Windows.

```bash
npm install -g @i7m/instagram-cli
```

For other installation methods, please refer to the [TypeScript Client Documentation](./instagram-ts/DEVELOPMENT.md).

### Key Features

- Full support for Windows, Linux, and macOS, modern React-based UI
- Developer-friendly shortcuts, viewing feed and stories, in-terminal image rendering
- Leverages realtime MQTT-based protocol used by Instagram app for instant notifications and chat
- Highly performant and much faster than your GUI browser or touchscreen app
- Works well in all terminal emulators, **including VSCode Integrated Terminal**

## Python Client

> The Python client is the original implementation of `instagram-cli`.

The simplest way to get started is to install the package from PyPI if you have Python installed:

```bash
pip install instagram-cli
```

Note that Python links to the `instagram` command, while TypeScript links to `instagram-cli`.

> [!CAUTION]
> We do not recommend using the TypeScript and Python client simultaneously with the same account to reduce the risk of account bans. We recommend using the TypeScript client when possible since it is much less likely to trigger Instagram's anti-bot mechanisms.

### Key Features

- Classic `curses`-based terminal UI, works well on Linux and macOS, nostalgic UNIX vibes...
- Extends Instagram with powerful plugins like LaTeX rendering, chat summarisation (e.g. Ollama)

For more information about the Python client, please refer to the [Python Client Documentation](./instagram/README.md). **The following documentation is for the Typescript client only.**

## Commands

The following commands will be available after installing the package:

```bash
instagram-cli                                  # display title art
instagram-cli --help                           # view available commands

# Authentication
instagram-cli auth login --username            # login with username and password
instagram-cli auth logout                      # logout and removes session
instagram-cli auth switch <username>           # switch to another saved account
instagram-cli auth whoami                      # display current default user

# Core features
instagram-cli chat                             # start chat interface
instagram-cli feed                             # view posts from people you follow
instagram-cli stories                          # view stories from people you follow
instagram-cli notify                           # view notifications (inbox, followers, mentions)

# Modify configuration
instagram-cli config                           # lists all config
instagram-cli config <key> <value>             # set config key to value
instagram-cli config edit                      # open config file in editor
```

> [!TIP]
> You can easily manage multiple accounts with Instagram CLI!
> Your login for each account will be saved **locally** and you can switch between them or run a certain command with a specific account using the `--username` flag.

## Chat Commands

Inside the chat interface and after selecting a thread, you can navigate all interface with 100% keyboard support. When messaging, the following commands are available:

```bash
# Select messages to perform actions
:select
:react <emoji>
:reply <text>
:unsend

# Media Handling
:upload <path-to-image-or-video>
# Download command coming soon...

# Navigation
:k # go up
:K # go to top
:j # go down
:J # go to bottom
```

> [!TIP]
> You can quickly include text files or images in a message by using `#` followed by the file path. For example, `#path/to/file.txt` or `#path/to/image.png`.
> Use `tab` and `enter` to autocomplete file paths. You can include emojis in messages with `:emoji_name:` e.g. `:thumbsup:` = 👍 (with fuzzy matching).

### Configuration

You can view and modify configuration with `instagram-cli config`. The configuration file is located at `~/.instagram-cli/config.ts.yaml`. The following are common configuration options:

| Key            | Type   | Default     | Description                                                                                                 |
| -------------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------- |
| image.protocol | string | "halfBlock" | Protocol for rendering images. Options: "ascii", "halfBlock", "braille", "kitty", "iterm2", "sixel", or "". |
| feed.feedType  | string | "list"      | Layout of feed display. Options: "timeline", "list", "".                                                    |

> [!NOTE]
> We automatically select the best image protocol based on your terminal. If you experience issues with image rendering, try changing the `image.protocol` setting. Make sure this is supported by your terminal (e.g. `sixel` and `iterm2` protocols won't work in Kitty).

## Contributing

We welcome contributors! Please see the comprehensive [CONTRIBUTING.md](CONTRIBUTING.md) file for details on how to get started, create issues, and submit pull requests. It is very important that you follow these instructions because we manage two different clients in the same repository.

### Commitment to Open Source

Maintainers behind `instagram-cli` are committed to contributing to the open source community behind frameworks that empower terminal applications, such as `ink`. This includes direct contributions and our sister projects -- [Ink Picture, Ink-native image component](https://github.com/endernoke/ink-picture) and [Wax, Ink routing framework](https://github.com/endernoke/wax).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=supreme-gg-gg/instagram-cli&type=date&legend=top-left)](https://www.star-history.com/#supreme-gg-gg/instagram-cli&type=date&legend=top-left)
