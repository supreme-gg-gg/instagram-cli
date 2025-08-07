import React from 'react';
import {Box, Text} from 'ink';
import {FeedItem} from '../../types/instagram.js';
import AsciiImage from '../components/AsciiImage.js';

type Props = {
	feedItems: FeedItem[];
	width?: number;
};

export default function MediaView({feedItems}: Props) {
	return (
		<Box flexDirection="column" gap={1}>
			<Text color="blue">Your Feed</Text>
			{feedItems.map(item => {
				const url = item.image_versions2?.candidates?.[0]?.url;

				return (
					<Box
						key={item.id}
						flexDirection="column"
						borderStyle="round"
						padding={1}
					>
						<Box flexDirection="row">
							<Text color="green">
								👤 {item.user?.username || 'Unknown user'}
							</Text>
							<Text color="gray">
								{' ('}
								{new Date(item.taken_at * 1000).toLocaleString()}
								{')'}
							</Text>
						</Box>
						<Text>{'\n'}</Text>
						<Text>{item.caption?.text || 'No caption'}</Text>
						<Text>{'\n'}</Text>

						<Box flexDirection="column">
							{/* TODO: Handling properly posts with multiple images */}
							{url ? (
								<AsciiImage url={url} />
							) : (
								<Text color="yellow">⏳ No media found...</Text>
							)}
						</Box>
						<Box flexDirection="row">
							<Text>
								{' '}
								♡ {item.like_count ?? 0}
								{'   '}
							</Text>
							<Text>
								🗨{'  '}
								{item.comment_count ?? 0}
							</Text>
						</Box>
					</Box>
				);
			})}
		</Box>
	);
}
