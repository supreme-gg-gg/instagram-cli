# Instagram CLI

The ultimate weapon against brainrot. The fastest, lightest, and most portable Instagram client.

$$
\text{Instagram}_{\text{CLI}} = \lim_{\text{screen time} \to 0} \text{Productivity} \to \infty
$$

[![npm](https://img.shields.io/npm/v/@i7m/instagram-cli?style=flat-square)](https://www.npmjs.com/package/@i7m/instagram-cli)
[![downloads](https://img.shields.io/npm/dm/@i7m/instagram-cli?style=flat-square)](https://www.npmjs.com/package/@i7m/instagram-cli)
![PyPI](https://img.shields.io/pypi/v/instagram-cli)
[![PyPI Downloads](https://static.pepy.tech/badge/instagram-cli)](https://pepy.tech/projects/instagram-cli)
[![AUR](https://img.shields.io/aur/version/instagram-cli?label=AUR)](https://aur.archlinux.org/packages/instagram-cli)
[![GitHub issues](https://img.shields.io/github/issues/supreme-gg-gg/instagram-cli.svg)](https://github.com/supreme-gg-gg/instagram-cli/issues)

<!-- ![Python](https://img.shields.io/pypi/pyversions/instagram-cli) -->

https://github.com/user-attachments/assets/fb25cc5f-a868-487d-b853-a7bbe77ba348

> [!WARNING]
> This project is not affiliated with, authorized, or endorsed by Instagram. This is an independent and unofficial project. Using it might violate Meta's Terms of Service. Use at your own risk.

## Why Instagram CLI?

Empower yourself to become a 10x Instagrammer by minimizing distractions, enabling 100% keyboard control, and accessing it from any terminal — whether in your VSCode editor or your Linux server.

Instagram CLI allows you to use social media more intentionally -- to stay connected with people you care about rather than being exploited for your attention.

- Chat with your friends without falling into endless brainrot
- Stay updated with post and stories from people around you
- Focus on meaningful, intentional conversations and be productive
- Full keyboard navigation and shortcuts, no mouse, no touchscreens
- Celebrate the art and simplicity of **terminal UI (TUI)**

## Installation

### NPM

Requires Node.js v20 or higher.

```bash
npm install -g @i7m/instagram-cli
```

### Homebrew (macOS/Linux)

```bash
brew tap supreme-gg-gg/tap
brew install instagram-cli
```

The formula is available [here](https://github.com/supreme-gg-gg/homebrew-tap/blob/main/Formula/instagram-cli.rb).

We also ship a Python client with nostalgic UNIX vibes since Instagram CLI was first built in Python with `curses`. For installation and more information, see [Python Client Documentation](./instagram-py/README.md).

### Community Packages

The following packages are supported by the community. The maintainers of Instagram CLI do not provide support for these packages.

#### AUR (Arch Linux)

```bash
yay -S instagram-cli
```

#### Snap (Linux)

```bash
snapcraft pack
sudo snap install instagram-cli_1.4.0_amd64.snap --dangerous
snap run instagram-cli.instagram-cli
# OR, since /snap/bin is in PATH
instagram-cli
```

We welcome contributions to add more installation methods.

For installation from source, please refer to the [TypeScript Client Documentation](./DEVELOPMENT.md).

## CLI Commands

The following commands will be available after installing the package:

```bash
instagram-cli                                  # display title art
instagram-cli --help                           # view available commands

# Authentication
instagram-cli auth login --username            # login with username and password
instagram-cli auth logout                      # logout and removes session
instagram-cli auth switch <username>           # switch to another saved account
instagram-cli auth whoami                      # display current default user

# Launches TUI interfaces
instagram-cli chat -u <username> -t <title>    # start chat interface
instagram-cli feed                             # view posts from people you follow
instagram-cli stories                          # view stories from people you follow (BETA)
instagram-cli notify                           # view notifications (inbox, followers, mentions)

# Modify configuration
instagram-cli config                           # lists all config
instagram-cli config <key> <value>             # set config key to value
instagram-cli config edit                      # open config file in editor
```

If you want to use Instagram CLI with AI agents, see [one-turn commands](#one-turn-commands-for-agents--automation) that are non-interactive and designed for agents.

> [!TIP]
> You can easily manage multiple accounts with Instagram CLI!
> Your login for each account will be saved **locally** and you can switch between them using the `instagram-cli auth switch <username>` command or run a certain command with a specific account using the `--username` flag.

## Chat Commands

Inside the chat interface and after selecting a thread, you can navigate all interface with 100% keyboard support. When messaging, the following commands are available:

```bash
# Select messages to perform actions
:select
:react <emoji | :emoji_name:>
:reply <text>
:unsend

# Media Handling
:upload <path-to-image-or-video>
:download <path-to-save> # Requires :select first to select message

# Navigation
:k # go up
:K # go to top
:j # go down
:J # go to bottom
```

> [!TIP]
> You can quickly include text files or images in a message by using `#` followed by the file path. For example, `#path/to/file.txt` or `#path/to/image.png`.
> Use `tab` and `enter` to autocomplete file paths. You can include emojis in messages with `:emoji_name:` e.g. `:thumbsup:` = 👍 (with fuzzy matching).

Instagram CLI supports mouse interactions as well, so you can click on messages to select them, scroll through the chat, and click to reposition the cursor when typing messages. We're gradually rolling out more mouse support in our TUI!

## One-turn Commands (for AI Agents)

These commands are non-interactive (no TUI) — they run once, print to stdout, and exit. They're designed for scripting, piping, and AI agent tool-use. All commands accept `-o json` for structured JSON output. Example usage includes:

```bash
# These are only example usages. Run -h / --help for full manual.
instagram-cli inbox
instagram-cli send <thread> --text "Hey, how are you?"
instagram-cli read <thread> --limit 10 --mark-seen --output json
instagram-cli read <thread> --message-id <id> --download "./photo.jpg"
instagram-cli reply <thread> --message-id <id> --text "Hey, how are you?"
instagram-cli unsend <thread> --message-id <id>
```

`<thread>` accepts a thread ID, username, or fuzzy thread title. Prefer passing thread IDs (from `inbox -o json`) directly to avoid redundant lookups.

> [!TIP]
> **Building an AI agent that uses Instagram?** Load [`./skills/instagram-skill/SKILL.md`](./skills/instagram-skill/SKILL.md)
> into your agent's workspace (or point your agent framework at it). It covers all commands, JSON
> output format, thread resolution, multi-account usage, and a recommended workflow.

```bash
npx skills add supreme-gg-gg/instagram-cli
```

## Configuration

You can view and modify configuration with `instagram-cli config`. The configuration file is located at `~/.instagram-cli/config.ts.yaml`. The following are common configuration options:

| Key            | Type   | Default     | Description                                                                                                 |
| -------------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------- |
| image.protocol | string | "halfBlock" | Protocol for rendering images. Options: "ascii", "halfBlock", "braille", "kitty", "iterm2", "sixel", or "". |
| feed.feedType  | string | "list"      | Layout of feed display. Options: "timeline", "list", "".                                                    |

> [!NOTE]
> We automatically select the best image protocol based on your terminal. If you experience issues with image rendering, try changing the `image.protocol` setting. Make sure this is supported by your terminal (e.g. `sixel` and `iterm2` protocols won't work in Kitty).

## Contributing

We welcome contributors! Please see the comprehensive [CONTRIBUTING.md](CONTRIBUTING.md) file for details on how to get started, create issues, and submit pull requests. It is very important that you follow these instructions because we manage two different clients in the same repository. _Instagram CLI is NOT meant to be used for bot-behaviours, we will not accept contributions that add such features._

### Reporting Issues

Occasionally, Instagram may update their API or protocols which can cause certain features to break. If you encounter any issues, please report them on our [GitHub Issues page](https://github.com/supreme-gg-gg/instagram-cli/issues). Make sure to attach the relevant log files located at `~/.instagram-cli/logs/` to help us diagnose and fix the problem quickly. You may want to redact sensitive data like your username for privacy.

### Sister projects

We contributed the following extensions to the Ink ecosystem for building Terminal UI apps:

- [Ink Picture, Ink-native image component](https://github.com/endernoke/ink-picture)
- [Wax, Ink routing framework](https://github.com/endernoke/wax).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=supreme-gg-gg/instagram-cli&type=date&legend=top-left)](https://www.star-history.com/#supreme-gg-gg/instagram-cli&type=date&legend=top-left)
