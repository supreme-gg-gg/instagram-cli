# Development

The TypeScript Client is contained in the `instagram-ts` folder. For all of the following commands, you should first `cd` into the `instagram-ts` directory.

## Getting Started

To get started, you need to install the dependencies:

```bash
npm install
```

We no longer use `lint-staged` and `husky`. We have migrated to `pre-commit` for both Python and TypeScript. This happens automatically as you commit.

If linter and formatter is not run automatically, you can run it manually with:

```bash
npm run lint-check
npm run format # only runs prettier
```

## Development Install

```bash
npm run build
```

To run the CLI:

```bash
npm run start -- <command>
```

Basically replace `instagram` with `npm run start`, for example:

```bash
npm run start auth login
npm run start chat
```

## Install

> DO NOT DO THIS DURING DEV

```bash
npm install --global instagram-ts
```

## Notes

### Pastel

- We use `pastel` for building CLI commands
- `pastel` supports `tsx` for each commands, so you can just render UI directly in there
- Read pastel docs for how to group commands, how to use `zod`, etc.

## Ink

- We use `ink` for building UI
- We use existing `@inkjs/ui` components for UI such as alert, text input, loading, etc.

## Structure

```plaintext
instagram-ts/source/
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

Quick notes:

- Currently all API wrapper are contained in `client.ts`
- In the future in case this grows out of hand we will move them to separate files especially when we add realtime
- We hope to add testing at some point, will use the `ink-testing-library` for that
