import React, {useRef} from 'react';
import {Box, Text} from 'ink';
import type {
	Message,
	Thread,
	TextMessage,
	// MediaMessage,
} from '../../types/instagram.js';
// import AsciiImage from './AsciiImage.js';

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

	const renderMessageContent = (message: Message) => {
		switch (message.itemType) {
			case 'text':
				return <Text>{(message as TextMessage).text}</Text>;
			case 'media': {
				// const media = (message as MediaMessage).media;
				// const imageUrl = media.image_versions2?.candidates[0]?.url;
				// if (imageUrl) {
				// 	return <AsciiImage url={imageUrl} />;
				// }
				return <Text dimColor>[Sent an image]</Text>;
			}
			case 'clip':
				return <Text dimColor>[Sent a brainrot!]</Text>;
			default:
				return <Text dimColor>[Unknown Message Type]</Text>;
		}
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
					<Box key={message.id} marginY={0.1} flexDirection="column">
						<Box justifyContent="space-between">
							<Text bold color={message.isOutgoing ? 'cyan' : 'greenBright'}>
								{message.isOutgoing ? 'You' : message.username}
							</Text>
							<Text dimColor>{formatTime(message.timestamp)}</Text>
						</Box>
						<Box>{renderMessageContent(message)}</Box>
					</Box>
				))}
			</Box>
			<Box ref={endOfMessagesRef} />
		</Box>
	);
}
