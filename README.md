# instagram-cli

The ultimate weapon against brainrot.

The page will be updated soon with more information.

For beta testing instructions, please refer to the [beta-testing.md](docs/beta-testing.md) docs.

## What does it do?

- We transform Instagram from a brainrot hell into productivity tool
- We give back control of social media to the user
- We enable user to do more with less
- We celebrate the art and simplicity of terminal UI
- We preserve the core of social media and protect your attention

> Use Instagram with 100% keyboard control - no mouse clicks or touchscreen taps needed! Perfect for developers and Linux users who love staying on the keyboard 🤣

## Installation

Installing this CLI tool takes less effort than scrolling reels!!! Think about it next time you login to instagram...

We will soon be available on PyPI so you can download with

```
pip install instagram-cli
```

For now, please install by cloning the repo and installing the package:

```
git clone https://github.com/supreme-gg-gg/instagram-cli
cd instagram-cli
pip install .
```

> We recommend using virtual environment when installing, see the beta testing guide for more info.

## Commands

The following commands will be available after installing the package:

```bash
instagram                                  # title art!
instagram --help                           # view available commands
instagram login                            # login with username and password and saves session cache
instagram logout                           # logout and removes session
instagram chat --username <username>       # chat without brainrot and with convenient commands
instagram notify                           # notifications such as unread inbox, followers, mentions
instagram stats --days <last_n_days>       # brainrot history analytics, default 14 days
instagram config --get --set --edit        # set custom configruation similar to git config
instagram cleanup                          # cleanup media and session cache files
```

<img width="1280" alt="Screenshot 2025-02-12 at 1 13 27 AM" src="https://github.com/user-attachments/assets/ed332ea5-b30c-42e5-a0ae-7ad4b1170d5a" />

## Chat Commands

The following commands should be typed and sent in the chat box in chat interface:

- `:help`: view available commands
- `:back`: back to chat menu for selecting chat
- `:reply`: reply mode to select and reply to messages
- `:upload`: upload media using the file navigator
- `:upload <path>`: upload media (photo or video) directly from path
- `:view <index>`: view and download media at index or open URL directly in browser
- `:emoji <name>`: coming soon!!
