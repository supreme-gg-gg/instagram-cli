# Stories UI & Data Flow Design

## Overview

This document outlines the architecture for fetching and displaying Instagram Stories. The system is designed to be efficient, robust, and maintainable, using a centralized, hook-based approach for data management and a clear, unidirectional data flow.

Key features include on-demand lazy-loading of story media and automatically marking stories as seen as a user navigates through them.

## UI Architecture

The story viewer consists of a two-panel layout within a full-screen terminal view.

```plaintext
┌────────────────────────────────────────────────────────────────────────┐
│ ✨ Stories                                                             │
├──────────────────────────────────┬─────────────────────────────────────┤
│                                  │                                     │
│  ┌───────────────────────────┐   │  ┌───────────────────────────────┐  │
│  │ ➜ user_one (current)      │   │  │ 🖼️ Story Media Display        │  │
│  │   user_two (seen)         │   │  └───────────────────────────────┘  │
│  │   user_three              │   │                                     │
│  │   ...                     │   │  Story 1 of 3                       │
│  └───────────────────────────┘   │  👤 user_one (timestamp)            │
│                                  │  Caption text for the current...    │
│                                  │                                     │
├──────────────────────────────────┴─────────────────────────────────────┤
│ Help: j/k: users, h/l: stories, o: open, s: search, Esc: quit          │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Left Panel (Users List)**: Displays a vertical list of all users who have active stories.
   - The currently selected user is highlighted.
   - Users whose stories have been viewed during the session are dimmed.
2. **Right Panel (Media Display)**:
   - Displays the current story's image (or a placeholder for video).
   - Shows metadata, including the user's name, timestamp, and caption.
   - Indicates the current position within a user's multi-story reel (e.g., "Story 2 of 5").

## Data Flow and State Management

The entire feature is powered by a hook-based architecture that centralizes state and data-fetching logic, ensuring a single source of truth and a predictable, unidirectional data flow.

```mermaid
graph TD
    subgraph "UI Layer (Components)"
        A[Stories Command] --> B(useStories Hook);
        B --> C{StoryDisplay};
    end

    subgraph "Logic & Data Layer"
        B --> D[client.getReelsTray()];
        B -- "loadMore(index)" --> E[client.getStoriesForUser(id)];
        C -- "mark as seen" --> F[client.markStoryAsSeen(stories)];
    end

    subgraph "Instagram API"
        D --> G[API];
        E --> G;
        F --> G;
    end

    C -- "User navigates to new reel" --> B;

    style B fill:#f9f,stroke:#333,stroke-width:2px
```

### 1. Centralized `useStories` Hook

The `useStories` hook (`source/ui/hooks/use-stories.ts`) is the brain of the feature. It is responsible for all state management and interactions with the `InstagramClient`.

- **Responsibilities**:
  1. Initializes the `InstagramClient`.
  2. On mount, fetches the initial list of users with stories (`reelsTray`).
  3. Immediately fetches the stories for the first user to ensure the UI is not empty on load.
  4. Manages all loading and error states for the entire feature.
  5. Exposes a `loadMore(index)` function for the UI to call for lazy-loading.
  6. Returns a single state object for the UI to consume.
- **Returned State Object**:

  ```typescript
  interface UseStoriesReturn {
  	reels: StoryReel[];
  	isLoading: boolean;
  	error?: string;
  	loadMore: (index: number) => void;
  	client: InstagramClient;
  }
  ```

### 2. Component Responsibilities

- **`Stories` (Command)**: The top-level command component. Its only job is to invoke the `useStories` hook and pass the resulting state and functions down to the `StoryView`.
- **`StoryView` (View)**: A simple container component that provides necessary context (like `TerminalInfoProvider`) and passes props to the main display component.
- **`StoryDisplay` (Component)**: A "presentational" component that handles all UI rendering and user interaction. It receives data via props and calls functions like `loadMore` and `markStoryAsSeen` in response to user input, but it contains no business logic itself.

## Key Features Implementation

### Lazy-Loading Stories

To minimize initial load time and API usage, story media is lazy-loaded on demand.

1.  **Initial Load**: The `useStories` hook first calls `client.getReelsTray()` to get the list of users. It then immediately calls `loadMore(0)` to pre-fetch stories for the first user in the list.
2.  **On-Demand Loading**: The `StoryDisplay` component contains a `useEffect` hook that watches the selected user index. When the user navigates to a new user whose stories have not yet been loaded (`reel.stories.length === 0`), it calls the `loadMore(index)` function passed down from the `useStories` hook.

### Marking Stories as Seen

Stories are automatically marked as seen as the user views them.

1. **Trigger**: A `useEffect` in `StoryDisplay` is triggered whenever the `currentReel` (the selected user's story collection) changes.
2. **API Call**: The effect calls `client.markStoryAsSeen(currentReel.stories)`, which sends a single API request to mark all stories in that reel as viewed.
3. **Duplicate Prevention**: To prevent sending redundant API calls for the same reel within a single session, the component maintains a local `seenReels` state (`Set<number>`). The API call is only made if the user's ID is not already in this set.
4. **Visual Feedback**: Usernames in the left-hand list are dimmed once their stories have been marked as seen.

## Navigation and Key Bindings

- **`j` / `Down Arrow`**: Navigate down the list of users.
- **`k` / `Up Arrow`**: Navigate up the list of users.
- **`l` / `Right Arrow`**: Navigate to the next story within a user's reel.
- **`h` / `Left Arrow`**: Navigate to the previous story within a user's reel.
- **`s`**: Enter search mode to find a specific user's stories.
- **`o`**: Open the current story's media (image or video) in the default system browser/viewer.
- **`Esc`**: Exit the story viewer.
