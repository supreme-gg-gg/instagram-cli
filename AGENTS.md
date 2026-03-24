# AI Coding Assistant Context

This documentation provides context for AI coding tools like VSCode, Cursor, Gemini CLI, Claude Code, etc.

## Project Overview

- Instagram CLI implemented in TypeScript with Pastel (CLI scaffolding), Ink (React TUI), and Instagram Private API + MQTT for backend interactions.
- Primary work happens in `source/`, tests are contained in `tests/`.
- Old Python version lives under `instagram-py/`, work on typescript client unless the user specifies otherwise.

## Build & Test Commands

- Install: `npm ci`
- Development: `npm run dev`
- Build: `npm run build`
- Run CLI: `npm run start -- <command>`
- Tests: `npm test`

## Code Style & Implementation Guidelines

- Pastel command contract: export `args` (zod tuple) and a default React component; render full-screen UIs inside `<AltScreen>`; use `useInstagramClient` to fetch authenticated clients.
- Maintain `ClientContext` boundaries, inject dependencies into hooks (`useStories`, etc.) for testability, and call `InstagramClient.shutdown()` when tearing down realtime sessions.
- Keep ESM imports with explicit `.js` extensions; mirror existing logging setup via `initializeLogger()` and `createContextualLogger`.
- API work lives in `source/client.ts` plus helpers like `utils/message-parser.ts`; extend these surfaces rather than scattering raw API calls.
- Place stateless Ink pieces in `ui/components`, orchestration in `ui/views`, and derived state in `ui/hooks`; reuse existing visual patterns (gradients, status bars) for consistency.
- When working with existing components and systems, first check their design description in `docs/`
- Use linter exceptions (`eslint-disable-next-line`) sparingly; prefer fixing the underlying issue. If a disable is unavoidable, scope it to the narrowest region (single line when possible) and add a brief justification.

## Testing Instructions

- Ink smoke tests reside in `tests/` using Ava + `ink-testing-library`; update or extend them when view output changes.
- When pre-commit hooks are unavailable, run `npm run format`, `npm run lint-check`, and `npm test` locally before submitting work.
- Prefer mock runs (`npm run start:mock -- --chat|--feed|--story`) during UI work; update `source/mocks/mock-data.ts` if expectations shift.
- **TUI testing quirks:** Ink renders to a string buffer, not a real terminal. Use `render()` from `ink-testing-library` and assert against `lastFrame()` output. For visual elements like unread indicators or selection highlights, check for the expected Unicode/ANSI characters in the frame string (e.g., `t.truthy(output?.includes('●'))`).
- **What to test:** Component rendering with mock data, keyboard input handling (`stdin.write()`), edge cases like empty states and Unicode text. Do not test Instagram API calls directly — mock the client.

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

## Security Considerations

- Avoid committing real credentials or session artefacts; all secrets should flow through `ConfigManager`/`SessionManager` paths.
- Respect rate limits by using mocks for iterative UI work and keeping realtime connections (`InstagramClient.initializeRealtime`) scoped to active sessions.
- Leave the logger initialisation and debug redirection intact to capture API diagnostics without leaking to stdout. Logs are available in `.instagram-cli/logs`, ask the user to provide them if troubleshooting is needed.
