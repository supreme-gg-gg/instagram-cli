import React from 'react';
import {Box, Text} from 'ink';
import AltScreen from './alt-screen.js';
import FullScreen from './full-screen.js';

type Properties = {
	readonly sidebarTitle: string;
	readonly sidebarContent: React.ReactNode;
	readonly mainContent: React.ReactNode;
	readonly footerText: string;
	readonly sidebarWidth?: number;
};

export default function SplitView({
	sidebarTitle,
	sidebarContent,
	mainContent,
	footerText,
	sidebarWidth = 30,
}: Properties) {
	return (
		<AltScreen>
			<FullScreen>
				<Box flexDirection="column" height="100%" width="100%">
					<Box flexDirection="row" gap={2} flexGrow={1}>
						{/* Sidebar */}
						<Box
							flexDirection="column"
							borderStyle="round"
							paddingX={1}
							width={sidebarWidth}
							flexShrink={0}
							height="100%"
							overflow="hidden"
						>
							<Text color="cyan">{sidebarTitle}</Text>
							<Box height={1} />
							<Box flexDirection="column" flexGrow={1} overflow="hidden">
								{sidebarContent}
							</Box>
						</Box>

						{/* Main Content */}
						<Box
							flexDirection="column"
							borderStyle="round"
							padding={1}
							flexGrow={1}
							height="100%"
							overflow="hidden"
						>
							{mainContent}
						</Box>
					</Box>

					{/* Footer */}
					<Box marginTop={1}>
						<Text dimColor>{footerText}</Text>
					</Box>
				</Box>
			</FullScreen>
		</AltScreen>
	);
}
