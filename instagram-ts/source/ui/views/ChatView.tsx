import React, {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import type {Thread, ChatState} from '../../types/instagram.js';
import MessageList from '../components/MessageList.js';
import InputBox from '../components/InputBox.js';
import StatusBar from '../components/StatusBar.js';
import ThreadList from '../components/ThreadList.js';
import {useClient} from '../context/ClientContext.js';
import {parseAndDispatchChatCommand} from '../utils/chatCommands.js';

export default function ChatView() {
	const {exit} = useApp();
	const client = useClient();
	const [chatState, setChatState] = useState<ChatState>({
		threads: [],
		messages: [],
		loading: true,
		currentThread: undefined,
	});
	const [currentView, setCurrentView] = useState<'threads' | 'chat'>('threads');

	const [messageCursor, setMessageCursor] = useState<string | undefined>(
		undefined,
	);

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

	// Poll for new messages
	useEffect(() => {
		if (currentView !== 'chat' || !chatState.currentThread) return;

		const interval = setInterval(async () => {
			if (!client || !chatState.currentThread) return;
			const {messages} = await client.getMessages(chatState.currentThread.id);
			setChatState(prev => ({...prev, messages}));
		}, 5000);

		return () => clearInterval(interval);
	}, [client, currentView, chatState.currentThread]);
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

		if (input === 'k' && currentView === 'chat') {
			loadOlderMessages();
		}
	});

	const loadOlderMessages = async () => {
		if (!client || !chatState.currentThread) return;

		try {
			setChatState(prev => ({...prev, loading: true}));
			const {messages, cursor} = await client.getMessages(
				chatState.currentThread.id,
				messageCursor,
			);
			setChatState(prev => ({
				...prev,
				messages: [...messages, ...prev.messages],
				loading: false,
			}));
			setMessageCursor(cursor);
		} catch (error) {
			setChatState(prev => ({
				...prev,
				error:
					error instanceof Error ? error.message : 'Failed to load messages',
				loading: false,
			}));
		}
	};

	const handleThreadSelect = async (thread: Thread) => {
		if (!client) return;

		try {
			setChatState(prev => ({...prev, loading: true, currentThread: thread}));
			const {messages, cursor} = await client.getMessages(thread.id);
			setChatState(prev => ({...prev, messages, loading: false}));
			setMessageCursor(cursor);
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

		// Check for chat command (starts with ':') and dispatch
		const handled = parseAndDispatchChatCommand(text, {
			client,
			chatState,
			setChatState,
		});
		if (handled) return;

		try {
			await client.sendMessage(chatState.currentThread.id, text);
			// Reload messages to show the new one
			const {messages} = await client.getMessages(chatState.currentThread.id);
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
				username={client.getUsername() || undefined}
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
