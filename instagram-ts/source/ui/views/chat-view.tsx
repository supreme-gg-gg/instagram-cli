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
import {preprocessMessage} from '../../utils/preprocess.js';

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
		selectedMessageIndex: undefined,
		isSelectionMode: false,
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

	// Effect for realtime status and errors (no thread dependency)
	useEffect(() => {
		if (!client) return;

		const handleRealtimeStatus = (status: RealtimeStatus) => {
			setRealtimeStatus(status);
		};

		const handleError = (error: Error) => {
			setChatState(prev => ({...prev, error: error.message, loading: false}));
		};

		client.on('realtimeStatus', handleRealtimeStatus);
		client.on('error', handleError);

		// Emit the current status immediately in case we missed the initial event
		// This might be a temporary fix but it seems like the logic follows through?
		client.emit('realtimeStatus', client.getRealtimeStatus());

		return () => {
			client.off('realtimeStatus', handleRealtimeStatus);
			client.off('error', handleError);
		};
	}, [client]);

	// Effect for message events (needs thread dependency)
	useEffect(() => {
		if (!client) return;

		const handleMessage = (message: Message) => {
			// We only care about events about THIS thread
			// Tho in the future we can use this to send notifications in the app as new messages lands
			if (message.threadId === chatState.currentThread?.id) {
				setChatState(prev => ({
					...prev,
					messages: [...prev.messages, message],
				}));
			}
		};

		client.on('message', handleMessage);

		return () => {
			client.off('message', handleMessage);
		};
	}, [client, chatState.currentThread?.id]);

	// Polling effect for messages when realtime client is disconnected
	useEffect(() => {
		let pollingInterval: NodeJS.Timeout | undefined;

		const pollForNewMessages = async () => {
			if (!client || !chatState.currentThread) {
				return;
			}

			try {
				// Fetch the latest messages without a cursor to get the most recent ones
				const {messages: latestMessages} = await client.getMessages(
					chatState.currentThread.id,
				);

				setChatState(previous => {
					const existingMessageIds = new Set(previous.messages.map(m => m.id));
					const newMessages = latestMessages.filter(
						m => !existingMessageIds.has(m.id),
					);

					if (newMessages.length > 0) {
						return {
							...previous,
							messages: [...previous.messages, ...newMessages],
						};
					}

					return previous;
				});
			} catch (error) {
				console.error('Polling for new messages failed:', error);
				// Optionally, set an error state in chatState if needed
				setChatState(previous => ({
					...previous,
					error:
						error instanceof Error
							? error.message
							: 'Failed to poll for new messages',
				}));
			}
		};

		if (realtimeStatus === 'disconnected' && chatState.currentThread) {
			// Start polling only if realtime is disconnected and a thread is selected
			pollingInterval = setInterval(pollForNewMessages, 5000); // Poll every 5 seconds
		}

		return () => {
			if (pollingInterval) {
				clearInterval(pollingInterval);
			}
		};
	}, [client, chatState.currentThread, realtimeStatus]);

	useEffect(() => {
		// When unmounts call the destructor for the client
		return () => {
			if (realtimeStatus === 'connected' && client) {
				// We don't await this because cleanup functions must be synchronous
				void client.shutdown();
			}
		};
	}, [client, realtimeStatus]);

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
			if (chatState.isSelectionMode) {
				// Exit selection mode
				setChatState(previous => ({
					...previous,
					isSelectionMode: false,
					selectedMessageIndex: undefined,
				}));
			} else {
				// Exit chat view
				setCurrentView('threads');
				setChatState(previous => ({
					...previous,
					currentThread: undefined,
					messages: [],
					visibleMessageOffset: 0,
					selectedMessageIndex: undefined,
					isSelectionMode: false,
				}));
			}

			return;
		}

		// Handle j/k navigation in selection mode
		if (chatState.isSelectionMode && currentView === 'chat') {
			if (input === 'j') {
				// Move down (next message)
				setChatState(previous => {
					const maxIndex = Math.max(0, previous.messages.length - 1);
					const newIndex =
						previous.selectedMessageIndex === undefined
							? maxIndex
							: Math.min(maxIndex, previous.selectedMessageIndex + 1);
					return {
						...previous,
						selectedMessageIndex: newIndex,
					};
				});
			} else if (input === 'k') {
				// Move up (previous message)
				setChatState(previous => {
					const newIndex =
						previous.selectedMessageIndex === undefined
							? Math.max(0, previous.messages.length - 1)
							: Math.max(0, previous.selectedMessageIndex - 1);
					return {
						...previous,
						selectedMessageIndex: newIndex,
					};
				});
			} else if (key.return) {
				// Confirm selection and exit selection mode
				// Keep the selectedMessageIndex so commands can use it
				setChatState(previous => ({
					...previous,
					isSelectionMode: false,
					// SelectedMessageIndex remains the same
				}));
			}
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

		// First, check for client-side chat commands (e.g., :help, :select)
		const isCommand = await parseAndDispatchChatCommand(text, {
			client,
			chatState,
			setChatState,
			height,
		});
		if (isCommand) {
			return; // Command was handled, no message to send
		}

		try {
			// Preprocess the message for special syntax like @<file> or :emoji:
			const processedText = await preprocessMessage(text, {
				client,
				threadId: chatState.currentThread.id,
			});

			// Only send the message if there is content left after processing, i.e. if only an image was sent, skip sending an empty message
			if (processedText) {
				await client.sendMessage(chatState.currentThread.id, processedText);
			}
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
						selectedMessageIndex={chatState.selectedMessageIndex}
					/>
				</Box>
				<Box flexShrink={0}>
					<InputBox
						isDisabled={chatState.isSelectionMode}
						onSend={handleSendMessage}
					/>
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
								: chatState.isSelectionMode
									? 'j/k: navigate messages, Enter: confirm, Esc: exit selection'
									: 'Esc: back to threads, Ctrl+C: quit'}
						</Text>
					</Box>
				</Box>
			</TerminalInfoProvider>
		</FullScreen>
	);
}
