# API Debugging Guide

In the past we used to go to a python / node shell, write code to call instagram-private-api methods, and inspect the responses to understand how the API works. Thanks to @qumisagi's contribution, we now have a more structured way to debug and understand the Instagram API flows.

## Property Tracker

The property tracker automatically discovers and logs new properties from Instagram API responses, helping you track schema changes over time.

### Usage

Import and call `registerProperties()` with an API response object and a schema filename:

```typescript
import registerProperties from './utils/property-tracker.js';

// In your API call handler
const response = await client.getThreads();
if (response.length > 0) {
	registerProperties(response[0] as Record<string, any>, 'thread-schema.json');
}
```

### How it works

1. Extracts all top-level property names from the object
2. Compares with previously registered properties (stored in `data/[filename]`)
3. Logs new properties to console: `New properties found: prop1, prop2, ...`
4. Appends new properties to the schema file for future reference

### Schema Files Location

Tracked schemas are stored in `/instagram-ts/data/`:

- `thread-schema.json` - Thread object properties
- `message-schema.json` - Message object properties
- etc.

### Example Output

```json
New properties found: read_state, viewer_id, has_newer
```

The schema file `thread-schema.json` gets updated to preserve the discovered properties for documentation.
