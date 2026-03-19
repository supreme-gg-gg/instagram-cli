import path from 'node:path';
import React, {useState} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import {Spinner} from '@inkjs/ui';
import Image from 'ink-picture';
import type {InstagramClient} from '../../client.js';
import FileBrowser from '../components/file-browser.js';
import {useImageProtocol} from '../hooks/use-image-protocol.js';

type Screen = 'browsing' | 'options' | 'confirm' | 'posting' | 'result';

type PostStoryViewProps = {
	readonly client: InstagramClient;
};

function OptionsScreen({
	closeFriends,
	onToggle,
	onConfirm,
	onBack,
}: {
	readonly closeFriends: boolean;
	readonly onToggle: () => void;
	readonly onConfirm: () => void;
	readonly onBack: () => void;
}) {
	useInput((input, key) => {
		if (key.tab || key.leftArrow || key.rightArrow) {
			onToggle();
		} else if (key.return) {
			onConfirm();
		} else if (key.escape || input === 'b') {
			onBack();
		}
	});

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>Audience</Text>
			<Box gap={2}>
				<Text
					backgroundColor={closeFriends ? undefined : 'white'}
					color={closeFriends ? undefined : 'black'}
				>
					{' Everyone '}
				</Text>
				<Text
					color={closeFriends ? 'black' : undefined}
					backgroundColor={closeFriends ? 'white' : undefined}
				>
					{' Close Friends '}
				</Text>
			</Box>
			<Text dimColor>Tab or ←→ to toggle · Enter confirm · Esc/b back</Text>
		</Box>
	);
}

function ConfirmScreen({
	filePath,
	closeFriends,
	onConfirm,
	onBack,
}: {
	readonly filePath: string;
	readonly closeFriends: boolean;
	readonly onConfirm: () => void;
	readonly onBack: () => void;
}) {
	const ext = path.extname(filePath).toLowerCase();
	const mediaType = ext === '.mp4' ? 'video' : 'image';
	const imageProtocol = useImageProtocol();

	useInput((input, key) => {
		if (key.return) {
			onConfirm();
		} else if (key.escape || input === 'b') {
			onBack();
		}
	});

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>Ready to post</Text>
			<Box flexDirection="column">
				<Text>
					<Text color="gray">File: </Text>
					{path.basename(filePath)}
				</Text>
				<Text>
					<Text color="gray">Type: </Text>
					{mediaType}
				</Text>
				<Text>
					<Text color="gray">Audience: </Text>
					{closeFriends ? 'Close Friends' : 'Everyone'}
				</Text>
			</Box>
			{imageProtocol && (
				<Image
					src={`file://${filePath}`}
					width={20}
					height={10}
					protocol={imageProtocol}
				/>
			)}
			<Text dimColor color="yellow">
				Note: ensure your file meets Instagram&apos;s format requirements
				(image: JPG/PNG, video: H.264 MP4 ≤ 60s).
			</Text>
			<Text dimColor>Enter to post · Esc/b back</Text>
		</Box>
	);
}

function ResultScreen({
	error,
	onRetry,
}: {
	readonly error: string | undefined;
	readonly onRetry: () => void;
}) {
	const {exit} = useApp();

	useInput((input, _key) => {
		if (error) {
			if (input === 'r') onRetry();
			else if (input === 'q') exit();
		} else {
			exit();
		}
	});

	if (error) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text color="red">Failed to post story: {error}</Text>
				<Text dimColor>[r] retry · [q] quit</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="green">
				Story posted successfully!
			</Text>
			<Text dimColor>Press any key to exit</Text>
		</Box>
	);
}

export default function PostStoryView({client}: PostStoryViewProps) {
	const [screen, setScreen] = useState<Screen>('browsing');
	const [selectedFile, setSelectedFile] = useState<string | undefined>();
	const [closeFriends, setCloseFriends] = useState(false);
	const [postError, setPostError] = useState<string | undefined>();
	const {exit} = useApp();

	const handleFileSelect = (filePath: string) => {
		setSelectedFile(filePath);
		setScreen('options');
	};

	const handlePost = async () => {
		if (!selectedFile) return;
		setScreen('posting');
		try {
			await client.postStory(selectedFile, {closeFriends});
			setPostError(undefined);
			setScreen('result');
		} catch (error) {
			setPostError(error instanceof Error ? error.message : String(error));
			setScreen('result');
		}
	};

	if (screen === 'browsing') {
		return (
			<FileBrowser
				onExit={() => {
					exit();
				}}
				onSelect={handleFileSelect}
			/>
		);
	}

	if (screen === 'options') {
		return (
			<OptionsScreen
				closeFriends={closeFriends}
				onToggle={() => {
					setCloseFriends(cf => !cf);
				}}
				onConfirm={() => {
					setScreen('confirm');
				}}
				onBack={() => {
					setScreen('browsing');
				}}
			/>
		);
	}

	if (screen === 'confirm') {
		return (
			<ConfirmScreen
				filePath={selectedFile!}
				closeFriends={closeFriends}
				onConfirm={() => {
					void handlePost();
				}}
				onBack={() => {
					setScreen('options');
				}}
			/>
		);
	}

	if (screen === 'posting') {
		return (
			<Box>
				<Spinner label="Posting story…" />
			</Box>
		);
	}

	// result
	return (
		<ResultScreen
			error={postError}
			onRetry={() => {
				setScreen('confirm');
			}}
		/>
	);
}
