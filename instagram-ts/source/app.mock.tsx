import React from 'react';
import {render, Box} from 'ink';
import {ClientContext} from './ui/context/client-context.js';
import {mockClient, mockFeed} from './mocks/index.js';
import ChatView from './ui/views/chat-view.js';
import MediaView from './ui/views/media-view.js';
import AltScreen from './ui/components/alt-screen.js';

export function AppMock({view}: {readonly view: 'chat' | 'feed'}) {
	const renderView = () => {
		switch (view) {
			case 'chat': {
				return <ChatView />;
			}

			case 'feed': {
				return <MediaView feed={mockFeed} />;
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

export const run = (view: 'chat' | 'feed' = 'chat') => {
	render(<AppMock view={view} />);
};
