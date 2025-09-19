import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import {TerminalInfoProvider} from 'ink-picture';
import type {Thread, ChatState} from '../../types/instagram.js';
import MessageList from '../components/message-list.js';
import InputBox from '../components/input-box.js';
import StatusBar from '../components/status-bar.js';
import ThreadList from '../components/thread-list.js';
import {useClient} from '../context/client-context.js';
import {parseAndDispatchChatCommand} from '../../utils/chat-commands.js';
import FullScreen from '../components/full-screen.js';
import {useScreenSize} from '../hooks/use-screen-size.js';

export default function ChatView() {
	const {exit} = useApp();
	const client = useClient();
	const {height} = useScreenSize();

	const [chatState, setChatState] = useState<ChatState>({
		threads: [],
		messages: [],
		loading: true,
		currentThread: undefined,
		visibleMessageOffset: 0,
	});
	const [currentView, setCurrentView] = useState<'threads' | 'chat'>('threads');

	// Load threads when client is ready
	useEffect(() => {
		const loadThreads = async () => {
			if (!client) return;

			try {
				setChatState(previous => ({...previous, loading: true}));
				const threads = await client.getThreads();
				setChatState(previous => ({...previous, threads, loading: false}));
			} catch (error) {
				setChatState(previous => ({
					...previous,
					error:
						error instanceof Error ? error.message : 'Failed to load threads',
					loading: false,
				}));
			}
		};

		void loadThreads();
	}, [client]);

	// Poll for new messages
	useEffect(() => {
		if (
			currentView !== 'chat' ||
			!chatState.currentThread ||
			chatState.visibleMessageOffset > 0 // Don't poll when scrolled up
		)
			return;

		const interval = setInterval(async () => {
			if (!client || !chatState.currentThread) return;
			const {messages} = await client.getMessages(chatState.currentThread.id);
			setChatState(previous => ({...previous, messages}));
		}, 5000);

		return () => {
			clearInterval(interval);
		};
	}, [
		client,
		currentView,
		chatState.currentThread,
		chatState.visibleMessageOffset,
	]);

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit();
			return;
		}

		if (input === 'q' && currentView === 'threads') {
			exit();
			return;
		}

		if (key.escape && currentView === 'chat') {
			setCurrentView('threads');
			setChatState(previous => ({
				...previous,
				currentThread: undefined,
				messages: [],
				visibleMessageOffset: 0,
			}));
		}
	});

	const handleThreadSelect = async (thread: Thread) => {
		if (!client) return;

		setCurrentView('chat');
		setChatState(previous => ({
			...previous,
			currentThread: thread,
			messages: [],
			visibleMessageOffset: 0,
		}));

		try {
			const {messages, cursor} = await client.getMessages(thread.id);
			setChatState(previous => ({
				...previous,
				messages,
				loading: false,
				messageCursor: cursor,
			}));
		} catch (error) {
			setChatState(previous => ({
				...previous,
				error:
					error instanceof Error ? error.message : 'Failed to load messages',
				loading: false,
			}));
		}
	};

	const handleSendMessage = async (text: string) => {
		if (!client || !chatState.currentThread) return;

		// Check for chat command (starts with ':') and dispatch
		const handled = parseAndDispatchChatCommand(text, {
			client,
			chatState,
			setChatState,
			height,
		});
		if (handled) {
			return;
		}

		try {
			await client.sendMessage(chatState.currentThread.id, text);
			// Reload messages to show the new one
			const {messages} = await client.getMessages(chatState.currentThread.id);
			// Also reset to the bottom of the chat since we just sent a message
			setChatState(previous => ({
				...previous,
				messages,
				visibleMessageOffset: 0,
			}));
		} catch (error) {
			setChatState(previous => ({
				...previous,
				error:
					error instanceof Error ? error.message : 'Failed to send message',
			}));
		}
	};

	const renderContent = () => {
		if (chatState.loading && chatState.threads.length === 0) {
			return (
				<Box
					flexGrow={1}
					justifyContent="center"
					alignItems="center"
					paddingY={1}
				>
					<Text>Loading threads...</Text>
				</Box>
			);
		}

		if (chatState.error) {
			return (
				<Box
					flexGrow={1}
					justifyContent="center"
					alignItems="center"
					paddingY={1}
				>
					<Text color="red">Error: {chatState.error}</Text>
				</Box>
			);
		}

		if (currentView === 'threads') {
			return (
				<ThreadList threads={chatState.threads} onSelect={handleThreadSelect} />
			);
		}

		// Chat view
		// Calculate visible messages based on height and offset
		// offset is used to scroll through messages
		const messageLines = 3; // Approximate lines per message
		const visibleMessageCount = Math.max(
			0,
			Math.floor((height - 8) / messageLines),
		);

		const totalMessages = chatState.messages.length;
		const maxOffset = Math.max(0, totalMessages - visibleMessageCount);
		const currentOffset = Math.min(chatState.visibleMessageOffset, maxOffset);

		const startIndex = Math.max(
			0,
			totalMessages - visibleMessageCount - currentOffset,
		);
		const endIndex = Math.max(0, totalMessages - currentOffset);

		const visibleMessages = chatState.messages.slice(startIndex, endIndex);

		return (
			<>
				<MessageList
					messages={visibleMessages}
					currentThread={chatState.currentThread}
				/>
				<InputBox onSend={handleSendMessage} />
			</>
		);
	};

	return (
		<FullScreen>
			<TerminalInfoProvider>
				<Box flexDirection="column" height="100%" width="100%">
					<StatusBar
						currentView={currentView}
						currentThread={chatState.currentThread}
						isLoading={chatState.loading}
						error={chatState.error}
					/>

					<Box flexGrow={1} flexDirection="column">
						{renderContent()}
					</Box>

					<Box>
						<Text dimColor>
							{currentView === 'threads'
								? 'j/k: navigate, Enter: select, q: quit'
								: 'Esc: back to threads, Ctrl+C: quit'}
						</Text>
					</Box>
				</Box>
			</TerminalInfoProvider>
		</FullScreen>
	);
}
