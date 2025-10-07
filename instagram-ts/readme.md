# Instagram CLI

Welcome to the TypeScript client of the Instagram CLI project. The Typescript client is a successor to the original Python client, built with a modern React-based UI using Ink, with features like image rendering in terminal, checking feed, and using MQTT protocol for messaging to significantly reduce latency and account flags.

The original python client can be found [on our GitHub](https://github.com/supreme-gg-gg/instagram-cli)

> [!NOTE]
> Typescript client is current in Public Beta. While we have tested it extensively, there may still be some bugs. Please report them [on our issues page](https://github.com/supreme-gg-gg/instagram-cli/issues).

We are the ultimate weapon against brainrot, so that you can focus on meaningful conversations without distractions.

We celebrate the art and simplicity of terminal UI, while contributing to the Ink open source ecosystem so that everyone can build amazing terminal apps! Checkout [ink-picture](https://github.com/endernoke/ink-picture), our sister-project for displaying images in the terminal.

## Usage

Install the package globally:

```bash
npm install -g @i7m/instagram-cli
```

### Commands

The following commands will be available after installing the package:

```bash
instagram-cli                                  # display title art
instagram-cli --help                           # view available commands

# Authentication
instagram-cli auth login --username            # login with username and password
instagram-cli auth logout                      # logout and removes session

# Core features
instagram-cli chat                             # start chat interface
instagram-cli feed                             # view posts from people you follow
instagram-cli notify                           # view notifications (inbox, followers, mentions)

# Modify configuration
instagram-cli config                           # view and modify configuration
```

Note that the parent command is `instagram-cli` instead of `instagram` to avoid conflict with the Python client if you have both installed.

### Chat Commands

You can navigate all interface with 100% keyboard support. When messaging, the following commands are available:

```bash
:help
:select # select first before unsend or react
:react <emoji>
:unsend
:upload <path-to-image-or-video>
:k # go up
:K # go to top
:j # go down
:J # go to bottom
```

> [!TIP]  
> You can quickly include text files or images in a message by using `#` followed by the file path. For example, `#path/to/file.txt` or `#path/to/image.png`.  
> Use `tab` and `enter` to autocomplete file paths.

### Configuration

You can view and modify configuration with `instagram-cli config`. The configuration file is located at `~/.instagram-cli/config.ts.yaml`.

## Design philosophy

1. Simplicity, a clean interface with minimal distractions

2. Absolutely no brainrot, no ads, no attention traps

3. Convenience, quick access to essential features, open anywhere even in VSCode Integrated Terminals, super fast startup (no browser)

4. Developer-first, open source, extensible, and keyboard-first
