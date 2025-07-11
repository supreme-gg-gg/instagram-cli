# Chat Commands Design: Typed State Machine Approach

## Overview

This document outlines the improved design for chat commands in the Instagram CLI TypeScript migration, using a typed state machine approach for better type safety, maintainability, and user experience.

## Problem Statement

The original Python implementation used event signals (e.g., `__REPLY__`, `__UNSEND__`) to communicate between commands and the UI. While simple, this approach has several limitations:

- **Not type-safe**: Magic strings are error-prone and hard to refactor
- **Not composable**: Difficult to coordinate multi-step UI flows
- **Poor developer experience**: Hard to understand the full UI state at a glance

## Proposed Solution: Typed State Machine

### Core Principles

1. **Type Safety**: All UI states and transitions are defined as TypeScript types
2. **Single Source of Truth**: UI state is managed centrally with explicit transitions
3. **Declarative**: Commands return typed actions, not imperative callbacks
4. **Testable**: All state transitions can be unit tested independently

### Architecture

#### 1. UI State Definition

```typescript
type ChatUIState =
	| {mode: 'normal'}
	| {mode: 'reply'; selectedMessageId?: string}
	| {mode: 'unsend'; selectedMessageId?: string}
	| {mode: 'selecting'; action: 'reply' | 'unsend'}
	| {mode: 'scrolling'; direction: 'up' | 'down'}
	| {mode: 'configuring'; field?: string; value?: string}
	| {mode: 'scheduling'; time?: string; message?: string};
```

#### 2. UI Actions

```typescript
type ChatUIAction =
	| {type: 'ENTER_REPLY_MODE'; messageId?: string}
	| {type: 'ENTER_UNSEND_MODE'; messageId?: string}
	| {type: 'ENTER_SELECTION_MODE'; action: 'reply' | 'unsend'}
	| {type: 'SELECT_MESSAGE'; messageId: string}
	| {type: 'EXIT_SPECIAL_MODE'}
	| {type: 'SCROLL_MESSAGES'; direction: 'up' | 'down'}
	| {type: 'SHOW_SYSTEM_MESSAGE'; text: string}
	| {type: 'UPDATE_CONFIG'; field: string; value: string};
```

#### 3. State Reducer

```typescript
function chatUIReducer(state: ChatUIState, action: ChatUIAction): ChatUIState {
	switch (action.type) {
		case 'ENTER_REPLY_MODE':
			return {mode: 'reply', selectedMessageId: action.messageId};

		case 'ENTER_UNSEND_MODE':
			return {mode: 'unsend', selectedMessageId: action.messageId};

		case 'ENTER_SELECTION_MODE':
			return {mode: 'selecting', action: action.action};

		case 'SELECT_MESSAGE':
			if (state.mode === 'selecting') {
				return {
					mode: state.action === 'reply' ? 'reply' : 'unsend',
					selectedMessageId: action.messageId,
				};
			}
			return state;

		case 'EXIT_SPECIAL_MODE':
			return {mode: 'normal'};

		case 'SCROLL_MESSAGES':
			return {mode: 'scrolling', direction: action.direction};

		default:
			return state;
	}
}
```

#### 4. Updated Command Interface

```typescript
interface ChatCommand {
	name: string;
	handler: (
		args: string[],
		ctx: ChatCommandContext,
	) => ChatUIAction | ChatUIAction[];
	help: string;
	usage: string;
	shorthand?: string;
}
```

#### 5. Command Context

```typescript
interface ChatCommandContext {
	client: InstagramClient;
	chatState: ChatState;
	dispatch: (action: ChatUIAction) => void;
	getCurrentUIState: () => ChatUIState;
}
```

## Implementation Examples

### Reply Command

```typescript
export const replyCommand: ChatCommand = {
	name: 'reply',
	handler: (args, ctx) => {
		const index = args[0];

		if (index) {
			const messageIndex = parseInt(index);
			if (
				isNaN(messageIndex) ||
				messageIndex < 0 ||
				messageIndex >= ctx.chatState.messages.length
			) {
				return {
					type: 'SHOW_SYSTEM_MESSAGE',
					text: `Error: Invalid message index ${index}`,
				};
			}

			const message =
				ctx.chatState.messages[
					ctx.chatState.messages.length - 1 - messageIndex
				];
			if (!message) {
				return {type: 'SHOW_SYSTEM_MESSAGE', text: 'Error: Message not found'};
			}

			return {type: 'ENTER_REPLY_MODE', messageId: message.id};
		}

		return {type: 'ENTER_SELECTION_MODE', action: 'reply'};
	},
	help: 'Reply to a message in the chat',
	usage: ':reply [index]',
	shorthand: 'r',
};
```

### Scroll Command

```typescript
export const scrollUpCommand: ChatCommand = {
	name: 'scrollup',
	handler: (_args, ctx) => {
		return {type: 'SCROLL_MESSAGES', direction: 'up'};
	},
	help: 'Scroll up the chat history',
	usage: ':scrollup',
	shorthand: 'k',
};
```

## Benefits

### 1. Type Safety

- All UI states and transitions are checked at compile time
- Impossible to dispatch invalid actions
- Easy refactoring with IDE support

### 2. Predictability

- UI state is always in a known, valid state
- All transitions are explicit and documented
- Easy to debug and trace state changes

### 3. Testability

- Reducer can be unit tested independently
- Command handlers can be tested by checking returned actions
- UI components can be tested with specific state inputs

### 4. Extensibility

- Easy to add new UI modes (e.g., search, filter, bulk actions)
- Actions can be composed for complex workflows
- State machine can handle multi-step processes

### 5. Developer Experience

- Clear separation between command logic and UI logic
- Self-documenting code through types
- Better IDE support and autocomplete

## Migration Strategy

### Phase 1: Define Types

1. Create the `ChatUIState` and `ChatUIAction` types
2. Implement the `chatUIReducer` function
3. Update the `ChatCommandContext` interface

### Phase 2: Update Commands

1. Convert existing commands to return actions instead of calling callbacks
2. Update the command registry to handle action dispatching
3. Add new commands that leverage the state machine

### Phase 3: Update UI Components

1. Integrate the reducer into `ChatView` using `useReducer`
2. Update components to respond to UI state changes
3. Add visual indicators for different modes (reply, unsend, etc.)

### Phase 4: Advanced Features

1. Add support for multi-step workflows
2. Implement undo/redo functionality
3. Add keyboard shortcuts that dispatch actions

## Comparison with Alternatives

| Approach          | Type Safety | Maintainability | Testability | Developer Experience |
| ----------------- | ----------- | --------------- | ----------- | -------------------- |
| Magic Strings     | ❌          | ❌              | ❌          | ❌                   |
| Callbacks         | ⚠️          | ⚠️              | ⚠️          | ⚠️                   |
| **State Machine** | ✅          | ✅              | ✅          | ✅                   |

## Industry Examples

This pattern is widely used in modern software development:

- **Redux**: Uses reducers and actions for state management
- **XState**: Formal state machine library for complex UI flows
- **React useReducer**: Built-in hook for managing complex state
- **VSCode**: Uses state machines for editor modes
- **Slack/Discord**: Chat input modes managed with state machines

## Conclusion

The typed state machine approach provides a robust, scalable, and maintainable solution for chat commands that require UI state transitions. It aligns with modern React/TypeScript best practices and provides a solid foundation for future feature development.
