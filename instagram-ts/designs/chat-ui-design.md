# Chat UI Design Document

## Overview

This document describes the design and behavior of the Instagram CLI chat interface, addressing the core issues of pagination, view management, and input handling.

## Core Issues to Solve

1. **Pagination**: Never show more items than can fit on screen
2. **View Transitions**: Proper window management between thread list and chat view
3. **Command Consumption**: Clear input after command execution
4. **Navigation**: Proper bounds checking and scrolling

## UI Architecture

### 1. View Management

The chat UI operates in two distinct views that never overlap:

```
┌─────────────────────────────────────┐
│ Status Bar (current view, username) │
├─────────────────────────────────────┤
│                                     │
│  THREAD LIST VIEW                   │
│  ┌─────────────────────────────────┐ │
│  │ Thread 1 [selected]             │ │
│  │ Thread 2                        │ │
│  │ Thread 3                        │ │
│  │ ...                             │ │
│  │ 1-10 of 50 threads              │ │
│  └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ Help: j/k navigate, Enter select    │
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│ Status Bar (chat view, thread name) │
├─────────────────────────────────────┤
│                                     │
│  CHAT VIEW                          │
│  ┌─────────────────────────────────┐ │
│  │ [Message 1]                     │ │
│  │ [Message 2]                     │ │
│  │ [Message 3]                     │ │
│  │ ...                             │ │
│  │ 1-15 of 100 messages            │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │ Message: [input field]          │ │
│  └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Help: Esc back, j/k scroll          │
└─────────────────────────────────────┘
```

### 2. Pagination Design

#### Thread List Pagination

- **Available Space**: `terminal_height - 4` (status bar + help + padding)
- **Window Size**: Dynamic based on available space
- **Navigation**:
  - `j/k` or arrow keys move selection
  - Selection stays within visible window
  - Window scrolls to keep selection visible
  - Never show more threads than fit on screen

#### Message List Pagination

- **Available Space**: `terminal_height - 6` (status bar + input box + help + padding)
- **Window Size**: Dynamic based on available space
- **Navigation**:
  - `j/k` scroll through message history
  - `scrollOffset` tracks current window position
  - Load older messages when scrolling up
  - Never show more messages than fit on screen

### 3. View Transitions

#### Thread List → Chat View

1. User selects thread with Enter
2. **Clear screen**: Remove thread list completely
3. **Load messages**: Fetch messages for selected thread
4. **Reset state**: Clear message scroll offset, reset UI mode
5. **Render chat view**: Show messages and input box

#### Chat View → Thread List

1. User presses Escape or `:back` command
2. **Clear screen**: Remove chat view completely
3. **Reset state**: Clear current thread, messages, scroll offset
4. **Render thread list**: Show threads again

### 4. Input Management

#### Command Input

1. User types `:command` in input box
2. Command is parsed and executed
3. **Input is cleared** (consumed)
4. System message shows command result
5. Input box is ready for next input

#### Message Input

1. User types message in input box
2. Message is sent to Instagram
3. **Input is cleared** (consumed)
4. Message appears in chat
5. Input box is ready for next message

#### Navigation Input

- **Thread List**: `j/k` move selection, `Enter` select thread
- **Chat View**: `j/k` scroll messages, `Esc` go back
- **Input Box**: Handles text input, passes navigation to parent when not typing

## Implementation Details

### State Management

```typescript
interface ChatUIState {
	// View state
	currentView: 'threads' | 'chat';

	// Thread list state
	threads: Thread[];
	selectedThreadIndex: number;
	threadWindowStart: number;
	threadWindowSize: number;

	// Chat state
	currentThread?: Thread;
	messages: Message[];
	messageScrollOffset: number;
	messageWindowSize: number;

	// UI state machine
	uiMode: 'normal' | 'reply' | 'unsend' | 'selecting';

	// Loading states
	loading: boolean;
	error?: string;
}
```

### Component Responsibilities

#### ChatView (Main Controller)

- Manages view transitions
- Handles global navigation (Escape, Ctrl+C)
- Coordinates between ThreadList and MessageList
- Manages state machine for UI modes

#### ThreadList

- Renders visible threads based on window
- Handles thread selection navigation
- Shows pagination info
- Never renders more than `threadWindowSize` items

#### MessageList

- Renders visible messages based on scroll offset
- Handles message scrolling
- Shows pagination info
- Never renders more than `messageWindowSize` items

#### InputBox

- Handles text input for messages and commands
- Clears input after submission
- Passes navigation events to parent when not typing
- Manages typing state to prevent navigation conflicts

### Navigation Flow

#### Thread List Navigation

```
j/k pressed → update selectedThreadIndex →
check if selection is in window →
if not, update threadWindowStart →
re-render with new window
```

#### Chat Navigation

```
j/k pressed → update messageScrollOffset →
check if at top/bottom →
if at top, load older messages →
re-render with new messages
```

#### View Transitions

```
Enter in thread list →
clear thread list →
load messages →
render chat view

Escape in chat →
clear chat view →
reset state →
render thread list
```

## Key Principles

1. **Single Source of Truth**: All state managed in ChatView
2. **Windowed Rendering**: Never render more items than fit on screen
3. **Input Consumption**: Always clear input after processing
4. **Clean Transitions**: Complete view replacement, not stacking
5. **Bounds Checking**: Navigation never goes out of bounds
6. **Responsive Layout**: Adapt to terminal size changes

## Error Handling

- **Network errors**: Show in status bar, don't break UI
- **Invalid commands**: Show error message, clear input
- **Loading states**: Show spinner, prevent input
- **Empty states**: Show appropriate messages

## Performance Considerations

- **Lazy loading**: Only load messages when needed
- **Windowed rendering**: Only render visible items
- **Debounced input**: Prevent excessive re-renders
- **Efficient updates**: Use React's reconciliation properly
