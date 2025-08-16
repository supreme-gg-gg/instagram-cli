import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {FeedItem} from '../../types/instagram.js';
import open from 'open';


type Props = {
	feedItems: FeedItem[];
	asciiImages: string[];
};

export default function ListMediaDisplay({feedItems, asciiImages}: Props) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);

	if (feedItems.length === 0) {
		return <Text>No posts available.</Text>;
	}

	useInput((input, key) => {
		if (input === 'j' || key.downArrow) {
			setSelectedIndex(prev => Math.min(prev + 1, feedItems.length - 1));
		} else if (input === 'k' || key.upArrow) {
			setSelectedIndex(prev => Math.max(prev - 1, 0));
		}
		else if (input === 'o' || key.return) {
			// TODO: If media is a video, open the video URL instead
			const selectedItem = feedItems[selectedIndex];
			if (selectedItem && selectedItem.image_versions2?.candidates?.[0]?.url) {
				const url = selectedItem.image_versions2.candidates[0].url;
				open(url).catch(err => {
					console.error('Failed to open URL:', err);
				});
			}
		} else if (input === 'q' || key.escape) {
			process.exit(0);
		}
	});

	const selectedItem = feedItems[selectedIndex]!;
	const selectedAscii = asciiImages[selectedIndex]!;

	return (
		<Box flexDirection="column" height={process.stdout.rows} width="100%">
			{/* Main row */}
			<Box flexDirection="row" gap={2} flexGrow={1}>
				{/* Left column */}
				<Box
					flexDirection="column"
					borderStyle="round"
					paddingX={1}
					width={30}
					flexShrink={0}
					height="100%"
				>
					<Text color="cyan">📜 Feed</Text>
					<Box height={1} />
					{feedItems.map((item, index) => (
						<Text
							key={item.id}
							color={index === selectedIndex ? 'blue' : undefined}
							wrap="truncate"
						>
							{index === selectedIndex ? '➜ ' : '   '}
							{item.user?.username || 'Unknown'}
						</Text>
					))}
				</Box>

				{/* Right column */}
				<Box
					flexDirection="column"
					borderStyle="round"
					padding={1}
					flexGrow={1}
					height="100%"
					overflow="hidden"
				>
					<Box flexDirection="row">
						<Text color="green">
							👤 {selectedItem.user?.username || 'Unknown user'}
						</Text>
						<Text color="gray">
							{' ('}
							{new Date(selectedItem.taken_at * 1000).toLocaleString()}
							{')'}
						</Text>
					</Box>

					<Text>{'\n'}</Text>

					<Box flexDirection="column" flexGrow={1} overflow="hidden">
						{selectedAscii ? (
							selectedAscii.split('\n').map((line, i) => (
								<Text key={i} wrap="truncate">
									{line}
								</Text>
							))
						) : (
							<Text color="yellow">⏳ Loading media...</Text>
						)}
					</Box>

					<Text wrap="wrap">{selectedItem.caption?.text || 'No caption'}</Text>

					<Text>{'\n'}</Text>

					<Box flexDirection="row">
						<Text>
							{' '}
							♡ {selectedItem.like_count ?? 0}
							{'   '}
						</Text>
						<Text>
							🗨{'  '}
							{selectedItem.comment_count ?? 0}
						</Text>
					</Box>
				</Box>
			</Box>

			{/* Footer */}
			<Box marginTop={1}>
				<Text dimColor>j/k: navigate, o: open in browser, q: quit</Text>
			</Box>
		</Box>
	);
}
