# API Debugging Guide

When you work on API code, you will often need to see the real data Instagram returns: to understand a new endpoint, to debug a parsing problem, or to update the mock data. This guide covers the workflow:

1. [Find the request in the logs](#1-find-the-request-in-the-logs)
2. [Capture the raw response](#2-capture-the-raw-response)
3. [Track properties over time](#3-track-properties-over-time)
4. [Update the mocks](#4-update-the-mocks)

## 1. Find the request in the logs

Every run writes a session log to `~/.instagram-cli/logs/` (see [logging.md](logging.md)). API traffic appears under the `[ig-api]` context:

- each request logs its method and URL (`Requesting GET https://i.instagram.com/api/v1/...`)
- **failed** requests also log the full response body

The logs do **not** include the body of successful responses. Use them to find out which endpoint was called and why a call failed.

## 2. Capture the raw response

To capture a successful response, temporarily write it to a file next to the call in `source/client.ts`:

```typescript
import * as fs from 'node:fs';

const response = await this.ig.feed.reelsTray().request();
fs.writeFileSync(
	'data/reelsTray_example.json',
	JSON.stringify(response, null, 2),
);
```

Then rebuild (`npm run dev`) and run the command that triggers the call. Conventions:

- Put captures in `data/`, named `<endpoint>_example.json`.
- Remove the dump code before you commit.
- **Never commit raw captures.** They contain real usernames, user IDs, message text, media URLs and sometimes tokens. `data/` is not git-ignored, so check `git status` before committing.

## 3. Track properties over time

A single capture shows one sample. To find out which fields appear across many responses (and catch schema changes), use the property tracker, contributed by @qumisagi.

Import `registerProperties()` and call it with an API response object and a schema filename:

```typescript
import registerProperties from './utils/property-tracker.js';

// In your API call handler
const response = await client.getThreads();
if (response.length > 0) {
	registerProperties(response[0] as Record<string, any>, 'thread-schema.json');
}
```

How it works:

1. Extracts all top-level property names from the object
2. Compares them with the properties already recorded in `data/<filename>`
3. Appends any new property names to that file

Schema files are stored in `data/` at the repo root, for example:

- `thread-schema.json`: thread object properties
- `message-schema.json`: message object properties

Like raw captures, these are for local debugging. Remove the `registerProperties()` call before you commit.

## 4. Update the mocks

If the shape of a response changed, or you added a new endpoint, update `source/mocks/mock-data.ts` (and `mock-client.ts` if needed) to match. Base the update on your capture, but replace every real value with fake data: names, IDs, text, and URLs. Then check that `npm run start:mock` still renders correctly.
