import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, useInput, measureElement, type DOMElement} from 'ink';
import type {Thread} from '../../types/instagram.js';
import ThreadItem from './thread-item.js';

type ThreadListProperties = {
	readonly threads: Thread[];
	readonly onSelect: (thread: Thread) => void;
	readonly onScrollToBottom?: () => void;
};

export default function ThreadList({
	threads,
	onSelect,
	onScrollToBottom,
}: ThreadListProperties) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [viewportSize, setViewportSize] = useState(10);

	// Type null is required for these refs to work
	// eslint-disable-next-line @typescript-eslint/no-restricted-types
	const containerReference = useRef<DOMElement | null>(null);
	// Item height is constant because content is always truncated to fit the height
	const itemHeight = 4;

	// Measure container and item height to determine viewport size
	useEffect(() => {
		// We only need to measure if there are threads to display
		if (containerReference.current) {
			const containerHeight = measureElement(containerReference.current).height;

			const newViewportSize = Math.max(
				1,
				Math.floor(containerHeight / itemHeight),
			);
			setViewportSize(newViewportSize);
		}
	}, [threads]); // Rerun measurement when the list of threads changes

	useInput((input, key) => {
		if (threads.length === 0) return;

		if (input === 'j' || key.downArrow) {
			const newIndex = Math.min(selectedIndex + 1, threads.length - 1);
			setSelectedIndex(newIndex);

			// Scroll down if selection moves below the viewport
			if (newIndex >= scrollOffset + viewportSize) {
				setScrollOffset(previous => previous + 1);
			}

			// Trigger load more when reaching the bottom
			if (newIndex === threads.length - 1 && onScrollToBottom) {
				onScrollToBottom();
			}
		} else if (input === 'k' || key.upArrow) {
			const newIndex = Math.max(selectedIndex - 1, 0);
			setSelectedIndex(newIndex);

			// Scroll up if selection moves above the viewport
			if (newIndex < scrollOffset) {
				setScrollOffset(previous => previous - 1);
			}
		} else if (key.return && threads[selectedIndex]) {
			onSelect(threads[selectedIndex]);
		}
	});

	if (threads.length === 0) {
		return (
			<Box flexGrow={1} justifyContent="center" alignItems="center">
				<Text dimColor>No threads found</Text>
			</Box>
		);
	}

	// Render only the threads that should be visible
	const visibleThreads = threads.slice(
		scrollOffset,
		scrollOffset + viewportSize,
	);

	return (
		<Box ref={containerReference} flexDirection="column" flexGrow={1}>
			{visibleThreads.map((thread, index) => {
				// The actual index in the full threads array
				const absoluteIndex = scrollOffset + index;
				const isLastItem = index === visibleThreads.length - 1;

				return (
					<Box
						key={thread.id}
						flexDirection="column"
						marginBottom={isLastItem ? 0 : 1}
						flexShrink={0}
					>
						<ThreadItem
							thread={thread}
							isSelected={absoluteIndex === selectedIndex}
						/>
					</Box>
				);
			})}
		</Box>
	);
}
