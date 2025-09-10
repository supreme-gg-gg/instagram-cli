import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, useInput, measureElement} from 'ink';
import type {Thread} from '../../types/instagram.js';
import ThreadItem from './ThreadItem.js';

interface ThreadListProps {
	threads: Thread[];
	onSelect: (thread: Thread) => void;
}

export default function ThreadList({threads, onSelect}: ThreadListProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [viewportSize, setViewportSize] = useState(10);

	const containerRef = useRef<any>(null);
	const itemRef = useRef<any>(null);

	// Measure container and item height to determine viewport size
	useEffect(() => {
		// We only need to measure if there are threads to display
		if (containerRef.current && itemRef.current) {
			const containerHeight = measureElement(containerRef.current).height;
			const itemHeight = measureElement(itemRef.current).height;

			// Ensure itemHeight is not zero to avoid division by zero errors
			if (itemHeight > 0) {
				const newViewportSize = Math.max(
					1,
					Math.floor(containerHeight / itemHeight),
				);
				setViewportSize(newViewportSize);
			}
		}
	}, [threads]); // Rerun measurement when the list of threads changes

	useInput((input, key) => {
		if (threads.length === 0) return;

		if (input === 'j' || key.downArrow) {
			const newIndex = Math.min(selectedIndex + 1, threads.length - 1);
			setSelectedIndex(newIndex);

			// Scroll down if selection moves below the viewport
			if (newIndex >= scrollOffset + viewportSize) {
				setScrollOffset(prev => prev + 1);
			}
		} else if (input === 'k' || key.upArrow) {
			const newIndex = Math.max(selectedIndex - 1, 0);
			setSelectedIndex(newIndex);

			// Scroll up if selection moves above the viewport
			if (newIndex < scrollOffset) {
				setScrollOffset(prev => prev - 1);
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
		<Box flexDirection="column" flexGrow={1} ref={containerRef}>
			{visibleThreads.map((thread, index) => {
				// We need a ref on one item to measure its height
				const isFirstItem = index === 0;
				// The actual index in the full threads array
				const absoluteIndex = scrollOffset + index;

				return (
					<Box key={thread.id} ref={isFirstItem ? itemRef : undefined}>
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
