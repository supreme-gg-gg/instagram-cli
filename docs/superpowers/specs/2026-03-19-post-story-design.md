# Design: `instagram-cli post story`

**Date:** 2026-03-19
**Status:** Approved
**Author:** ohm (via Claude Code brainstorming session)

---

## Overview

Add a new `post story` command to instagram-cli that lets users post image or video stories to Instagram directly from the terminal. The command presents a 3-screen TUI: a file browser to pick the asset, an options screen to choose audience, and a confirmation screen before posting.

**Motivation:** Enable a single-source workflow where assets built locally (for projects, designs, etc.) can be distributed to Instagram Stories without leaving the terminal.

---

## Command Signature

```
instagram-cli post story [<username>]
```

- Account username is a positional argument (consistent with `feed.tsx`, `stories.tsx`, and `useInstagramClient` hook which reads `args[0]`)
- File selection is handled entirely in the TUI file browser — no `--file` flag
- Pastel auto-routes `source/commands/post/story.tsx` to `instagram-cli post story`

### Zod Schema Exports

```typescript
import { argument } from 'pastel';

export const args = zod.tuple([
  zod
    .string()
    .optional()
    .describe(
      argument({
        name: 'username',
        description: 'Instagram account username (uses current session if omitted)',
      }),
    ),
]);

// No flags in v1; Pastel requires this export even when empty
export const options = zod.object({});
```

---

## Files

| File | Type | Purpose |
|---|---|---|
| `source/commands/post/story.tsx` | New | Command entry point; session init via `useInstagramClient(args[0], { realtime: false })`, renders `PostStoryView` |
| `source/ui/views/post-story-view.tsx` | New | 3-screen TUI state machine |
| `source/ui/components/file-browser.tsx` | New | Reusable filesystem navigation component |
| `source/client.ts` | Modified | Add `postStory()` method |

---

## TUI State Machine

```
browsing → (file selected) → options → (confirmed) → confirm → (post pressed) → posting → result
    ↑                            |                       |                          |
    └────────── back ────────────┘                       └────── back ──────────────┘
                                                                                    |
                                                                     (on error: back to confirm)
```

States: `'browsing' | 'options' | 'confirm' | 'posting' | 'result'`

Retry on error goes back to `confirm` (not re-posts automatically — user re-confirms intent before retrying).

### Screen 1 — File Browser (`browsing`)

- **Initial directory:** `process.cwd()`
- Header: current directory path
- List: directories first (sorted alphabetically), then `.jpg` / `.jpeg` / `.png` / `.mp4` files (hidden files excluded, case-insensitive extension match)
- Directory entries shown with trailing `/`; files shown with their size (e.g., `2.4 MB`)
- Navigation:
  - `j` / `↓` — move down
  - `k` / `↑` — move up
  - `Enter` on directory — drill into it
  - `Backspace` / `h` / `←` — go up one level
  - `Enter` on file — select file, advance to `options`
  - `q` / `Ctrl+C` — quit
- Empty directory (no compatible files or subdirs): show `No compatible files found in this directory.`
- Directory reads use `fs.promises.readdir` inside a `useEffect` (non-blocking; list shows a spinner while loading)

### Screen 2 — Options (`options`)

- Single control: audience toggle
  - `Everyone` (default) ↔ `Close Friends`
  - `Tab` or `←` / `→` to switch
- `Enter` — confirm, advance to `confirm`
- `Escape` / `b` — go back to `browsing`

### Screen 3 — Confirmation (`confirm`)

- Displays:
  - Selected file path (basename only)
  - Media type: `image` or `video`
  - Audience: `Everyone` or `Close Friends`
  - Thumbnail preview (rendered via existing `image.protocol` config — silently skipped if unsupported)
  - Format note (images and videos): `Note: ensure your file meets Instagram's format requirements (image: JPG/PNG, video: H.264 MP4 ≤ 60s).`
- `Enter` — begin posting, advance to `posting`
- `Escape` / `b` — go back to `options`

### Posting State (`posting`)

- Spinner with label: `Posting story…`
- No keyboard input accepted

### Result State (`result`)

- **Success:** green `Story posted successfully!` message; press any key to exit. Uses `useApp().exit()` from Ink to quit cleanly.
- **Error:** red error message with the error string from the thrown exception; `[r] retry` returns to `confirm`, `[q] quit` calls `useApp().exit()`.

---

## `InstagramClient.postStory()`

```typescript
public async postStory(
  filePath: string,
  options?: { closeFriends?: boolean }
): Promise<void>
```

**Implementation:**

1. Read file into `Buffer` with `fs.promises.readFile(filePath)`
2. Detect media type by extension (case-insensitive):
   - `.mp4` → video
   - `.jpg`, `.jpeg`, `.png` (all others) → image
3. For images:
   ```typescript
   await this.ig.publish.story({ file: buffer });
   ```
4. For videos — `instagram-private-api` requires a separate `coverImage` (JPEG buffer). In v1, use a 1×1 black JPEG placeholder as the cover image (avoids an `ffmpeg` dependency). The confirmation screen displays the format note so the user is aware.
   ```typescript
   // Minimal valid 1×1 black JPEG (hardcoded; generated once with sharp)
   const BLACK_1X1_JPEG = Buffer.from(
     '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
     'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIA' +
     'AhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAU' +
     'AQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A' +
     'JQAB/9k=',
     'base64',
   );
   await this.ig.publish.story({ video: buffer, coverImage: BLACK_1X1_JPEG });
   ```
5. Close friends: pass `audienceType: 'besties'` in publish options. **Verify exact option name against `instagram-private-api` `StoryVideoOptions` / `StoryPhotoOptions` source before implementing** — this is the primary unknown.
6. Log errors via `createContextualLogger('postStory')`
7. Throw on failure — the TUI result screen handles display

---

## `FileBrowser` Component

```typescript
type FileBrowserProps = {
  initialPath?: string; // defaults to process.cwd()
  onSelect: (filePath: string) => void;
  onExit: () => void;
};
```

- `useEffect` reads directory with `fs.promises.readdir(..., { withFileTypes: true })`
- Filters: `Dirent.isDirectory()` OR filename matching `/\.(jpg|jpeg|png|mp4)$/i`
- Sorts: directories first, then files, both groups alphabetically
- State: `currentPath`, `entries`, `selectedIndex`, `isLoading`
- Keyboard handling via Ink's `useInput`

---

## Supported Formats

| Type | Extensions |
|---|---|
| Image | `.jpg`, `.jpeg`, `.png` |
| Video | `.mp4` |

`.mov` excluded entirely from both the file browser filter and `postStory()` detection in v1 (Instagram private API acceptance is inconsistent; can be added in a follow-up PR).

---

## Error Cases

| Case | Handling |
|---|---|
| Not logged in | Caught at session init in command entry, shows `Alert variant="error"` (standard pattern) |
| File not readable | `postStory()` throws; shown in result error screen |
| API error (rate limit, checkpoint, etc.) | `postStory()` throws; shown in result error screen |
| Unsupported format slips through | API rejects; error shown in result error screen |
| Empty directory | `FileBrowser` shows "No compatible files found in this directory." |
| Directory read fails | `FileBrowser` shows error inline, allows navigating back up |

---

## Known Unknowns (resolve during implementation)

1. **Close friends option name** — verify `audienceType: 'besties'` against `instagram-private-api` `StoryPhotoOptions` / `StoryVideoOptions` types before implementing
2. **Video cover image** — confirm Instagram accepts the 1×1 black JPEG placeholder without rejecting the upload; if not, document the limitation and disable video posting in v1

---

## Out of Scope (v1)

- Music / audio stickers
- Text stickers / captions overlaid on the story
- Link stickers
- Post to feed
- Scheduling
- Video transcoding / format conversion
- `.mov` support
- `ffmpeg`-based cover frame extraction for videos
