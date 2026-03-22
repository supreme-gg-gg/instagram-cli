# AGENTS.md — AI Coding Assistant Context

Context for AI coding tools (Claude Code, Cursor, Gemini CLI, etc.) working on this codebase.

## Project Overview

- Instagram CLI in TypeScript: [Pastel](https://github.com/vadimdemedes/pastel) (CLI scaffolding), [Ink](https://github.com/vadimdemedes/ink) (React TUI), [instagram-private-api](https://github.com/dilame/instagram-private-api) + [instagram_mqtt](https://github.com/Nerixyz/instagram_mqtt) for backend interactions.
- Primary work in `source/`, tests in `tests/`.
- Old Python version in `instagram-py/` — work on TypeScript unless told otherwise.

## Build & Test Commands

| Command                                         | Purpose                           |
| ----------------------------------------------- | --------------------------------- |
| `npm ci`                                        | Install dependencies              |
| `npm run dev`                                   | Development build                 |
| `npm run build`                                 | Production build                  |
| `npm run start -- <command>`                    | Run CLI                           |
| `npm test`                                      | Format check + lint + all tests   |
| `npm run format`                                | Prettier write                    |
| `npm run lint-check`                            | Prettier check + XO lint          |
| `npm run start:mock -- --chat\|--feed\|--story` | Run with mock data (no API calls) |

## Code Style & Implementation Guidelines

- **Pastel command contract:** export `args` (zod tuple) and a default React component. Full-screen UIs go inside `<AltScreen>`. Use `useInstagramClient` for authenticated clients.
- **ClientContext boundaries:** inject dependencies into hooks (`useStories`, etc.) for testability. Call `InstagramClient.shutdown()` on teardown.
- **ESM imports** with explicit `.js` extensions.
- **Logging:** `initializeLogger()` + `createContextualLogger`. Never use bare `console.log` — use the logger.
- **API surface:** work in `source/client.ts` + `source/utils/`. Extend these surfaces rather than scattering raw API calls.
- **UI architecture:** stateless pieces in `ui/components`, orchestration in `ui/views`, derived state in `ui/hooks`. Reuse existing visual patterns (gradients, status bars).
- **Design docs:** check `docs/` for component and system design descriptions before modifying.
- **Linter exceptions:** use `eslint-disable-next-line` sparingly, scoped to a single line, with a brief justification. Prefer fixing the underlying issue.

## Testing Guide

### Framework

- **AVA** v5.3.1 as test runner
- **ink-testing-library** v4.0.0 for TUI component tests
- Test files live in `tests/`
- AVA config note: `workerThreads: false` is required for tests using `useInput`

### What to Test

- New commands and their argument parsing
- UI views and component rendering
- Utility functions and text processing
- Input handling (keyboard, mouse events)

### What NOT to Test

- Internal React state (test rendered output instead)
- Mock data shape validation
- Third-party library internals

### TUI Component Testing

`render()` from ink-testing-library returns `{lastFrame, stdin}`:

```ts
import {render} from 'ink-testing-library';
const {lastFrame, stdin} = render(<MyComponent />);
```

**ANSI code verification:** enable `chalk.level = 3` in tests, then match escape codes directly:

- `\u001B[7m` — inverse/highlight
- `\u001B[27m` — reset inverse
- Check for these in `lastFrame()` output to verify visual states

**Mouse event testing:** two formats:

- SGR: `ESC [ < button ; col ; row M`
- X11: `ESC [ M <encoded bytes>`

**Serial tests:** use `test.serial` for tests touching singletons (`ConfigManager`, `SessionManager`) to avoid race conditions.

### Mock System

Use mocks for iterative UI work — no real API calls needed:

```bash
npm run start:mock -- --chat    # mock chat view
npm run start:mock -- --feed    # mock feed view
npm run start:mock -- --story   # mock story view
```

Update `source/mocks/mock-data.ts` if test expectations change.

## Verification Guide

**Always visually inspect UI changes before submitting.** The mock system exists for this.

1. Run the relevant mock command (`--chat`, `--feed`, `--story`)
2. Check edge cases: long text, emoji, RTL text, empty states
3. Test in different terminal sizes (resize your terminal)
4. If possible, check behavior in multiple terminal emulators
5. **Include screenshots or GIFs in PR descriptions for any visual changes**

## Pre-PR Checklist

Run these in order before raising a PR:

1. `npm run format` — fix formatting (Prettier)
2. `npm run lint-check` — verify lint passes (Prettier + XO)
3. `npm test` — all tests must pass (currently 105+)
4. Visual inspection with mock system for UI changes
5. Screenshots/GIFs in PR description for visual changes
6. Check for accidental `console.log` — use `createContextualLogger` instead

## AI Self-Identification

Maintainers need to know when a PR is AI-assisted so they can calibrate review depth.

- **Commit trailer:** include `Co-Authored-By: <AI Model> <noreply@anthropic.com>` (or equivalent) in commit messages
- **PR description:** note AI assistance if the PR was substantially generated by an AI tool
- This helps identify patterns in AI-generated contributions and adjust review accordingly

## Security Considerations

- **Never commit credentials or session artifacts.** All secrets flow through `ConfigManager`/`SessionManager`.
- Use mocks for iterative work. Respect rate limits.
- Keep `InstagramClient.initializeRealtime` scoped to active sessions.
- Leave logger initialization and debug redirection intact — logs go to `.instagram-cli/logs`, not stdout.

## External Documentation

| Dependency                       | Link                                                |
| -------------------------------- | --------------------------------------------------- |
| Ink (React for CLI)              | https://github.com/vadimdemedes/ink                 |
| Pastel (CLI framework)           | https://github.com/vadimdemedes/pastel              |
| @inkjs/ui (components)           | https://github.com/vadimdemedes/ink-ui              |
| ink-picture (images in terminal) | https://github.com/endernoke/ink-picture            |
| instagram-private-api            | https://github.com/dilame/instagram-private-api     |
| instagram_mqtt                   | https://github.com/Nerixyz/instagram_mqtt           |
| AVA (test runner)                | https://github.com/avajs/ava                        |
| ink-testing-library              | https://github.com/vadimdemedes/ink-testing-library |
| XO (linter)                      | https://github.com/xojs/xo                          |
| Fuse.js (fuzzy search)           | https://www.fusejs.io/                              |
| Zod (schema validation)          | https://zod.dev/                                    |

> **Note:** The project patches `instagram-private-api` via `patch-package` — see `patches/` for active patches.
