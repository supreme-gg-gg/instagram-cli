import React from 'react';
import {Box, Text} from 'ink';
import type {Thread} from '../../types/instagram.js';

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

	return (
		<Box
			borderStyle={isSelected ? 'bold' : 'single'}
			borderColor={isSelected ? 'cyan' : 'gray'}
			paddingX={1}
			marginY={0}
		>
			<Box flexDirection="column" width="100%" marginY={0}>
				<Box justifyContent="space-between">
					<Text bold={isSelected} color={isSelected ? 'blue' : undefined}>
						{thread.title}
					</Text>
					<Text dimColor>{formatTime(thread.lastActivity)}</Text>
				</Box>

				{thread.lastMessage && (
					<Box>
						<Text dimColor>
							{thread.lastMessage.text && thread.lastMessage.text.length > 50
								? `${thread.lastMessage.text.substring(0, 50)}...`
								: thread.lastMessage.text}
						</Text>
					</Box>
				)}

				{thread.unreadCount > 0 && (
					<Box>
						<Text color="green" bold>
							{thread.unreadCount} unread
						</Text>
					</Box>
				)}
			</Box>
		</Box>
	);
}
