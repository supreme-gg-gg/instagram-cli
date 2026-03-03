import React, {useState, useEffect} from 'react';
import {Text, Box} from 'ink';

export const TypingIndicator = ({isTyping}: {isTyping: boolean}) => {
	const [frame, setFrame] = useState(0);

	useEffect(() => {
		if (!isTyping) return;

		const interval = setInterval(() => {
			setFrame(prev => (prev + 1) % 3);
		}, 700);

		return () => clearInterval(interval);
	}, [isTyping]);

	if (!isTyping) return null;

	// Each dot gets brighter in sequence
	const getDotColor = (dotIndex: number) => {
		const activeIndex = frame;
		if (dotIndex === activeIndex) return 'cyan'; // Bright
		return 'gray'; // Dim
	};

	return (
		<Box marginLeft={1} flexDirection="row">
			<Text color={getDotColor(0)} bold>
				●{' '}
			</Text>
			<Text color={getDotColor(1)} bold>
				●{' '}
			</Text>
			<Text color={getDotColor(2)} bold>
				●
			</Text>
		</Box>
	);
};
