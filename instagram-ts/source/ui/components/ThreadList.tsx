import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import type {Thread} from '../../types/instagram.js';
import ThreadItem from './ThreadItem.js';

interface ThreadListProps {
	threads: Thread[];
	onSelect: (thread: Thread) => void;
}

export default function ThreadList({threads, onSelect}: ThreadListProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);

	useInput((input, key) => {
		if (input === 'j' || key.downArrow) {
			setSelectedIndex(prev => Math.min(prev + 1, threads.length - 1));
		} else if (input === 'k' || key.upArrow) {
			setSelectedIndex(prev => Math.max(prev - 1, 0));
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

	return (
		<Box flexDirection="column" flexGrow={1}>
			{threads.map((thread, index) => (
				<ThreadItem
					key={thread.id}
					thread={thread}
					isSelected={index === selectedIndex}
				/>
			))}
		</Box>
	);
}
