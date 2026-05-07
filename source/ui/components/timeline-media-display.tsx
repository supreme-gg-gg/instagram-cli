import React from 'react';
import {Box, Text} from 'ink';
import Image, {type ImageProtocolName} from 'ink-picture';
import {type Post} from '../../types/instagram.js';

type Properties = {
	readonly posts: Post[];
	readonly protocol?: ImageProtocolName;
};

export default function TimelineMediaDisplay({posts, protocol}: Properties) {
	return (
		<Box flexDirection="column" flexGrow={1} gap={1}>
			<Text color="blue">Your Feed</Text>
			{posts.map(item => (
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
							{new Date(item.taken_at * 1000).toLocaleString()})
						</Text>
					</Box>
					<Text>{'\n'}</Text>
					{item.image_versions2?.candidates?.[0]?.url ? (
						<Box borderStyle="round" borderColor="cyan" width={32} height={17}>
							<Image
								src={item.image_versions2.candidates[0].url}
								alt={item.caption?.text ?? `Post by ${item.user?.username}`}
								protocol={protocol}
							/>
						</Box>
					) : (
						<Text color="yellow">⏳ No media available...</Text>
					)}
					<Text>{'\n'}</Text>
					<Text wrap="wrap">{item.caption?.text ?? 'No caption'}</Text>
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
