import React from 'react';
import {Box, Text} from 'ink';
import {FeedInstance} from '../../types/instagram.js';

export default function TimelineMediaDisplay({posts}: FeedInstance) {
	return (
		<Box flexDirection="column" flexGrow={1} gap={1}>
			<Text color="blue">Your Feed</Text>
			{posts.map((item, index) => (
				<Box key={item.id} flexDirection="column" borderStyle="round">
					padding={1}
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
					<Box flexDirection="column">
						{posts[index]?.ascii_image ? (
							posts[index].ascii_image
								.split('\n')
								.map((line, i) => <Text key={i}>{line}</Text>)
						) : (
							<Text color="yellow">⏳ Loading media...</Text>
						)}
					</Box>
					<Text>{'\n'}</Text>
					<Text>{item.caption?.text || 'No caption'}</Text>
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
