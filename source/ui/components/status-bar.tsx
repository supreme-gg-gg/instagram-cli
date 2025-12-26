import React from 'react';
import {Box, Text} from 'ink';
import type {Thread} from '../../types/instagram.js';
import type {RealtimeStatus} from '../../client.js';

type StatusBarProperties = {
	readonly isLoading: boolean;
	readonly error?: string;
	readonly currentView: 'threads' | 'chat';
	readonly currentThread?: Thread;
	readonly realtimeStatus: RealtimeStatus;
	readonly searchMode?: 'username' | 'title';
};

export default function StatusBar({
	isLoading,
	error,
	currentView,
	currentThread,
	realtimeStatus,
	searchMode,
}: StatusBarProperties) {
	const getRealtimeIndicator = () => {
		switch (realtimeStatus) {
			case 'connected': {
				return <Text color="green"> (● Live)</Text>;
			}

			case 'connecting': {
				return <Text color="yellow"> (● Connecting...)</Text>;
			}

			case 'disconnected': {
				return <Text color="gray"> (○ Disconnected)</Text>;
			}

			case 'error': {
				return <Text color="red"> (X Error)</Text>;
			}

			default: {
				return null;
			}
		}
	};

	const getSearchModeIndicator = () => {
		if (!searchMode) return null;

		const modeText =
			searchMode === 'username' ? 'Search by @username' : 'Search by title';
		return <Text color="cyan"> 🔍 {modeText}</Text>;
	};

	return (
		<Box paddingX={1} justifyContent="space-between" width="100%">
			<Box>
				<Text bold color="magenta">
					📷 InstagramCLI
				</Text>
				{getRealtimeIndicator()}
				{getSearchModeIndicator()}
				{currentView === 'chat' && currentThread && (
					<Text> / Chat with {currentThread.title}</Text>
				)}
			</Box>

			<Box>
				{/* {loading && <Spinner label="Loading..." />} */}
				{isLoading && <Text color="yellow">Loading...</Text>}
				{error && <Text color="red">Error</Text>}
				{!isLoading && !error && (
					<Text color="green">
						{currentView === 'threads'
							? searchMode
								? 'Search'
								: 'Threads'
							: 'Chat'}
					</Text>
				)}
			</Box>
		</Box>
	);
}
