import React, {useRef, useState, useEffect} from 'react';
import {render, Box, Text, useInput} from 'ink';
import ScrollView, {type ScrollViewRef} from '../ui/components/scroll-view.js';

function VeryLongList() {
	const [items, setItems] = useState(
		Array.from({length: 5}, (_, i) => 'Item ' + (i + 1)),
	);
	useEffect(() => {
		const interval = setInterval(() => {
			setItems(prevItems => [...prevItems, 'Item ' + (prevItems.length + 1)]);
		}, 1000);
		return () => {
			clearInterval(interval);
		};
	}, []);

	return (
		<Box flexShrink={0} flexDirection="column">
			{items.map((item, index) => (
				<Text key={index}>{item}</Text>
			))}
		</Box>
	);
}

function App() {
	// eslint-disable-next-line @typescript-eslint/ban-types
	const scrollViewRef = useRef<ScrollViewRef | null>(null);
	const [message, setMessage] = useState('Use Up/Down arrows to scroll');

	useInput((...args) => {
		setMessage(''); // Clear message on input
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
				initialScrollPosition="end"
				onScrollToStart={() => {
					setMessage('Reached the top');
				}}
				onScrollToEnd={() => {
					setMessage('Reached the bottom');
				}}
			>
				<VeryLongList />
			</ScrollView>
			<Box marginTop={1}>
				<Text>{message}</Text>
			</Box>
		</Box>
	);
}

render(<App />);
