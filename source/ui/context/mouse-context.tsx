import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	type ReactNode,
} from 'react';
import {useStdin, useStdout} from 'ink';
import {
	parseMouseEvent,
	isIncompleteMouseSequence,
	enableMouseTracking,
	disableMouseTracking,
	ESC,
	type MouseEvent as TerminalMouseEvent,
	type MouseHandler,
} from '../../utils/mouse.js';

export type {MouseEvent, MouseHandler} from '../../utils/mouse.js';

const MAX_MOUSE_BUFFER_SIZE = 4096;

type MouseContextValue = {
	subscribe: (handler: MouseHandler) => void;
	unsubscribe: (handler: MouseHandler) => void;
};

const MouseContext = createContext<MouseContextValue | undefined>(undefined);

/**
 * Access the mouse context. Must be used within a MouseProvider.
 */
export function useMouseContext(): MouseContextValue {
	const context = useContext(MouseContext);
	if (!context) {
		throw new Error('useMouseContext must be used within a MouseProvider');
	}

	return context;
}

/**
 * Subscribe to mouse events. The handler is called for every parsed mouse
 * event while `isActive` is true. Return `true` from the handler to indicate
 * the event was consumed (prevents propagation warning for drags).
 *
 * Usage:
 * ```tsx
 * useMouse(useCallback((event) => {
 *   if (event.name === 'scroll-up') { ... }
 * }, [deps]));
 * ```
 */
export function useMouse(
	handler: MouseHandler,
	{isActive = true}: {isActive?: boolean} = {},
): void {
	const {subscribe, unsubscribe} = useMouseContext();

	useEffect(() => {
		if (!isActive) {
			return;
		}

		subscribe(handler);
		return () => {
			unsubscribe(handler);
		};
	}, [isActive, handler, subscribe, unsubscribe]);
}

/**
 * Provides mouse event tracking to the component tree.
 *
 * - On mount: enables terminal mouse tracking via ANSI escape sequences
 * - Listens on raw stdin for mouse escape sequences
 * - Parses SGR and X11 mouse protocols
 * - Broadcasts parsed events to all subscribers registered via `useMouse`
 * - On unmount: disables mouse tracking
 */
export function MouseProvider({children}: {readonly children: ReactNode}) {
	const {stdin} = useStdin();
	const {stdout} = useStdout();
	const subscribers = useRef<Set<MouseHandler>>(new Set()).current;

	const subscribe = useCallback(
		(handler: MouseHandler) => {
			subscribers.add(handler);
		},
		[subscribers],
	);

	const unsubscribe = useCallback(
		(handler: MouseHandler) => {
			subscribers.delete(handler);
		},
		[subscribers],
	);

	// Enable/disable mouse tracking on the terminal
	useEffect(() => {
		enableMouseTracking(stdout);
		return () => {
			disableMouseTracking(stdout);
		};
	}, [stdout]);

	// Listen for raw stdin data and parse mouse sequences
	useEffect(() => {
		let mouseBuffer = '';

		const broadcast = (event: TerminalMouseEvent) => {
			for (const handler of subscribers) {
				handler(event);
			}
		};

		const handleData = (data: Uint8Array | string) => {
			const str =
				typeof data === 'string' ? data : new TextDecoder('utf8').decode(data);

			// Only buffer data that could be part of a mouse sequence.
			// Non-mouse input should pass through to Ink's handler untouched.
			if (
				mouseBuffer.length === 0 &&
				!str.startsWith(ESC + '[<') &&
				!str.startsWith(ESC + '[M')
			) {
				return;
			}

			mouseBuffer += str;

			// Safety cap to prevent unbounded buffer growth
			if (mouseBuffer.length > MAX_MOUSE_BUFFER_SIZE) {
				mouseBuffer = mouseBuffer.slice(-MAX_MOUSE_BUFFER_SIZE);
			}

			while (mouseBuffer.length > 0) {
				const parsed = parseMouseEvent(mouseBuffer);

				if (parsed) {
					broadcast(parsed.event);
					mouseBuffer = mouseBuffer.slice(parsed.length);
					continue;
				}

				if (isIncompleteMouseSequence(mouseBuffer)) {
					break; // Wait for more data
				}

				// Not a valid sequence; discard bytes until next ESC
				const nextEsc = mouseBuffer.indexOf(ESC, 1);
				if (nextEsc === -1) {
					mouseBuffer = '';
					break;
				} else {
					mouseBuffer = mouseBuffer.slice(nextEsc);
				}
			}
		};

		stdin.on('data', handleData);

		return () => {
			stdin.removeListener('data', handleData);
		};
	}, [stdin, subscribers]);

	const contextValue = React.useMemo(
		() => ({subscribe, unsubscribe}),
		[subscribe, unsubscribe],
	);

	return (
		<MouseContext.Provider value={contextValue}>
			{children}
		</MouseContext.Provider>
	);
}
