import React, {useState, useEffect, useCallback} from 'react';
import {render, Box, Text} from 'ink';
import {ClientContext} from '../ui/context/client-context.js';
import {ConfigManager} from '../config.js';
import {initializeLogger} from '../utils/logger.js';
import type {StoryReel} from '../types/instagram.js';
import ChatView from '../ui/views/chat-view.js';
import MediaView from '../ui/views/media-view.js';
import StoryView from '../ui/views/story-view.js';
import AltScreen from '../ui/components/alt-screen.js';
import {mockClient, mockFeed} from './index.js';

function MockStoryWrapper() {
	const [reels, setReels] = useState<StoryReel[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const loadMore = useCallback(
		async (index: number) => {
			const reelToLoad = reels[index];
			if (reelToLoad && reelToLoad.stories.length === 0) {
				const stories = await mockClient.getStoriesForUser(reelToLoad.user.pk);
				setReels(currentReels => {
					const newReels = [...currentReels];
					const currentReel = newReels[index];
					if (currentReel) {
						currentReel.stories = stories;
					}

					return newReels;
				});
			}
		},
		[reels],
	);

	useEffect(() => {
		const fetchInitialReels = async () => {
			setIsLoading(true);
			const initialReels = await mockClient.getReelsTray();
			if (initialReels.length > 0) {
				const firstReel = initialReels[0];
				if (firstReel) {
					const stories = await mockClient.getStoriesForUser(firstReel.user.pk);
					firstReel.stories = stories;
				}
			}

			setReels(initialReels);
			setIsLoading(false);
		};

		void fetchInitialReels();
	}, []);

	if (isLoading) {
		return (
			<Box>
				<Text>Loading stories...</Text>
			</Box>
		);
	}

	return <StoryView reels={reels} loadMore={loadMore} client={mockClient} />;
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
