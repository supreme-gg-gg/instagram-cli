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

#### Message List Scrolling

The message list uses a `ScrollView` component that provides smooth, viewport-relative scrolling with automatic content measurement.

- **Available Space**: `terminal_height - 8` (status bar + input box + help + padding)
- **Scrolling Behavior**:
  - `:j` / `:k` commands scroll by 75% of viewport height
  - `:J` jumps to the bottom (newest messages)
  - `:K` jumps to the top (oldest loaded messages)
  - Automatically scrolls to bottom when entering a chat or sending a message
  - Infinite scroll: Loading older messages when scrolling to the top
- **Content Rendering**: All messages are rendered; `ScrollView` handles viewport clipping
- **Mouse Support**: Planned for future implementation to enable scroll wheel navigation

**Technical Implementation:**

- `ScrollView` component manages scroll offset using negative margins
- `useContentSize` hook polls at 60fps to measure total content dimensions
- Scroll position is controlled programmatically via ref methods
- `onScrollToStart` callback triggers loading of older messages from the API

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
	messageCursor?: string; // Cursor for loading older messages

	// UI state machine
	uiMode: 'normal' | 'reply' | 'unsend' | 'selecting';
	selectedMessageIndex?: number;
	isSelectionMode: boolean;

	// Loading states
	loading: boolean;
	error?: string;
}
```

**Note:** The `visibleMessageOffset` property has been removed as scrolling is now managed internally by the `ScrollView` component.

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

- Renders all messages in a simple flex column layout
- No longer manages windowing or pagination internally
- Wrapped by `ScrollView` component which handles viewport clipping
- Shows message content, reactions, and selection highlights

#### ScrollView

- Reusable scrolling container component
- Supports both vertical and horizontal scrolling
- Uses negative margins to shift content within a clipped viewport
- Provides imperative API via ref:
  - `scrollTo(offset)`: Scroll to specific position
  - `scrollToStart()`: Jump to beginning
  - `scrollToEnd()`: Jump to end
- Automatically measures content size using `useContentSize` hook
- Triggers callbacks when reaching boundaries (`onScrollToStart`, `onScrollToEnd`)

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
:j/:k pressed → call scrollViewRef.scrollTo() →
scroll by 75% of viewport height →
if at top boundary, trigger onScrollToStart →
load older messages from API →
re-render with new messages

:J/:K pressed → call scrollToEnd()/scrollToStart() →
jump to bottom/top of content →
update scroll offset immediately (doesn't fetch more messages)
```

**Auto-scroll Behaviors:**

- When entering a chat: Automatically scrolls to bottom (newest messages)
- After sending a message: Automatically scrolls to bottom to show sent message

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
2. **ScrollView Abstraction**: Centralized scrolling logic with imperative control
3. **Content-based Rendering**: All items rendered; viewport manages visibility
4. **Input Consumption**: Always clear input after processing
5. **Clean Transitions**: Complete view replacement, not stacking
6. **Bounds Checking**: Navigation never goes out of bounds
7. **Responsive Layout**: Adapt to terminal size changes

## Error Handling

- **Network errors**: Show in status bar, don't break UI
- **Invalid commands**: Show error message, clear input
- **Loading states**: Show spinner, prevent input
- **Empty states**: Show appropriate messages

## Performance Considerations

- **Lazy loading**: Only load messages when needed (infinite scroll)
- **Efficient content measurement**: Polls at 60fps using Yoga layout engine
- **Viewport clipping**: Only visible content affects rendering performance
- **Debounced input**: Prevent excessive re-renders
- **Efficient updates**: Use React's reconciliation properly

## Future Enhancements

- **Mouse Support**: Enable scroll wheel navigation for message history
- **Bounds Checking**: Prevent navigation beyond available messages
