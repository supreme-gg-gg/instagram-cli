import React from 'react';
import {Box, Text} from 'ink';
import type {Thread} from '../../types/instagram.js';

interface StatusBarProps {
	loading?: boolean;
	error?: string;
	currentView?: 'threads' | 'chat';
	currentThread?: Thread;
	username?: string;
}

export default function StatusBar({
	loading,
	error,
	currentView,
	currentThread,
	username,
}: StatusBarProps) {
	return (
		<Box
			borderStyle="round"
			borderBottom={true}
			borderLeft={true}
			borderRight={true}
			borderTop={true}
		>
			<Box flexGrow={1}>
				<Text bold color="blue">
					Instagram CLI
				</Text>
				{username && <Text dimColor> - {username}</Text>}
				{currentView === 'chat' && currentThread && (
					<Text> - {currentThread.title}</Text>
				)}
			</Box>

			<Box>
				{loading && <Text color="yellow">Loading...</Text>}
				{error && <Text color="red">Error</Text>}
				{!loading && !error && (
					<Text color="green">
						{currentView === 'threads' ? 'Threads' : 'Chat'}
					</Text>
				)}
			</Box>
		</Box>
	);
}
