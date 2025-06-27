import React, {useState} from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';
import {login} from './auth.js';

export default function App() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loggedIn, setLoggedIn] = useState(false);
	const [activeInput, setActiveInput] = useState('username');

	const handleLogin = async () => {
		const {success, error} = await login(username, password);
		if (success) {
			setLoggedIn(true);
		} else {
			setError(error ?? 'An unknown error occurred');
		}
	};

	if (loggedIn) {
		return <Text>Welcome!</Text>;
	}

	return (
		<Box flexDirection="column">
			<Box>
				<Text>Username: </Text>
				<TextInput
					value={username}
					onChange={setUsername}
					onSubmit={() => setActiveInput('password')}
					focus={activeInput === 'username'}
				/>
			</Box>
			<Box>
				<Text>Password: </Text>
				<TextInput
					value={password}
					onChange={setPassword}
					onSubmit={handleLogin}
					focus={activeInput === 'password'}
					mask="*"
				/>
			</Box>
			{error && <Text color="red">{error}</Text>}
		</Box>
	);
}