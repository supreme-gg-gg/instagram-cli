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
};

export default function StatusBar({
	isLoading,
	error,
	currentView,
	currentThread,
	realtimeStatus,
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

	return (
		<Box paddingX={1} justifyContent="space-between" width="100%">
			<Box>
				<Text bold color="magenta">
					📷 InstagramCLI
				</Text>
				{getRealtimeIndicator()}
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
						{currentView === 'threads' ? 'Threads' : 'Chat'}
					</Text>
				)}
			</Box>
		</Box>
	);
}
