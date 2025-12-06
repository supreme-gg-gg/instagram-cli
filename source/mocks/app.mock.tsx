import React from 'react';
import {render, Box} from 'ink';
import {Alert} from '@inkjs/ui';
import {ClientContext} from '../ui/context/client-context.js';
import {ConfigManager} from '../config.js';
import {initializeLogger} from '../utils/logger.js';
import ChatView from '../ui/views/chat-view.js';
import MediaView from '../ui/views/media-view.js';
import StoryView from '../ui/views/story-view.js';
import AltScreen from '../ui/components/alt-screen.js';
import {useStories} from '../ui/hooks/use-stories.js';
import {useInstagramClient as useMockInstagramClient} from './use-instagram-client.mock.js';
import {mockClient, mockFeed} from './index.js';

/**
 * Mock wrapper for Stories view that uses the real useStories hook
 * with a mock client. This ensures all hook logic (including pre-fetching)
 * is tested with mock data.
 */
function MockStoryWrapper() {
	// Use the REAL useStories hook with the MOCK client hook
	const {reels, isLoading, error, loadMore, client} = useStories(
		useMockInstagramClient,
	);

	if (isLoading) {
		return <Alert variant="info">Fetching Instagram stories...</Alert>;
	}

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	if (reels.length === 0 && !isLoading) {
		return <Alert variant="info">No stories to display.</Alert>;
	}

	return <StoryView reels={reels} loadMore={loadMore} client={client} />;
}

export function AppMock({view}: {readonly view: 'chat' | 'feed' | 'story'}) {
	const renderView = () => {
		switch (view) {
			case 'chat': {
				return <ChatView />;
			}

			case 'feed': {
				return <MediaView feed={mockFeed} />;
			}

			case 'story': {
				return <MockStoryWrapper />;
			}
		}
	};

	return (
		<AltScreen>
			<ClientContext.Provider value={mockClient}>
				<Box flexDirection="column" width="100%" height="100%">
					{renderView()}
				</Box>
			</ClientContext.Provider>
		</AltScreen>
	);
}

export const run = async (view: 'chat' | 'feed' | 'story' = 'chat') => {
	// Initialize logger and config like regular commands
	await initializeLogger();
	const configManager = ConfigManager.getInstance();
	await configManager.initialize();

	render(<AppMock view={view} />);
};
