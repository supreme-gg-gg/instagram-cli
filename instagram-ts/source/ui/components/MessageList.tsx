import React, {useRef} from 'react';
import {Box, Text} from 'ink';
import type {Message, Thread} from '../../types/instagram.js';

interface MessageListProps {
	messages: Message[];
	currentThread?: Thread;
}

export default function MessageList({
	messages,
	currentThread,
}: MessageListProps) {
	const endOfMessagesRef = useRef<React.ElementRef<typeof Box>>(null);

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	if (messages.length === 0) {
		return (
			<Box flexGrow={1} justifyContent="center" alignItems="center">
				<Text dimColor>
					{currentThread
						? 'No messages in this thread. Be the first to say hi!'
						: 'Select a thread to view messages'}
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
			<Box flexDirection="column" flexGrow={1}>
				{messages.map(message => (
					<Box key={message.id} marginY={1} flexDirection="column">
						<Box justifyContent="space-between">
							<Text bold color={message.isOutgoing ? 'cyan' : 'greenBright'}>
								{message.isOutgoing ? 'You' : message.username}
							</Text>
							<Text dimColor>{formatTime(message.timestamp)}</Text>
						</Box>
						<Box>
							<Text>{message.text}</Text>
						</Box>
					</Box>
				))}
			</Box>
			<Box ref={endOfMessagesRef} />
		</Box>
	);
}
