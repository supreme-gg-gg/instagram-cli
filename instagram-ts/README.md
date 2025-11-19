# Instagram CLI

Welcome to the TypeScript client of the Instagram CLI project. The Typescript client is a successor to the original Python client, built with a modern React-based UI using [Ink](https://github.com/vadimdemedes/ink), with features like image rendering in terminal, checking feed and stories, and using Instagram's native [MQTT protocol](https://mqtt.org/) for messaging to significantly reduce latency and account flags.

Full documentation with demo video is [on our GitHub](https://github.com/supreme-gg-gg/instagram-cli).

> [!NOTE]
> Typescript client is current in Public Beta. While we have tested it extensively, there may still be some bugs. Please report them [on our issues page](https://github.com/supreme-gg-gg/instagram-cli/issues).

## Key Features

- Full support for Windows, Linux, and macOS, with modern React-based UI
- Developer-friendly shortcuts, viewing feed, stories, and chatting, in-terminal image rendering
- Leverages realtime MQTT-based protocol used by Instagram app for instant notifications and chat
- Highly performant and much faster than your GUI browser or touchscreen app
- Works well in all terminal emulators, **including VSCode Integrated Terminal**

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
instagram-cli stories                          # view stories from people you follow
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

You can view and modify configuration with `instagram-cli config`. The configuration file is located at `~/.instagram-cli/config.ts.yaml`. The following are common configuration options:

| Key            | Type   | Default     | Description                                                                                                 |
| -------------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------- |
| image.protocol | string | "halfblock" | Protocol for rendering images. Options: "ascii", "halfblock", "braille", "kitty", "iterm2", "sixel", or "". |
| feed.feedType  | string | "list"      | Layout of feed display. Options: "timeline", "list", "".                                                    |

> [!NOTE]
> We automatically select the best image protocol based on your terminal. If you experience issues with image rendering, try changing the `image.protocol` setting. Make sure this is supported by your terminal (e.g. `kitty` protocol won't work in iTerm2).

## Design philosophy

1. Simplicity, a clean interface with minimal distractions

2. Absolutely no brainrot, no ads, no attention traps

3. Convenience, quick access to essential features, open anywhere even in VSCode Integrated Terminals, super fast startup (no browser)

4. Developer-first, open source, extensible, and keyboard-first

## Contributing

We welcome contributors! Please see the comprehensive [CONTRIBUTING.md](CONTRIBUTING.md) file for details on how to get started, create issues, and submit pull requests. It is very important that you follow these instructions because we manage two different clients in the same repository.

### Commitment to Open Source

Maintainers behind `instagram-cli` are committed to contributing to the open source community behind frameworks that empower terminal applications, such as `ink`. This includes direct contributions and our sister projects -- [Ink Picture, Ink-native image component](https://github.com/endernoke/ink-picture) and [Wax, Ink routing framework](https://github.com/endernoke/wax).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=supreme-gg-gg/instagram-cli&type=date&legend=top-left)](https://www.star-history.com/#supreme-gg-gg/instagram-cli&type=date&legend=top-left)
