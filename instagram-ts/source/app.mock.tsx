import React from 'react';
import {render, Box} from 'ink';
import {ClientContext} from './ui/context/client-context.js';
import {mockClient, mockFeed} from './mocks/index.js';
import ChatView from './ui/views/chat-view.js';
import MediaView from './ui/views/media-view.js';
import AltScreen from './ui/components/alt-screen.js';

const MOCK_CONFIG = {
	view: 'chat' as 'chat' | 'media', // Change this to switch views
	// user: "alice_smith",
	// theme: "dark",
	// etc.
};

function AppMock() {
	const renderView = () => {
		switch (MOCK_CONFIG.view) {
			case 'chat': {
				return <ChatView />;
			}

			case 'media': {
				return <MediaView feed={mockFeed} />;
			}

			// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
			default: {
				return <ChatView />;
			}
		}
	};

	return (
		<ClientContext.Provider value={mockClient}>
			<AltScreen>
				<Box flexDirection="column" width="100%" height="100%">
					{renderView()}
				</Box>
			</AltScreen>
		</ClientContext.Provider>
	);
}

export const run = () => {
	render(<AppMock />);
};
