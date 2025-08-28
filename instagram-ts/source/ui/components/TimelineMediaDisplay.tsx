import React from 'react';
import {Box, Text} from 'ink';
import {FeedItem} from '../../types/instagram.js';
import Image from './image/index.js';

type Props = {
	feedItems: FeedItem[];
	imageUrls: string[];
	protocol?: string;
};

export default function TimelineMediaDisplay({
	feedItems,
	imageUrls,
	protocol,
}: Props) {
	return (
		<Box flexDirection="column" flexGrow={1} gap={1}>
			<Text color="blue">Your Feed</Text>
			{feedItems.map((item, index) => (
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
					{imageUrls[index] && imageUrls[index] !== 'No image' ? (
						<Box borderStyle="round" borderColor="cyan" width={32} height={17}>
							<Image
								src={imageUrls[index]!}
								alt={item.caption?.text || `Post by ${item.user?.username}`}
								protocol={protocol}
							/>
						</Box>
					) : (
						<Text color="yellow">⏳ No media available...</Text>
					)}
					<Text>{'\n'}</Text>
					<Text wrap="wrap">{item.caption?.text || 'No caption'}</Text>
					<Text>{'\n'}</Text>
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
			))}
		</Box>
	);
}
