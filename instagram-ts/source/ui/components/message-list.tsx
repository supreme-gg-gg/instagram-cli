import React from 'react';
import {Box, Text} from 'ink';
import Image from 'ink-picture';
import type {Message, Thread} from '../../types/instagram.js';
import {useImageProtocol} from '../hooks/use-image-protocol.js';

type MessageListProperties = {
	readonly messages: Message[];
	readonly currentThread?: Thread;
	readonly selectedMessageIndex?: number | undefined;
};

export default function MessageList({
	messages,
	currentThread,
	selectedMessageIndex,
}: MessageListProperties) {
	const imageProtocol = useImageProtocol();

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const renderMessageContent = (message: Message) => {
		switch (message.itemType) {
			case 'text': {
				return <Text>{message.text}</Text>;
			}

			case 'media': {
				const {media} = message;
				// Video
				if (media.media_type === 2) {
					const videoUrl = media.video_versions?.[0]?.url;
					return <Text dimColor>{`[Sent a video: ${videoUrl}]`}</Text>;
				}

				// Image
				const imageUrl = media.image_versions2?.candidates[0]?.url;
				if (imageUrl) {
					return (
						<Box
							borderStyle="round"
							borderColor="cyan"
							width={32}
							height={17}
							flexDirection="column"
						>
							<Image src={imageUrl} alt="Sent image" protocol={imageProtocol} />
						</Box>
					);
				}

				return <Text dimColor>[Sent an image]</Text>;
			}

			case 'link': {
				return (
					<Text>
						{message.link.text}
						<Text color="gray"> ({message.link.url})</Text>
					</Text>
				);
			}

			default: {
				return <Text dimColor>{(message as any).text}</Text>;
			}
		}
	};

	if (messages.length === 0) {
		return (
			<Box flexGrow={1} justifyContent="center" alignItems="center">
				<Text dimColor>
					{currentThread
						? 'No messages in this thread. Be the first to say hi!'
						: 'Select a thread to view messages'}
				</Text>
			</Box>
		);
	}

	return (
		<Box flexShrink={0} flexDirection="column" flexGrow={1} paddingX={1}>
			<Box flexShrink={0} flexDirection="column" flexGrow={1}>
				{messages.map((message, index) => {
					const isSelected = selectedMessageIndex === index;

					const reactionCounts: Record<string, number> = {};
					if (message.reactions) {
						for (const reaction of message.reactions) {
							reactionCounts[reaction.emoji] =
								(reactionCounts[reaction.emoji] ?? 0) + 1;
						}
					}

					return (
						<Box
							key={message.id}
							flexDirection="column"
							flexShrink={0}
							marginBottom={1}
							borderStyle={isSelected ? 'round' : undefined}
							borderColor={isSelected ? 'yellow' : undefined}
							paddingX={isSelected ? 1 : 0}
						>
							<Box justifyContent="space-between">
								<Text bold color={message.isOutgoing ? 'cyan' : 'greenBright'}>
									{message.isOutgoing ? 'You' : message.username}
								</Text>
								<Text dimColor>{formatTime(message.timestamp)}</Text>
							</Box>
							<Box flexDirection="column">
								{message.repliedTo && (
									<Box
										flexDirection="column"
										borderLeftColor="gray"
										paddingLeft={1}
										marginBottom={1}
									>
										<Text dimColor>
											Replying to <Text bold>{message.repliedTo.username}</Text>
										</Text>
										<Text dimColor>
											{message.repliedTo.itemType === 'text'
												? `"${message.repliedTo.text?.slice(0, 40) ?? ''}${
														message.repliedTo.text &&
														message.repliedTo.text.length > 40
															? '...'
															: ''
													}"`
												: `[A ${message.repliedTo.itemType}]`}
										</Text>
									</Box>
								)}
								{renderMessageContent(message)}
								{message.reactions && message.reactions.length > 0 && (
									<Box rowGap={1}>
										{Object.entries(reactionCounts).map(([emoji, count]) => (
											<Text key={emoji}>
												{emoji} <Text dimColor>{count}</Text>
											</Text>
										))}
									</Box>
								)}
							</Box>
						</Box>
					);
				})}
			</Box>
		</Box>
	);
}
