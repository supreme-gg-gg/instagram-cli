---
name: instagram-skill
description: >
  How to use Instagram CLI to interact with Instagram from the command line on behalf of a user.
  Use this skill whenever the user wants to send or read Instagram messages, check their inbox,
  reply to or unsend messages, or automate any Instagram DM workflow via the CLI. This includes
  tasks phrased as "message X on Instagram", "check my Instagram DMs", "send a photo to my friend",
  "read my unread Instagram threads", or any automation / scripting involving Instagram direct messages.
---

# Instagram CLI — Agent Usage Guide

Instagram CLI (`instagram-cli`) is a terminal client for Instagram. For agents, it exposes
**one-turn commands** that print to stdout and exit — perfect for scripting and tool-use.

> All one-turn commands require the user to already be logged in (`instagram-cli auth login`).
> If a command returns an auth error, prompt the user to log in first. Do not attempt to login using the CLI by yourself.

---

## Thread Resolution

Every command that targets a thread accepts a `<thread>` argument resolved in this order:

1. **Thread ID** (20+ digit number like `340282366920938463...`) — direct, zero extra API calls
2. **Username** — exact Instagram username (e.g. `johndoe`)
3. **Thread title** — fuzzy search across inbox (e.g. `"Book Club"`)

**Best practice for multi-step workflows:** call `inbox --output json` first to get thread IDs,
then pass those IDs directly to subsequent commands. This avoids redundant search API calls and
is more reliable than username/title matching.

---

## JSON Output

All commands accept `-o json` / `--output json`. Responses follow this envelope:

```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "message" }
```

Always use `--output json` when you need to parse results programmatically.

---

## Commands

### List inbox

```bash
instagram-cli inbox [--limit <n>] [--output json]
```

Returns recent threads. Each thread includes: `id`, `title`, `users`, `lastMessage`, `lastActivity`, `unread`.

```bash
# Get 10 most recent threads as JSON
instagram-cli inbox --limit 10 --output json
```

### Search threads

```bash
instagram-cli inbox --search <query> [--limit <n>] [--output json]
```

Searches by both username and thread title, merging results by relevance score.

```bash
instagram-cli inbox --search "alice" --output json
```

### Send a message

```bash
instagram-cli send <thread> --text <message> [--output json]
instagram-cli send <thread> --file <path> [--type photo|video] [--output json]
```

`<thread>` is a thread ID, username, or title. `--text` and `--file` are mutually exclusive.
Media type is auto-detected from extension; use `--type` to override.

```bash
instagram-cli send johndoe --text "Hey, are you free tonight?"
instagram-cli send 340282366920938463123456789 --text "Got it!"
instagram-cli send "Book Club" --file ./photo.jpg --output json
```

### Read messages

```bash
instagram-cli read <thread> [--limit <n>] [--cursor <cursor>] [--mark-seen] [--output json]
```

Returns messages newest-first. Use `cursor` from the previous response to paginate older messages.
Pass `--mark-seen` to mark the thread as read after fetching.

```bash
instagram-cli read johndoe --limit 20 --output json
instagram-cli read 340282366920938463123456789 --mark-seen
```

Each message in JSON output includes: `id`, `itemType`, `text`, `userId`, `username`, `timestamp`, `isOutgoing`.

### Download media from a message

```bash
instagram-cli read <thread> --message-id <id> --download <path> [--output json]
```

Finds the message by ID (paginates up to `--max-pages`, default 10) and saves the media file.
The file extension is automatically inferred if not provided.

```bash
instagram-cli read johndoe --message-id 340282366... --download ./media
```

### Reply to a message

```bash
instagram-cli reply <thread> --message-id <id> --text <text> [--output json]
```

Sends a threaded reply to a specific message.

```bash
instagram-cli reply johndoe --message-id 340282366... --text "Totally agree!"
```

### Unsend a message

```bash
instagram-cli unsend <thread> --message-id <id> [--output json]
```

```bash
instagram-cli unsend johndoe --message-id 340282366...
```

---

## Multi-Account Support

All commands accept `-u <username>` / `--username <username>` to target a specific logged-in account.
Omitting it uses the default account set via `instagram-cli auth switch`.

```bash
instagram-cli inbox -u myworkaccount --output json
instagram-cli send johndoe --text "Hi" -u mypersonalaccount
```

---

## Typical Agent Workflow

```bash
# 1. Get inbox to find the right thread
INBOX=$(instagram-cli inbox --output json --limit 20)
# Parse "id" fields from INBOX to find the target thread

# 2. Read recent messages (use thread ID for speed)
THREAD_ID="340282366920938463..."
instagram-cli read "$THREAD_ID" --limit 10 --output json

# 3. Reply or send
instagram-cli send "$THREAD_ID" --text "On my way!" --output json

# 4. Mark as seen
instagram-cli read "$THREAD_ID" --mark-seen
```

---

## Error Handling

- **Auth errors** → user needs to run `instagram-cli auth login`
- **"No thread found matching"** → the username/title didn't resolve; try `inbox --search` first
- **`"ok": false`** in JSON output → the `error` field contains the reason
- Rate limits / network errors are surfaced as error messages; retry with backoff if needed
