import React from 'react';
import {Box, Text} from 'ink';
import type {Message, Thread} from '../../types/instagram.js';

interface ThreadItemProps {
	thread: Thread;
	isSelected: boolean;
}

export default function ThreadItem({thread, isSelected}: ThreadItemProps) {
	const formatTime = (date: Date) => {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);

		if (minutes < 60) {
			return `${minutes}m`;
		}

		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			return `${hours}h`;
		}

		const days = Math.floor(hours / 24);
		return `${days}d`;
	};

	const getLastMessageText = (message: Message): string => {
		switch (message.itemType) {
			case 'text':
				return message.text;
			case 'media':
				return '[Media]';
			case 'clip':
				return '[Clip]';
			case 'placeholder':
				return message.text;
			default:
				return '[Unsupported Message]';
		}
	};

	const lastMessageText = thread.lastMessage
		? getLastMessageText(thread.lastMessage)
		: '';

	return (
		<Box
			borderStyle={isSelected ? 'bold' : 'single'}
			borderColor={isSelected ? 'cyan' : 'gray'}
			paddingX={1}
			height={lastMessageText ? 4 : 2}
			width="100%"
			flexDirection="column"
			justifyContent="space-around"
		>
			{/* Top Row: Title, Unread, Time */}
			<Box justifyContent="space-between">
				<Box flexShrink={1} marginRight={2}>
					<Text
						bold={isSelected}
						color={isSelected ? 'blue' : undefined}
						wrap="truncate"
					>
						{thread.title}
					</Text>
				</Box>
				<Box>
					{thread.unread && (
						<Text color="green" bold>
							(Unread){' '}
						</Text>
					)}
					<Text dimColor>{formatTime(thread.lastActivity)}</Text>
				</Box>
			</Box>

			{/* Bottom Row: Last Message */}
			<Box>
				<Text dimColor wrap="truncate">
					{lastMessageText}
				</Text>
			</Box>
		</Box>
	);
}
