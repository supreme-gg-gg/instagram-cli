import React from 'react';
import {Box, Text, useInput} from 'ink';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import {argument} from 'pastel';
import {useInstagramClient} from '../ui/hooks/use-instagram-client.js';
import {createContextualLogger} from '../utils/logger.js';
import type {LiveBroadcast, LiveGuest} from '../types/instagram.js';
import {streamToRtmp} from '../utils/video-capture.js';
import {mockClient} from '../mocks/index.js';

export const args = zod.tuple([
	zod
		.string()
		.optional()
		.describe(
			argument({
				name: 'username',
				description: 'Username to use for live streaming (optional)',
			}),
		),
]);

export const options = zod.object({
	device: zod
		.string()
		.optional()
		.describe('Camera device to use (default: auto-detect)'),
	width: zod
		.number()
		.optional()
		.default(1280)
		.describe('Video width (default: 1280)'),
	height: zod
		.number()
		.optional()
		.default(720)
		.describe('Video height (default: 720)'),
	fps: zod
		.number()
		.optional()
		.default(30)
		.describe('Frames per second (default: 30)'),
	demo: zod
		.boolean()
		.optional()
		.default(false)
		.describe('Demo mode: Test the feature without requiring 1000+ followers'),
});

type Properties = {
	readonly args: zod.infer<typeof args>;
	readonly options: zod.infer<typeof options>;
};

const logger = createContextualLogger('LiveCommand');

export default function Live({args, options: opts}: Properties) {
	const {
		client: realClient,
		isLoading,
		error,
	} = useInstagramClient(args[0], {
		realtime: false,
	});

	// Use mock client in demo mode
	const client = opts.demo ? mockClient : realClient;

	const [broadcast, setBroadcast] = React.useState<LiveBroadcast | undefined>();
	const [guests, setGuests] = React.useState<LiveGuest[]>([]);
	const [streamError, setStreamError] = React.useState<string | undefined>();
	const [isStreaming, setIsStreaming] = React.useState(false);
	const [streamProcess, setStreamProcess] = React.useState<
		| {
				stop: () => void;
		  }
		| undefined
	>(undefined);

	// Handle keyboard input
	useInput((input, key) => {
		if (key.escape || (key.ctrl && input === 'c')) {
			void handleEndStream();
		} else if (input === 'i' && broadcast) {
			// Invite guest - prompt for username
			// This is a simplified version; in a full implementation,
			// you'd want a proper input prompt
			logger.info(
				'Guest invitation feature - use the inviteGuestToLive method',
			);
		} else if (input === 's' && broadcast && !isStreaming) {
			void handleStartStream();
		} else if (input === 'e' && broadcast && isStreaming) {
			void handleEndStream();
		}
	});

	const handleCreateBroadcast = React.useCallback(async () => {
		if (!client) {
			return;
		}

		try {
			logger.info('Creating live broadcast...');
			const newBroadcast = await client.createLiveBroadcast(
				opts.width,
				opts.height,
			);
			setBroadcast(newBroadcast);
			logger.info(`Broadcast created: ${newBroadcast.broadcastId}`);
		} catch (error_) {
			const errorMessage =
				error_ instanceof Error ? error_.message : String(error_);
			logger.error(`Failed to create broadcast: ${errorMessage}`);
			setStreamError(`Failed to create broadcast: ${errorMessage}`);
		}
	}, [client, opts.width, opts.height]);

	const handleStartStream = React.useCallback(async () => {
		if (!client || !broadcast) {
			return;
		}

		try {
			logger.info('Starting live broadcast...');
			await client.startLiveBroadcast(broadcast.broadcastId);

			// Only start actual video streaming if not in demo mode
			if (opts.demo) {
				logger.info('Demo mode: Video streaming simulated');
			} else {
				// Start streaming video to RTMP
				logger.info('Starting video stream from camera...');
				const stream = streamToRtmp(
					broadcast.rtmpStreamUrl,
					broadcast.streamKey,
					{
						device: opts.device,
						width: opts.width,
						height: opts.height,
						fps: opts.fps,
					},
				);

				setStreamProcess(stream);
				logger.info('Video stream started');
			}

			setIsStreaming(true);

			// Update broadcast status
			const updatedBroadcast: LiveBroadcast = {...broadcast, status: 'started'};
			setBroadcast(updatedBroadcast);

			logger.info('Live stream started successfully!');
		} catch (error_) {
			const errorMessage =
				error_ instanceof Error ? error_.message : String(error_);
			logger.error(`Failed to start stream: ${errorMessage}`);
			setStreamError(`Failed to start stream: ${errorMessage}`);
		}
	}, [client, broadcast, opts]);

	const handleEndStream = React.useCallback(async () => {
		if (!client || !broadcast) {
			return;
		}

		try {
			logger.info('Ending live broadcast...');

			// Stop video stream
			if (streamProcess) {
				streamProcess.stop();
				setStreamProcess(undefined);
			}

			// End broadcast on Instagram
			await client.endLiveBroadcast(broadcast.broadcastId);

			setIsStreaming(false);
			const updatedBroadcast: LiveBroadcast = {...broadcast, status: 'ended'};
			setBroadcast(updatedBroadcast);

			logger.info('Live stream ended successfully!');
		} catch (error_) {
			const errorMessage =
				error_ instanceof Error ? error_.message : String(error_);
			logger.error(`Failed to end stream: ${errorMessage}`);
			setStreamError(`Failed to end stream: ${errorMessage}`);
		}
	}, [client, broadcast, streamProcess]);

	// Guest invitation functionality is available via client.inviteGuestToLive()
	// This can be extended with a proper UI input prompt in the future

	// Auto-create broadcast on mount
	React.useEffect(() => {
		if (client && !broadcast && !isLoading) {
			void handleCreateBroadcast();
		}
	}, [client, broadcast, isLoading, handleCreateBroadcast]);

	// Poll for broadcast status and viewer count
	React.useEffect(() => {
		if (!client || !broadcast || !isStreaming) {
			return;
		}

		let errorCount = 0;
		const maxErrors = 3; // Stop polling after 3 consecutive errors

		// Use Node.js global setInterval
		const interval = globalThis.setInterval(async () => {
			try {
				const status = await client.getLiveBroadcastStatus(
					broadcast.broadcastId,
				);
				setBroadcast(status);

				// Refresh guest list
				const updatedGuests = await client.getLiveGuests(broadcast.broadcastId);
				setGuests(updatedGuests);

				// Reset error count on success
				errorCount = 0;
			} catch (error_) {
				errorCount++;
				logger.error('Failed to update broadcast status', error_);

				// Stop polling after persistent errors
				if (errorCount >= maxErrors) {
					logger.warn(
						'Stopping status polling due to persistent errors. Please check your connection.',
					);
					setStreamError(
						'Status updates stopped due to persistent errors. The stream may still be active.',
					);
					globalThis.clearInterval(interval);
				}
			}
		}, 5000); // Update every 5 seconds

		return () => {
			globalThis.clearInterval(interval);
		};
	}, [client, broadcast, isStreaming]);

	// Cleanup on unmount
	React.useEffect(() => {
		return () => {
			if (streamProcess) {
				streamProcess.stop();
			}

			if (client && broadcast && isStreaming) {
				void client.endLiveBroadcast(broadcast.broadcastId).catch(() => {
					// Ignore errors during cleanup
				});
			}
		};
	}, [streamProcess, client, broadcast, isStreaming]);

	if (isLoading) {
		return <Alert variant="info">Initializing Instagram client...</Alert>;
	}

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	if (streamError) {
		return <Alert variant="error">{streamError}</Alert>;
	}

	if (!broadcast) {
		return <Alert variant="info">Creating live broadcast...</Alert>;
	}

	return (
		<Box flexDirection="column" padding={1}>
			{opts.demo && (
				<Box marginBottom={1}>
					<Text bold color="yellow">
						🎭 DEMO MODE - No real streaming, testing UI only
					</Text>
				</Box>
			)}
			<Box flexDirection="column" marginBottom={1}>
				<Text bold color="green">
					🔴 Live Stream Status
				</Text>
				<Text>
					Broadcast ID: <Text color="cyan">{broadcast.broadcastId}</Text>
				</Text>
				<Text>
					Status:{' '}
					<Text
						color={
							broadcast.status === 'started'
								? 'green'
								: broadcast.status === 'ended'
									? 'red'
									: 'yellow'
						}
					>
						{broadcast.status.toUpperCase()}
					</Text>
				</Text>
				{broadcast.status === 'started' && (
					<Text>
						Viewers: <Text color="cyan">{broadcast.viewerCount}</Text>
					</Text>
				)}
			</Box>

			{broadcast.status === 'created' && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="yellow">Press &#39;s&#39; to start streaming</Text>
					<Text color="gray">
						Press &#39;Esc&#39; or &#39;Ctrl+C&#39; to cancel
					</Text>
				</Box>
			)}

			{broadcast.status === 'started' && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="green">✅ Streaming live!</Text>
					<Text color="gray">Press &#39;e&#39; to end stream</Text>
					<Text color="gray">
						Press &#39;Esc&#39; or &#39;Ctrl+C&#39; to end stream
					</Text>
				</Box>
			)}

			{guests.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text bold color="blue">
						Guests ({guests.length}):
					</Text>
					{guests.map(guest => (
						<Text key={guest.userId}>
							- @{guest.username} ({guest.status})
						</Text>
					))}
				</Box>
			)}

			<Box flexDirection="column" marginTop={2}>
				<Text dimColor color="gray">
					Note: This uses Instagram&#39;s private mobile API. Make sure ffmpeg
					is installed for video capture.
				</Text>
				<Box marginTop={1}>
					<Text dimColor color="yellow">
						⚠️ Live streaming requires a public account with 1000+ followers.
					</Text>
				</Box>
			</Box>
		</Box>
	);
}
