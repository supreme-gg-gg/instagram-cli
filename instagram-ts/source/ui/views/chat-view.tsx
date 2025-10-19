import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import {TerminalInfoProvider} from 'ink-picture';
import type {Thread, ChatState, Message} from '../../types/instagram.js';
import type {RealtimeStatus} from '../../client.js';
import MessageList from '../components/message-list.js';
import InputBox from '../components/input-box.js';
import StatusBar from '../components/status-bar.js';
import ThreadList from '../components/thread-list.js';
import ScrollView, {type ScrollViewRef} from '../components/scroll-view.js';
import {useClient} from '../context/client-context.js';
import {parseAndDispatchChatCommand} from '../../utils/chat-commands.js';
import FullScreen from '../components/full-screen.js';
import {useScreenSize} from '../hooks/use-screen-size.js';
import {preprocessMessage} from '../../utils/preprocess.js';

export default function ChatView() {
	const {exit} = useApp();
	const client = useClient();
	const {height, width} = useScreenSize();
	const scrollViewRef = useRef<ScrollViewRef | undefined>(undefined);

	const [chatState, setChatState] = useState<ChatState>({
		threads: [],
		messages: [],
		loading: true,
		currentThread: undefined,
		selectedMessageIndex: undefined,
		isSelectionMode: false,
	});
	const [currentView, setCurrentView] = useState<'threads' | 'chat'>('threads');
	const [realtimeStatus, setRealtimeStatus] =
		useState<RealtimeStatus>('disconnected');
	const [systemMessage, setSystemMessage] = useState<string | undefined>(
		undefined,
	);

	// Calculate available height for messages (total height minus status bar and input area)
	const messageAreaHeight = Math.max(1, height - 8);

	// Effect to clear system messages after a delay
	useEffect(() => {
		if (systemMessage) {
			const timer = setTimeout(() => {
				setSystemMessage(undefined);
			}, 3000); // Clear after 3 seconds
			return () => {
				clearTimeout(timer);
			};
		}

		// eslint-disable-next-line no-useless-return
		return;
	}, [systemMessage]);

	// Load threads when client is ready
	useEffect(() => {
		const loadThreads = async () => {
			if (!client) return;

			try {
				setChatState(previous => ({...previous, loading: true}));
				const threads = await client.getThreads();
				setChatState(previous => ({...previous, threads, loading: false}));
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'Failed to load threads';
				setChatState(previous => ({
					...previous,
					loading: false,
					error: errorMessage,
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
			if (message.threadId === chatState.currentThread?.id) {
				setChatState(prev => ({
					...prev,
					messages: [...prev.messages, message],
				}));

				// If scrollview is at bottom, scroll to bottom on new messages
				// Otherwise, the use might be reading older messages so just update state
				if (scrollViewRef.current) {
					const offset = scrollViewRef.current.getScrollOffset();
					const {height: contentHeight} =
						scrollViewRef.current.getContentSize();
					const isAtBottom = offset >= contentHeight - messageAreaHeight;

					if (isAtBottom) {
						// Small delay to allow message to render before scrolling
						setTimeout(() => {
							scrollViewRef.current?.scrollToEnd(false);
						}, 100);
					}
				}
			}
		};

		client.on('message', handleMessage);

		return () => {
			client.off('message', handleMessage);
		};
	}, [client, chatState.currentThread?.id, height, messageAreaHeight]);

	// Polling effect for messages when realtime client is disconnected
	useEffect(() => {
		let pollingInterval: NodeJS.Timeout | undefined;

		const pollForNewMessages = async () => {
			if (!client || !chatState.currentThread) {
				return;
			}

			try {
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
			pollingInterval = setInterval(pollForNewMessages, 5000);
		}

		return () => {
			if (pollingInterval) {
				clearInterval(pollingInterval);
			}
		};
	}, [client, chatState.currentThread, realtimeStatus]);

	useEffect(() => {
		return () => {
			if (realtimeStatus === 'connected' && client) {
				void client.shutdown();
			}
		};
	}, [client, realtimeStatus]);

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit();
			return;
		}

		if (key.escape && currentView === 'threads') {
			exit();
			return;
		}

		if (key.escape && currentView === 'chat') {
			if (chatState.isSelectionMode) {
				setChatState(previous => ({
					...previous,
					isSelectionMode: false,
					selectedMessageIndex: undefined,
				}));
			} else {
				setCurrentView('threads');
				setChatState(previous => ({
					...previous,
					currentThread: undefined,
					messages: [],
					selectedMessageIndex: undefined,
					isSelectionMode: false,
				}));
			}

			return;
		}

		if (chatState.isSelectionMode && currentView === 'chat') {
			if (input === 'j') {
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
				setChatState(previous => ({
					...previous,
					isSelectionMode: false,
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
			loading: true,
			messages: [],
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

		const {isCommand, systemMessage: cmdSystemMessage} =
			await parseAndDispatchChatCommand(text, {
				client,
				chatState,
				setChatState,
				height,
				scrollViewRef,
			});

		if (cmdSystemMessage) {
			setSystemMessage(cmdSystemMessage);
		}

		if (isCommand) {
			return; // Command was handled, no message to send
		}

		try {
			const processedText = await preprocessMessage(text, {
				client,
				threadId: chatState.currentThread.id,
			});

			if (processedText) {
				await client.sendMessage(chatState.currentThread.id, processedText);

				// Scroll to bottom after sending a message
				// Timeout to ensure message is rendered before scrolling
				const timeout = setTimeout(() => {
					if (scrollViewRef.current) {
						scrollViewRef.current.scrollToEnd(false);
					}
				}, 1000);

				return () => {
					clearTimeout(timeout);
				};
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to send message';
			setSystemMessage(errorMessage);
		}

		// eslint-disable-next-line no-useless-return
		return;
	};

	const handleOnScrollToBottom = () => {
		setSystemMessage('Scrolled to bottom');
	};

	const handleOnScrollToTop = async () => {
		if (!chatState.messageCursor || !client || !chatState.currentThread) {
			return;
		}

		setChatState(previous => ({...previous, loading: true}));
		try {
			const {messages, cursor} = await client.getMessages(
				chatState.currentThread.id,
				chatState.messageCursor,
			);
			setChatState(previous => ({
				...previous,
				messages: [...messages, ...previous.messages],
				loading: false,
				messageCursor: cursor,
			}));
			setSystemMessage(`Loaded ${messages.length} more messages.`);
		} catch {
			setChatState(previous => ({...previous, loading: false}));
			setSystemMessage('Failed to load more messages.');
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

		if (currentView === 'threads') {
			return (
				<ThreadList threads={chatState.threads} onSelect={handleThreadSelect} />
			);
		}

		return (
			<Box flexDirection="column" height="100%">
				{!chatState.loading || chatState.messages.length > 0 ? (
					<ScrollView
						ref={scrollViewRef}
						width={width}
						height={messageAreaHeight}
						initialScrollPosition="end"
						onScrollToStart={handleOnScrollToTop}
						onScrollToEnd={handleOnScrollToBottom}
					>
						<MessageList
							messages={chatState.messages}
							currentThread={chatState.currentThread}
							selectedMessageIndex={chatState.selectedMessageIndex}
						/>
					</ScrollView>
				) : (
					<Box
						flexGrow={1}
						justifyContent="center"
						alignItems="center"
						paddingY={1}
					>
						<Text>Loading messages...</Text>
					</Box>
				)}
				<Box flexShrink={0} flexDirection="column">
					{systemMessage && (
						<Box marginTop={1}>
							<Text color="yellow">{systemMessage}</Text>
						</Box>
					)}
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
								? 'j/k: navigate, Enter: select, Esc: quit'
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
