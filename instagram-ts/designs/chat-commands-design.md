# Chat Commands System

## Overview

Interactive command system for message operations with visual selection. Commands are prefixed with `:` and processed by `parseAndDispatchChatCommand()`.

## State Management

### ChatState Properties

```typescript
interface ChatState {
	selectedMessageIndex: number | null; // 0-based index in messages array
	isSelectionMode: boolean; // UI selection mode active
	// ... other properties
}
```

### State Flow

1. **Selection**: `:select` → `isSelectionMode: true`, `selectedMessageIndex: lastMessage`
2. **Navigation**: `j`/`k` keys update `selectedMessageIndex`
3. **Confirmation**: `Enter` → `isSelectionMode: false` (preserves `selectedMessageIndex`)
4. **Execution**: Commands check `selectedMessageIndex !== null`
5. **Cleanup**: Commands clear `selectedMessageIndex` after execution

## Available Commands

| Command          | Description                  | Selection Required |
| ---------------- | ---------------------------- | ------------------ |
| `:help`          | Show available commands      | No                 |
| `:select`        | Enter message selection mode | No                 |
| `:react [emoji]` | React to selected message    | Yes                |
| `:unsend`        | Delete selected message      | Yes                |
| `:upload <path>` | Upload file to thread        | No                 |
| `:k`             | Scroll up messages           | No                 |
| `:j`             | Scroll down messages         | No                 |

## Selection Logic

### UI Behavior

- **Selection Mode**: Input disabled, shows "Selection mode active - use j/k to navigate, Esc to exit"
- **Visual Feedback**: Selected message highlighted with yellow border
- **Navigation**: `j` (down), `k` (up), `Enter` (confirm), `Esc` (cancel)

### Command Execution

- Commands check `chatState.selectedMessageIndex !== null`
- Target message: `chatState.messages[selectedMessageIndex]`
- After execution: `selectedMessageIndex` cleared to `null`

### Key Bindings

- **Normal Mode**: `Esc` → back to threads, `Ctrl+C` → quit
- **Selection Mode**: `j`/`k` → navigate, `Enter` → confirm, `Esc` → cancel
