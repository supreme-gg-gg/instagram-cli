import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import {TerminalInfoProvider} from 'ink-picture';
import type {Thread, ChatState, Message} from '../../types/instagram.js';
import type {RealtimeStatus} from '../../client.js';
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
	const [realtimeStatus, setRealtimeStatus] =
		useState<RealtimeStatus>('disconnected');

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

	// Effect for client events (realtime, errors, etc.)
	useEffect(() => {
		if (!client) return;

		const handleRealtimeStatus = (status: RealtimeStatus) => {
			setRealtimeStatus(status);
		};

		const handleError = (error: Error) => {
			setChatState(prev => ({...prev, error: error.message, loading: false}));
		};

		const handleMessage = (message: Message) => {
			if (message.threadId === chatState.currentThread?.id) {
				setChatState(prev => ({
					...prev,
					messages: [...prev.messages, message],
				}));
			}
		};

		client.on('realtimeStatus', handleRealtimeStatus);
		client.on('error', handleError);
		client.on('message', handleMessage);

		return () => {
			client.off('realtimeStatus', handleRealtimeStatus);
			client.off('error', handleError);
			client.off('message', handleMessage);
		};
	}, [client, chatState.currentThread?.id]);

	useEffect(() => {
		// When unmounts call the destructor for the client
		return () => {
			if (client) {
				// We don't await this because cleanup functions must be synchronous
				void client.shutdown();
			}
		};
	}, [client]);

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
		const isCommand = await parseAndDispatchChatCommand(text, {
			client,
			chatState,
			setChatState,
			height,
		});
		if (isCommand) {
			return;
		}

		try {
			// Send the message. If using MQTT, the message will be received via the 'message' event.
			// If falling back to the API, it will appear on the next history fetch (e.g., chat reopen).
			await client.sendMessage(chatState.currentThread.id, text);
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
			<Box flexDirection="column" height="100%">
				<Box flexGrow={1} overflow="hidden">
					<MessageList
						messages={visibleMessages}
						currentThread={chatState.currentThread}
					/>
				</Box>
				<Box flexShrink={0}>
					<InputBox onSend={handleSendMessage} />
				</Box>
			</Box>
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
						realtimeStatus={realtimeStatus}
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
