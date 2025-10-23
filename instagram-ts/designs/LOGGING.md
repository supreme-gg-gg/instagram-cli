# Logging System Guide

## Overview

All errors, warnings, and important messages in the Instagram CLI are now logged to files instead of being written to console. This is necessary because the CLI controls stdout/stdin for the terminal UI.

## Log Location

All logs are stored in: `~/.instagram-cli/logs/`

Each session creates a new log file with the naming pattern: `session-YYYY-MM-DD_HH-MM-SS_RANDOM.log`

Example log file: `~/.instagram-cli/logs/session-2025-10-18_14-30-45-123abc.log`

## Log File Format

Each log entry contains:

- **Timestamp**: ISO format (e.g., `2025-10-18T14:30:45.123Z`)
- **Log Level**: `ERROR`, `WARN`, `INFO`, or `DEBUG`
- **Context**: The module/function where the error occurred (e.g., `[InstagramClient]`)
- **Message**: Human-readable error message
- **Stack trace** (for errors only): Full error stack trace for debugging

Example log file content:

```log
2025-10-18T14:30:45.123Z ERROR [InstagramClient]: Failed to fetch threads
Error: Network timeout
    at InstagramClient.getThreads
    ...

2025-10-18T14:30:50.456Z WARN [InstagramClient]: MQTT sendMessage failed
2025-10-18T14:30:55.789Z INFO [AuthFlow]: User logged in successfully
```

## Using the Logger in Code

### Basic Usage

Import the logger and create a contextual instance:

```typescript
import {createContextualLogger} from './utils/logger.js';

// In a class
private readonly logger = createContextualLogger('InstagramClient');

// In a function
const logger = createContextualLogger('myFunction');
```

### Logging Errors

```typescript
try {
	await client.sendMessage(threadId, text);
} catch (error) {
	logger.error('Failed to send message', error);
}
```

The logger automatically captures the error message and stack trace.

### Logging Warnings

```typescript
logger.warn('MQTT connection lost, using fallback API');
```

### Logging Info Messages

```typescript
logger.info('User logged in successfully');
```

### Logging Debug Messages

```typescript
logger.debug('Processing message from thread 12345');
```

## Logger Initialization

The logger is automatically initialized at application startup in both:

- `cli.ts` - Main CLI entry point
- `cli.mock.ts` - Mock/testing entry point

Manual initialization (if needed):

```typescript
import {initializeLogger} from './utils/logger.js';

await initializeLogger();
```

## Accessing Logs

View the latest session log:

```bash
ls -lt ~/.instagram-cli/logs/ | head -1
cat ~/.instagram-cli/logs/session-*.log
```

Monitor logs in real-time:

```bash
tail -f ~/.instagram-cli/logs/session-*.log
```

Search for specific errors:

```bash
grep "ERROR" ~/.instagram-cli/logs/session-*.log
grep "Failed to fetch" ~/.instagram-cli/logs/session-*.log
```

Check logs from a specific date:

```bash
ls ~/.instagram-cli/logs/session-2025-10-18_*.log
```

## Best Practices

1. **Always provide context**: Use `createContextualLogger()` with the class/function name
2. **Include error objects**: Pass the full error object to `logger.error()` for complete stack traces
3. **Use appropriate levels**:
   - `error`: Failed operations that impact functionality
   - `warn`: Fallbacks, retries, or degraded functionality
   - `info`: Important state changes or user actions
   - `debug`: Detailed execution flow (for debugging)

## Example

Proper error logging:

```typescript
export class MyService {
	private readonly logger = createContextualLogger('MyService');

	async performAction() {
		try {
			await this.riskyOperation();
			this.logger.info('Action completed successfully');
		} catch (error) {
			this.logger.error('Action failed', error);
			throw error;
		}
	}
}
```

## Cleanup

To remove old log files (logs are per-session, so you can safely delete them):

```bash
# Delete all logs older than 7 days
find ~/.instagram-cli/logs -name "session-*.log" -mtime +7 -delete

# Delete all logs
rm ~/.instagram-cli/logs/session-*.log
```
