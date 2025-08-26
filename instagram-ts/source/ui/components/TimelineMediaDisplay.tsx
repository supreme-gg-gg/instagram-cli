import React from 'react';
import {Box, Text} from 'ink';
import {FeedInstance} from '../../types/instagram.js';

type Props = {
	feed: FeedInstance;
	asciiFeed: string[][];
};

export default function TimelineMediaDisplay({feed, asciiFeed}: Props) {
	const posts = feed.posts || [];
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
						{asciiFeed[index]?.[0] ? (
							asciiFeed[index]?.[0]
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
