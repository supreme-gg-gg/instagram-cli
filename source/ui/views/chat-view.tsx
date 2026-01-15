import React, {useState, useEffect, useRef, useCallback} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import {TerminalInfoProvider} from 'ink-picture';
import type {
	Thread,
	ChatState,
	Message,
	Post,
	ReactionEvent,
	SeenEvent,
	TextMessage,
} from '../../types/instagram.js';
import type {RealtimeStatus, SearchResult} from '../../client.js';
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
import SearchInput from '../components/search-input.js';
import SinglePostView from '../components/single-post-view.js';
import {useImageProtocol} from '../hooks/use-image-protocol.js';

type SearchMode = 'username' | 'title' | undefined;

type ChatViewProps = {
	readonly initialSearchQuery?: string;
	readonly initialSearchMode?: SearchMode;
};

export default function ChatView({
	initialSearchQuery,
	initialSearchMode,
}: ChatViewProps) {
	const {exit} = useApp();
	const client = useClient();
	const {height, width} = useScreenSize();
	const scrollViewRef = useRef<ScrollViewRef | undefined>(undefined);

	const [chatState, setChatState] = useState<ChatState>({
		threads: [],
		messages: [],
		loading: true,
		loadingMoreThreads: false,
		currentThread: undefined,
		selectedMessageIndex: undefined,
		isSelectionMode: false,
		recipientAlreadyRead: false,
	});
	const [currentView, setCurrentView] = useState<'threads' | 'chat'>('threads');
	const [realtimeStatus, setRealtimeStatus] =
		useState<RealtimeStatus>('disconnected');
	const [systemMessage, setSystemMessage] = useState<string | undefined>(
		undefined,
	);

	const [searchMode, setSearchMode] = useState<SearchMode>(initialSearchMode);
	const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? '');
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [isInitialSearchHandled, setIsInitialSearchHandled] = useState<boolean>(
		!(initialSearchMode && initialSearchQuery),
	);
	const searchDebounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

	// State for viewing shared posts
	const [viewingPost, setViewingPost] = useState<Post | undefined>(undefined);
	const imageProtocol = useImageProtocol();

	// Calculate available height for messages (total height minus status bar and input area)
	const messageAreaHeight = Math.max(1, height - 8);

	// Handler for viewing media share posts
	const handleViewMediaShare = useCallback((post: Post) => {
		setViewingPost(post);
	}, []);

	// Handler for closing the post view
	const handleClosePostView = useCallback(() => {
		setViewingPost(undefined);
	}, []);

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

		return;
	}, [systemMessage]);

	// Helper to exit search mode
	const exitSearchMode = useCallback(() => {
		setSearchMode(undefined);
		setSearchQuery('');
		setSearchResults([]);
	}, []);

	const handleThreadSelect = useCallback(
		async (thread: Thread) => {
			if (!client) return;

			if (searchMode) {
				exitSearchMode();
			}

			setCurrentView('chat');
			setChatState(previous => ({
				...previous,
				currentThread: thread,
				loading: true,
				messages: [],
				recipientAlreadyRead: false,
			}));

			try {
				let threadId = thread.id;

				// Check if this is a pending thread (user selected from search)
				if (thread.id.startsWith('PENDING_')) {
					// Extract user PK from virtual ID
					const userPk = thread.id.replace('PENDING_', '');
					try {
						// Ensure thread will resolve the "virtual" thread if it exists
						const realThread = await client.ensureThread(userPk);
						threadId = realThread.id;
						// Update current thread with real details
						setChatState(previous => ({
							...previous,
							currentThread: realThread,
						}));
					} catch (error) {
						throw new Error(
							`Failed to resolve thread: ${
								error instanceof Error ? error.message : 'Unknown error'
							}`,
						);
					}
				}

				const {messages, cursor} = await client.getMessages(threadId);

				setChatState(previous => ({
					...previous,
					messages,
					loading: false,
					messageCursor: cursor,
				}));

				// Mark thread as seen
				const lastMessage = messages.at(-1);

				if (lastMessage?.id) {
					// Mark as read in local and remote states
					thread.unread = false;
					await client.markThreadAsSeen(threadId, lastMessage.id);
				}
			} catch (error) {
				setChatState(previous => ({
					...previous,
					error:
						error instanceof Error ? error.message : 'Failed to load messages',
					loading: false,
				}));
			}
		},
		[client, exitSearchMode, searchMode],
	);

	// Effect to handle initial search query from CLI
	useEffect(() => {
		if (isInitialSearchHandled) {
			return;
		}

		const handleInitialSearch = async () => {
			if (initialSearchMode === 'username' && initialSearchQuery && client) {
				setSearchMode('username');
				setSearchQuery(initialSearchQuery);
				setIsSearching(true);
				try {
					const results = await client.searchThreadByUsername(
						initialSearchQuery,
						{
							forceExact: true,
						},
					);
					// Open the first result if it exists, there will ONLY be one result
					if (results.length > 0 && results[0]) {
						setSearchResults(results);
						void handleThreadSelect(results[0].thread);
					} else {
						const results =
							await client.searchThreadByUsername(initialSearchQuery);
						setSearchResults(results);
					}
				} finally {
					setIsSearching(false);
				}
			} else if (initialSearchMode === 'title' && initialSearchQuery) {
				setSearchMode('title');
				setSearchQuery(initialSearchQuery);
				setIsSearching(true);
				try {
					const results = await client.searchThreadsByTitle(
						initialSearchQuery,
						{
							threshold: 0.3,
							maxThreadsToSearch: 10,
						},
					);
					setSearchResults(results);
					if (results && results.length > 0 && results[0]!.score > 0.6) {
						void handleThreadSelect(results[0]!.thread);
					}
				} finally {
					setIsSearching(false);
				}
			}

			setIsInitialSearchHandled(true);
		};

		void handleInitialSearch();
	}, [
		client,
		initialSearchQuery,
		initialSearchMode,
		isInitialSearchHandled,
		handleThreadSelect,
	]);

	// Effect to debounce search queries in search mode
	useEffect(() => {
		if (!isInitialSearchHandled) {
			return;
		}

		if (!searchMode || searchQuery.length === 0 || !client) {
			setSearchResults([]);
			return;
		}

		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
		}

		setIsSearching(true);

		// Debounce the search
		searchDebounceRef.current = setTimeout(async () => {
			try {
				if (searchMode === 'username') {
					// Use fuzzy search for UI interactive search
					const results = await client.searchThreadByUsername(searchQuery, {
						forceExact: false,
					});
					setSearchResults(results);
				} else {
					const results = await client.searchThreadsByTitle(searchQuery, {
						threshold: 0.3,
						maxThreadsToSearch: 10,
					});
					setSearchResults(results);
				}
			} catch {
				setSystemMessage('Search failed');
			} finally {
				setIsSearching(false);
			}
		}, 300); // 300ms debounce

		return () => {
			if (searchDebounceRef.current) {
				clearTimeout(searchDebounceRef.current);
			}
		};
	}, [client, searchMode, searchQuery, isInitialSearchHandled]);

	// Load threads when client is ready
	useEffect(() => {
		const loadThreads = async () => {
			if (!client) return;

			try {
				setChatState(previous => ({...previous, loading: true}));
				const {threads, hasMore} = await client.getThreads();
				setChatState(previous => ({
					...previous,
					threads,
					hasMoreThreads: hasMore,
					loading: false,
				}));
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

		const handleMessage = async (message: Message) => {
			// for current thread, append to message list and handle view changes
			if (message.threadId === chatState.currentThread?.id) {
				setChatState(prev => ({
					...prev,
					messages: [...prev.messages, message],
					recipientAlreadyRead: false,
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

				// Mark item as seen
				await client.markItemAsSeen(chatState.currentThread.id, message.id);
				return;
			}

			// if not current thread, update the global thread list to 1. show unread status 2. update last message preview
			setChatState(prev => {
				const threadIndex = prev.threads.findIndex(
					thread => thread.id === message.threadId,
				);
				if (threadIndex === -1) {
					return prev; // Thread not found, no update
				}

				const updatedThreads = [...prev.threads];
				const threadToUpdate = updatedThreads[threadIndex]!;

				// Update last message and unread status
				const updatedThread = {
					...threadToUpdate,
					lastActivity: message.timestamp,
					lastMessage: message,
					unread: true,
				};

				updatedThreads[threadIndex] = updatedThread;

				// Move the updated thread to the top of the list
				// This is more efficient than sorting the entire list
				updatedThreads.splice(threadIndex, 1);
				updatedThreads.unshift(updatedThread);

				// Show notification for background message
				setSystemMessage('Someone else sent you a message!');

				return {
					...prev,
					threads: updatedThreads,
				};
			});
		};

		client.on('message', handleMessage);

		return () => {
			client.off('message', handleMessage);
		};
	}, [client, chatState.currentThread?.id, height, messageAreaHeight]);

	// Effect for threadseen events
	useEffect(() => {
		const handleThreadSeen = (seenEvent: SeenEvent) => {
			// Only process seen events for the current thread
			if (seenEvent.threadId === chatState.currentThread?.id) {
				setChatState(previous => ({...previous, recipientAlreadyRead: true}));
			}
		};

		client.on('threadSeen', handleThreadSeen);

		return () => {
			client.off('threadSeen', handleThreadSeen);
		};
	}, [client, chatState.currentThread?.id]);

	// Effect for reaction events
	useEffect(() => {
		if (!client) return;

		const handleReaction = (reactionEvent: ReactionEvent) => {
			// Only process reactions for the current thread
			if (reactionEvent.threadId !== chatState.currentThread?.id) {
				return;
			}

			setChatState(prev => {
				const updatedMessages = prev.messages.map(message => {
					// Find the message that matches the item_id
					if (message.item_id === reactionEvent.itemId) {
						// Add the new reaction to the message
						const existingReactions = message.reactions ?? [];

						// Check if this exact reaction already exists (same user, same emoji)
						const reactionExists = existingReactions.some(
							r =>
								r.senderId === reactionEvent.userId &&
								r.emoji === reactionEvent.emoji,
						);

						if (reactionExists) {
							return message; // Don't add duplicate
						}

						return {
							...message,
							reactions: [
								...existingReactions,
								{
									emoji: reactionEvent.emoji,
									senderId: reactionEvent.userId,
								},
							],
						};
					}

					return message;
				});

				return {...prev, messages: updatedMessages};
			});
		};

		client.on('reaction', handleReaction);

		return () => {
			client.off('reaction', handleReaction);
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
				// polling always fetches messages in current thread
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
		if (viewingPost) {
			return;
		}

		// Don't handle input when in search mode (SearchInput handles it)
		if (searchMode) {
			return;
		}

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

		// Search mode activation (only in threads view)
		if (currentView === 'threads' && !chatState.loading) {
			if (input === '/') {
				setSearchMode('title');
				setSearchQuery('');
				return;
			}

			if (input === '@') {
				setSearchMode('username');
				setSearchQuery('');
				return;
			}
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

	const handleSearchChange = useCallback((value: string) => {
		setSearchQuery(value);
	}, []);

	const handleSearchSubmit = useCallback(
		(value: string) => {
			if (!client || value.trim().length === 0) {
				exitSearchMode();
				return;
			}
			// Selection will be handled by ThreadList's onSelect
		},
		[client, exitSearchMode],
	);

	const handleSendMessage = async (text: string) => {
		if (!client || !chatState.currentThread) return;

		// Capture thread ID immediately to prevent race conditions during async operations
		const threadId = chatState.currentThread.id;
		if (!threadId) return;

		const {
			isCommand,
			systemMessage: cmdSystemMessage,
			processedText,
		} = await parseAndDispatchChatCommand(text, {
			client,
			chatState,
			setChatState,
			height,
			scrollViewRef,
			onViewMediaShare: handleViewMediaShare,
		});

		if (cmdSystemMessage) {
			setSystemMessage(cmdSystemMessage);
		}

		if (isCommand) {
			return; // Command was handled, no message to send
		}

		try {
			// Use processedText if available (e.g., when '::' was stripped), otherwise use original text
			const textToProcess = processedText ?? text;
			const finalText = await preprocessMessage(textToProcess, {
				client,
				threadId,
			});

			if (finalText) {
				await client.sendMessage(threadId, finalText);

				// Create a message object for thread list update
				const username = client.getUsername() ?? 'me';
				const sentMessage: TextMessage = {
					id: `local_${Date.now()}`,
					timestamp: new Date(),
					userId: 'me',
					username,
					isOutgoing: true,
					threadId,
					itemType: 'text',
					text: finalText,
				};

				// Update thread list to move this thread to top and update preview
				setChatState(previous => {
					const threadIndex = previous.threads.findIndex(
						t => t.id === threadId,
					);

					if (threadIndex === -1) {
						return previous; // Thread not found, no update
					}

					const updatedThreads = [...previous.threads];
					const threadToUpdate = updatedThreads[threadIndex]!;

					// Update last message and activity
					const updatedThread = {
						...threadToUpdate,
						lastActivity: sentMessage.timestamp,
						lastMessage: sentMessage,
					};

					// Move updated thread to top of list
					updatedThreads.splice(threadIndex, 1);
					updatedThreads.unshift(updatedThread);

					return {
						...previous,
						threads: updatedThreads,
					};
				});

				// Scroll to bottom after sending a message
				// Timeout to ensure message is rendered before scrolling
				const timeout = setTimeout(() => {
					if (scrollViewRef.current) {
						scrollViewRef.current.scrollToEnd(false);
					}
				}, 1000);

				// Clear recipient read status on new message sent
				setChatState(previous => ({...previous, recipientAlreadyRead: false}));

				return () => {
					clearTimeout(timeout);
				};
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to send message';
			setSystemMessage(errorMessage);
		}

		return;
	};

	const handleOnScrollToBottom = () => {
		setSystemMessage('Scrolled to bottom');
	};

	const handleLoadMoreThreads = async () => {
		if (!chatState.hasMoreThreads || !client || chatState.loadingMoreThreads) {
			return;
		}

		setChatState(previous => ({...previous, loadingMoreThreads: true}));
		try {
			const {threads, hasMore} = await client.getThreads(true);
			setChatState(previous => ({
				...previous,
				threads: [...previous.threads, ...threads],
				loadingMoreThreads: false,
				hasMoreThreads: hasMore,
			}));
		} catch {
			setChatState(previous => ({...previous, loadingMoreThreads: false}));
			setSystemMessage('Failed to load more threads.');
		}
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
					<Text>Loading...</Text>
				</Box>
			);
		}

		if (currentView === 'threads') {
			// Show search results when in search mode, otherwise show all threads
			const threadsToDisplay =
				searchMode && searchResults.length > 0
					? searchResults.map(r => r.thread)
					: chatState.threads;

			return (
				<Box flexDirection="column" flexGrow={1}>
					<ThreadList
						isSearchMode={Boolean(searchMode)}
						threads={threadsToDisplay}
						onScrollToBottom={searchMode ? undefined : handleLoadMoreThreads}
						onSelect={handleThreadSelect}
					/>
					{searchMode && (
						<SearchInput
							isSearching={isSearching}
							mode={searchMode}
							resultCount={searchResults.length}
							value={searchQuery}
							onCancel={exitSearchMode}
							onChange={handleSearchChange}
							onSubmit={handleSearchSubmit}
						/>
					)}
				</Box>
			);
		}

		return (
			<Box flexDirection="column" height="100%">
				{chatState.loading && chatState.messages.length === 0 ? (
					<Box
						flexGrow={1}
						justifyContent="center"
						alignItems="center"
						paddingY={1}
					>
						<Text>Loading messages...</Text>
					</Box>
				) : (
					<ScrollView
						ref={scrollViewRef}
						height={messageAreaHeight}
						initialScrollPosition="end"
						width={width}
						onScrollToEnd={handleOnScrollToBottom}
						onScrollToStart={handleOnScrollToTop}
					>
						<MessageList
							currentThread={chatState.currentThread}
							messages={chatState.messages}
							selectedMessageIndex={chatState.selectedMessageIndex}
						/>
					</ScrollView>
				)}
				{chatState.recipientAlreadyRead && (
					<Box>
						<Text dimColor>Seen just now</Text>
					</Box>
				)}
				<Box flexDirection="column" flexShrink={0}>
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

	// Get the appropriate help text based on current state
	const getHelpText = () => {
		if (searchMode) {
			return 'Type to search, Enter: select first result, Esc: cancel';
		}

		if (currentView === 'threads') {
			return 'j/k: navigate, Enter: select, /: search by title, @: search by username, Esc: quit';
		}

		if (chatState.isSelectionMode) {
			return 'j/k: navigate messages, Enter: confirm, Esc: exit selection';
		}

		return 'Esc: back to threads, Ctrl+C: quit';
	};

	if (viewingPost) {
		return (
			<TerminalInfoProvider>
				<SinglePostView
					post={viewingPost}
					protocol={imageProtocol}
					onClose={handleClosePostView}
				/>
			</TerminalInfoProvider>
		);
	}

	return (
		<FullScreen>
			<TerminalInfoProvider>
				<Box flexDirection="column" height="100%" width="100%">
					<StatusBar
						currentThread={chatState.currentThread}
						currentView={currentView}
						error={chatState.error}
						isLoading={chatState.loading}
						realtimeStatus={realtimeStatus}
						searchMode={searchMode}
					/>

					<Box flexDirection="column" flexGrow={1}>
						{renderContent()}
					</Box>

					<Box>
						{currentView === 'threads' && chatState.loadingMoreThreads ? (
							<Text color="yellow">Loading more threads...</Text>
						) : systemMessage ? (
							<Text color="yellow">{systemMessage}</Text>
						) : (
							<Text dimColor>{getHelpText()}</Text>
						)}
					</Box>
				</Box>
			</TerminalInfoProvider>
		</FullScreen>
	);
}
