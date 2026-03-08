# Mouse Support Design

## Overview

Ink has zero built-in mouse support — no `onClick`, no `elementFromPoint()`, no hit-testing API. The framework is keyboard-only by design. This document describes the custom mouse system built on top of raw ANSI escape sequences and Yoga layout measurement.

## Architecture

### Input Pipeline

```
Terminal (stdin)
  → MouseProvider (ANSI parser)
    → useMouse() subscribers (priority-ordered)
      → Component handlers (ScrollView, InputBox, ThreadList)
```

### Key Files

| File                                  | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `source/utils/mouse.ts`               | Low-level ANSI mouse protocol parser (SGR + X11 formats)         |
| `source/ui/context/mouse-context.tsx` | `MouseProvider` context and `useMouse()` hook                    |
| `source/ui/hooks/use-content-size.ts` | Layout utilities: `measureAbsoluteLayout`, `findChildAtPosition` |

## Layout Utilities

All layout utilities live in `source/ui/hooks/use-content-size.ts`.

### `measureAbsoluteLayout(node)`

Computes the absolute screen position and size of an Ink DOM element by walking up the parent chain, summing each Yoga node's `getComputedLeft()` / `getComputedTop()`. Returns `{ x, y, width, height }` in 0-based terminal coordinates.

Used to convert raw mouse coordinates (which are screen-absolute) into coordinates relative to a specific component.

### `findChildAtPosition(node, x, y)`

Given a container node and a point relative to that container, returns the index of the direct child whose layout rect contains the point, or `-1` if none match.

**Auto-descend behavior:** Automatically walks through single-child wrapper nodes (adjusting coordinates at each level) until it reaches a node with multiple children. This means callers don't need to know about intermediate wrapper `<Box>` nodes — e.g., MessageList has 2 wrapper boxes before the actual message items, but `findChildAtPosition` handles this transparently.

## How Components Handle Mouse Events

Each component owns its own mouse interaction via `useMouse()`. There is no centralized mouse dispatcher in the view layer — components self-manage.

### ScrollView

**Props:** `mouseScrollLines`, `onChildClick`

Handles two concerns internally:

- **Scroll wheel**: When `mouseScrollLines` is set, `scroll-up` / `scroll-down` events adjust the scroll offset by that many lines.
- **Child click**: When `onChildClick` is set, `left-press` events use `measureAbsoluteLayout` on the inner container to get container-relative coordinates, then `findChildAtPosition` to identify which child was clicked. The container's absolute layout automatically accounts for the scroll offset (because scrolling is implemented via negative margin on the container node).

```tsx
<ScrollView
  mouseScrollLines={3}
  onChildClick={(index) => handleMessageClick(index)}
>
  <MessageList ... />
</ScrollView>
```

### InputBox

Handles click-to-cursor internally. On `left-press`:

1. Measures its own layout with `measureAbsoluteLayout`
2. Checks if the click Y matches the text row (box Y + 1, accounting for border)
3. Computes cursor offset from click X relative to text start (box X + 2, accounting for border + padding)
4. Sets internal `cursorOffset` state, which propagates to TextInput

No external props or refs needed — InputBox is fully self-contained.

### ThreadList

Handles click-to-select directly. On `left-press`:

1. Uses `measureAbsoluteLayout` + `findChildAtPosition` on its container ref
2. Adds `scrollOffset` to the visible index (ThreadList does its own virtual scrolling, only rendering the visible slice)
3. Selects and opens the clicked thread

## Coordinate Flow

All mouse events arrive with 1-based `col` / `row` values from the terminal. The standard conversion is:

```
clickX = event.col - 1   (to 0-based)
clickY = event.row - 1   (to 0-based)
```

To find what's under the click:

1. `measureAbsoluteLayout(container)` → absolute `{ x, y }` of the container
2. `relativeX = clickX - layout.x`, `relativeY = clickY - layout.y`
3. `findChildAtPosition(container, relativeX, relativeY)` → child index

For ScrollView, the container's negative margin (scroll offset) is already reflected in `measureAbsoluteLayout`, so no separate scroll offset adjustment is needed.

## Design Principles

1. **Components own their mouse behavior.** No parent-level coordinate math or state threading for mouse interactions.
2. **Reuse Yoga layout data.** All hit-testing uses the same Yoga nodes that Ink uses for rendering — no shadow layout or hardcoded offsets.
3. **`useMouse` priority system.** Handlers return `true` to consume an event, preventing lower-priority handlers from processing it. This avoids conflicts (e.g., ScrollView click vs InputBox click).
