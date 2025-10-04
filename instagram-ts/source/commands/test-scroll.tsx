import React, {useRef} from 'react';
import {render, Box, Text, useInput} from 'ink';
import ScrollView, {type ScrollViewRef} from '../ui/components/scroll-view.js';

function VeryLongList() {
	const items = Array.from({length: 100}, (_, i) => (
		<Box key={i} flexShrink={0} borderStyle="round" borderColor="cyan">
			<Text>Item {i + 1}</Text>
		</Box>
	));
	return <Box flexDirection="column">{items}</Box>;
}

function App() {
	const scrollViewRef = useRef<ScrollViewRef | undefined>(null);

	useInput((...args) => {
		const [, key] = args;
		if (!scrollViewRef.current) return;
		if (key.upArrow) {
			scrollViewRef.current.scrollTo(prev => prev - 1);
		} else if (key.downArrow) {
			scrollViewRef.current.scrollTo(prev => prev + 1);
		}
	});

	return (
		<Box flexDirection="column">
			<ScrollView
				ref={scrollViewRef}
				width={50}
				height={20}
				scrollDirection="vertical"
				initialScrollPosition="start"
			>
				<VeryLongList />
			</ScrollView>
		</Box>
	);
}

render(<App />);
