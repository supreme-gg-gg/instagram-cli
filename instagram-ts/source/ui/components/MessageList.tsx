import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import type {Message, Thread} from '../../types/instagram.js';

interface MessageListProps {
	messages: Message[];
	currentThread?: Thread;
}

export default function MessageList({
	messages,
	currentThread,
}: MessageListProps) {
	const [scrollOffset, setScrollOffset] = useState(0);
	const maxVisible = 20; // Number of messages to show at once

	useInput((input, key) => {
		if (input === 'j' || key.downArrow) {
			setScrollOffset(prev =>
				Math.min(prev + 1, Math.max(0, messages.length - maxVisible)),
			);
		} else if (input === 'k' || key.upArrow) {
			setScrollOffset(prev => Math.max(prev - 1, 0));
		}
	});

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const visibleMessages = messages.slice(
		scrollOffset,
		scrollOffset + maxVisible,
	);

	if (messages.length === 0) {
		return (
			<Box flexGrow={1} justifyContent="center" alignItems="center">
				<Text dimColor>
					{currentThread
						? 'No messages in this thread'
						: 'Select a thread to view messages'}
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" flexGrow={1}>
			{visibleMessages.map(message => (
				<Box key={message.id} paddingX={1} marginY={0}>
					<Box flexDirection="column" width="100%">
						<Box justifyContent="space-between">
							<Text bold color={message.isOutgoing ? 'blue' : 'green'}>
								{message.isOutgoing ? 'You' : message.username}
							</Text>
							<Text dimColor>{formatTime(message.timestamp)}</Text>
						</Box>
						<Box>
							<Text>{message.text}</Text>
						</Box>
					</Box>
				</Box>
			))}

			{messages.length > maxVisible && (
				<Box justifyContent="center">
					<Text dimColor>
						Showing {scrollOffset + 1}-
						{Math.min(scrollOffset + maxVisible, messages.length)} of{' '}
						{messages.length} messages
					</Text>
				</Box>
			)}
		</Box>
	);
}
