import React from 'react';
import {Box} from 'ink';
import {useScreenSize} from '../hooks/use-screen-size.js';

function FullScreen(properties: {children: React.ReactNode}) {
	const {height, width} = useScreenSize();
	// Make height exactly one row less than screen height to fix flickering caused by stdin
	return (
		<Box height={height - 1} width={width} overflow="hidden">
			{properties.children}
		</Box>
	);
}

export default FullScreen;
