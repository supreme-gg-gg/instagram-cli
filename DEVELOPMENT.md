# Development

FAQ: Why are there two different codebases for TypeScript and Python? This has to do with our history! At first, the project was built in pure python with curses, a python binding for ncurses in C commonly used for UNIX terminal UI apps. However, as the project grew, we found that developing with Typescript gave us several advantages such as React-based UI with Ink (better DX and modern outlook), and better API library that supports MQTT protocol.

## TypeScript Development

### Getting Started

If you do not have Node.js installed, you can download and install it from the [official website](https://nodejs.org/). We recommend using Node.js version 20 or above. We recommend using `nvm` to manage your Node.js versions, see [nvm-sh/nvm](https://github.com/nvm-sh/nvm).

To get started, you need to install the dependencies:

```bash
npm ci
```

We are using `lint-staged` and `husky` for pre-commit hooks to ensure code quality for TypeScript. They are setup automatically when you run `npm ci`. They will run `prettier` and `xo` on staged files before each commit.

If linter and formatter is not run automatically, you can run it manually with:

```bash
npm run format # only runs prettier
npm run lint-check # you should ALWAYS run this before committing if it's not automatic
```

### Development Install

```bash
npm run build
```

To run the CLI:

```bash
npm run start -- <command>
```

Basically replace `instagram-cli` with `npm run start`, for example:

```bash
npm run start -- auth login # = instagram-cli auth login
npm run start -- chat --username some_username # = instagram-cli chat --username some_username
```

### Using mocks

To avoid exhausting Instagram's API calls during development, you can use the mock system to test your UI changes. This would not work if you are changing API-related code, but for pure UI changes this is very useful.

```bash
npm run start:mock -- --chat | --feed | --story
```

Similarly, you should update the mock data when making changes to relevant client endpoints.

### Debugging APIs

Refer to [this document](docs/api-debugging.md) for several utilities that can help with your development.

### Install

This will link the `instagram-cli` executable to your global `node_modules`, so you can run `instagram-cli` from anywhere. If you have it installed from NPM, this will override it.

```bash
npm link
```

### Testing

Unit tests are not required. But if you're adding new commands that render terminal UI (views), please add basic tests to ensure they run without errors in `tests`. These are run using `ava` during CI.

### Notes

#### Pastel

- We use [pastel](https://github.com/vadimdemedes/pastel) for building CLI commands
- `pastel` supports `tsx` for each commands, so you can just render UI directly in there
- Read pastel docs for how to group commands, how to use `zod`, etc.

### Ink

- We use [ink](https://github.com/vadimdemedes/ink) for building UI
- We use existing `@inkjs/ui` components for UI such as alert, text input, loading, etc.

### Other libraries

We use `ink-picture` and `wax` for image rendering and routing. They are developed in-house but are open-source as well. For those issues, you can open issues in their respective repositories.

### Structure

```plaintext
source/
├── cli.ts              # Main CLI entry point (meow)
├── client.ts           # Unified Instagram API client (all IG logic)
├── config.ts           # YAML-based config management
├── session.ts          # Session serialization and management
│
├── commands/           # Each CLI command in its own file
│   ├── auth/           # Subcommands grouped in folders
│   │   ├── login.tsx
│   │   └── logout.tsx
│   ├── chat.tsx
│   ├── config.tsx
│   ├── notify.tsx
│   ├── stats.tsx
│   └── ...
│
├── ui/
│   ├── components/     # Stateless, reusable Ink components (MessageList, InputBox, etc.)
│   ├── views/          # Top-level stateful views (ChatView, ThreadListView, etc.)
│   ├── hooks/          # Custom React hooks (useClient, useThreads, etc.)
│   └── context/        # React context providers (ClientContext)
│
└── types/              # All TypeScript type definitions
    ├── instagram.ts
    └── ui.ts
```

## Python Development

**You need to cd into the `instagram-py` directory for Python client development:**

```bash
cd instagram-py
```

We have migrated to `uv` for managing Python versions and virtual environments. Refer to [astral-sh/uv](https://github.com/astral-sh/uv) for installation instructions. The simplest way is to install using `pip install uv` but you may prefer other installation methods.

Create a virtual environment to isolate your dependencies:

```bash
uv venv .venv
uv sync
source .venv/bin/activate
```

This installs all deps (including dev, you can use `--no-dev` flag to skip those) and builds the package in editable mode.

You can then run the CLI using:

```bash
uv run instagram <command>
```

### Manual Code Quality Checks

We have removed automatic pre-commit hooks for Python code. Please run the following commands manually to ensure code quality before committing your changes.

```bash
uv ruff check .
uv ruff format .
```

### Tests

Basics tests are in `instagram-py/tests`. Run them using:

```bash
uv run pytest tests/
```
