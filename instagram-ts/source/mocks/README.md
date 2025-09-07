# Mock System for Instagram CLI

This directory contains a clean, organized mock system for testing and development without making real API calls.

## Structure

```plaintext
mocks/
├── index.ts        # Main exports
├── mockData.ts     # All mock data (users, messages, threads, posts)
└── MockClient.ts   # Mock implementation of InstagramClient
```

## Usage

### Development Testing

Run the mock app:

```bash
npm run build
npm run start:mock  # this will run cli.mock.js instead of cli.js
```

### Manual View Testing

Edit `app.mock.tsx` to switch between different views:

```typescript
const MOCK_CONFIG = {
  view: "chat" as "chat" | "media", // Change this line
};
```

Available views:

- `"chat"` - Test the chat interface
- `"media"` - Test the media feed interface

### Adding Mock Data

1. **More threads**: Edit `mockThreads` in `mockData.ts`
2. **More messages**: Edit `mockMessages` in `mockData.ts`
3. **More posts**: Edit `mockPosts` in `mockData.ts`
4. **Generate data**: Use helper functions like `generateThread()` and `generateMessage()`

### Future Testing Integration

The mock client can be easily imported for unit tests:

```typescript
import { mockClient } from "./mocks/index.js";

// Use mockClient in your tests
```
