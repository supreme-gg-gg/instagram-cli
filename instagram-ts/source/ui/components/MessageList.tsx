import React, {useRef} from 'react';
import {Box, Text} from 'ink';
import type {
	Message,
	Thread,
	TextMessage,
	MediaMessage,
} from '../../types/instagram.js';
import Image from 'ink-picture';
import {ConfigManager} from '../../config.js';

interface MessageListProps {
	messages: Message[];
	currentThread?: Thread;
}

export default function MessageList({
	messages,
	currentThread,
}: MessageListProps) {
	const endOfMessagesRef = useRef<React.ElementRef<typeof Box>>(null);
	const imageProtocol = ConfigManager.getInstance().get<string>(
		'image.protocol',
		'ascii',
	);

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
				const media = (message as MediaMessage).media;
				const imageUrl = media.image_versions2?.candidates[0]?.url;
				if (imageUrl) {
					return (
						<Box
							borderStyle="round"
							borderColor="cyan"
							width={32}
							height={17}
							flexDirection="column"
						>
							<Image src={imageUrl} alt="Sent image" protocol={imageProtocol} />
						</Box>
					);
				}
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
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
			<Box flexDirection="column" justifyContent="flex-end" overflow="hidden">
				{messages.map(message => (
					<Box
						key={message.id}
						flexDirection="column"
						flexGrow={1}
						flexShrink={0}
					>
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
