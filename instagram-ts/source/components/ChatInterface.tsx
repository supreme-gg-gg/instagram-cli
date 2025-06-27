import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import {InstagramClient} from '../client.js';
import {ConfigManager} from '../config.js';
import type {Thread, ChatState} from '../types/instagram.js';
import MessageList from './MessageList.js';
import InputBox from './InputBox.js';
import StatusBar from './StatusBar.js';
import ThreadList from './ThreadList.js';

interface ChatInterfaceProps {
	username?: string;
}

export default function ChatInterface({username}: ChatInterfaceProps) {
	const {exit} = useApp();
	const [chatState, setChatState] = useState<ChatState>({
		threads: [],
		messages: [],
		loading: true,
		currentThread: undefined,
	});
	const [currentView, setCurrentView] = useState<'threads' | 'chat'>('threads');
	const [client, setClient] = useState<InstagramClient | null>(null);

	// Initialize Instagram client
	useEffect(() => {
		const initializeClient = async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				const currentUsername =
					username || config.get<string>('login.currentUsername');
				if (!currentUsername) {
					setChatState(prev => ({
						...prev,
						error: 'No logged in user found',
						loading: false,
					}));
					return;
				}

				const igClient = new InstagramClient();
				const success = await igClient.restoreSession(currentUsername);

				if (!success) {
					setChatState(prev => ({
						...prev,
						error: 'Failed to restore session',
						loading: false,
					}));
					return;
				}

				setClient(igClient);
				setChatState(prev => ({...prev, loading: false}));
			} catch (error) {
				setChatState(prev => ({
					...prev,
					error: error instanceof Error ? error.message : 'Unknown error',
					loading: false,
				}));
			}
		};

		initializeClient();
	}, [username]);

	// Load threads when client is ready
	useEffect(() => {
		const loadThreads = async () => {
			if (!client) return;

			try {
				setChatState(prev => ({...prev, loading: true}));
				const threads = await client.getThreads();
				setChatState(prev => ({...prev, threads, loading: false}));
			} catch (error) {
				setChatState(prev => ({
					...prev,
					error:
						error instanceof Error ? error.message : 'Failed to load threads',
					loading: false,
				}));
			}
		};

		loadThreads();
	}, [client]);

	// Handle keyboard input
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
			setChatState(prev => ({...prev, currentThread: undefined, messages: []}));
			return;
		}
	});

	const handleThreadSelect = async (thread: Thread) => {
		if (!client) return;

		try {
			setChatState(prev => ({...prev, loading: true, currentThread: thread}));
			const messages = await client.getMessages(thread.id);
			setChatState(prev => ({...prev, messages, loading: false}));
			setCurrentView('chat');
		} catch (error) {
			setChatState(prev => ({
				...prev,
				error:
					error instanceof Error ? error.message : 'Failed to load messages',
				loading: false,
			}));
		}
	};

	const handleSendMessage = async (text: string) => {
		if (!client || !chatState.currentThread) return;

		try {
			await client.sendMessage(chatState.currentThread.id, text);
			// Reload messages to show the new one
			const messages = await client.getMessages(chatState.currentThread.id);
			setChatState(prev => ({...prev, messages}));
		} catch (error) {
			setChatState(prev => ({
				...prev,
				error:
					error instanceof Error ? error.message : 'Failed to send message',
			}));
		}
	};

	if (chatState.loading) {
		return (
			<Box flexDirection="column" height="100%">
				<StatusBar loading={true} />
				<Box flexGrow={1} justifyContent="center" alignItems="center">
					<Text>Loading...</Text>
				</Box>
			</Box>
		);
	}

	if (chatState.error) {
		return (
			<Box flexDirection="column" height="100%">
				<StatusBar error={chatState.error} />
				<Box flexGrow={1} justifyContent="center" alignItems="center">
					<Text color="red">Error: {chatState.error}</Text>
				</Box>
				<Box>
					<Text dimColor>Press Ctrl+C to exit</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" height="100%">
			<StatusBar
				currentView={currentView}
				currentThread={chatState.currentThread}
				username={username}
			/>

			{currentView === 'threads' ? (
				<ThreadList threads={chatState.threads} onSelect={handleThreadSelect} />
			) : (
				<>
					<MessageList
						messages={chatState.messages}
						currentThread={chatState.currentThread}
					/>
					<InputBox onSend={handleSendMessage} />
				</>
			)}

			<Box>
				<Text dimColor>
					{currentView === 'threads'
						? 'j/k: navigate, Enter: select, q: quit'
						: 'Esc: back to threads, Ctrl+C: quit'}
				</Text>
			</Box>
		</Box>
	);
}
