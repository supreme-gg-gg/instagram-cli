# Hybrid Instagram Client: Web API + MQTT

## Overview

The `InstagramClient` integrates `instagram_mqtt` for real-time Direct Message (DM) operations with the `instagram-private-api` Web API as a fallback. This hybrid approach ensures low-latency updates when MQTT is connected, while guaranteeing reliability via the API.

## Architecture

### Core Components

- **`InstagramClient` Class**: Extends Node.js `EventEmitter` to emit events like `'message'`, `'realtimeStatus'`, and `'error'`.
- **Properties**:
  - `ig`: `IgApiClientExt` for Web API calls.
  - `realtime`: `RealtimeClient` for MQTT (initialized post-login).
  - `realtimeStatus`: Tracks connection state (`'disconnected' | 'connecting' | 'connected' | 'error'`).

### Connection Lifecycle

1. **Login**: After successful login (password or session), `initializeRealtime()` is called asynchronously.
2. **MQTT Setup**: Wraps `ig` with `withRealtime()`, subscribes to GraphQL/Skywalker subscriptions, and connects.
3. **Event Handling**: MQTT messages are parsed into `Message` objects and emitted as `'message'` events. Connection status changes emit `'realtimeStatus'`.

### Action Handling

Methods like `sendMessage()` prioritize MQTT for speed:

- If MQTT is `'connected'`, use `realtime.direct.sendText()`.
- On failure or disconnection, fallback to Web API (e.g., `ig.entity.directThread().broadcastText()`).

Other direct chat send actions are still handled via Web API, such as sending media. This is because the MQTT client currently supports only text messages.

## UI Integration

- **No Polling**: Remove `setInterval` for `getMessages`.
- **Event Subscription**: Listen to client events in React components (e.g., `useEffect` with `client.on('message', handler)`).
- **Status Indicators**: Use `'realtimeStatus'` for UI feedback on connection state.
