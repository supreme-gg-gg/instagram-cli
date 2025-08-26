import React from 'react';
import {Box, useInput} from 'ink';

import {useScreenSize} from '../hooks/useScreenSize.js';

const FullScreen = (props: {children: React.ReactNode}) => {
	useInput(() => {}); // prevent input from rendering and shifting the layout
	const {height, width} = useScreenSize();
	// Make height exactly one row less than screen height to fix flickering caused by stdin
	return (
		<Box height={height - 1} width={width}>
			{props.children}
		</Box>
	);
};

export default FullScreen;
