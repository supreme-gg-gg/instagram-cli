import React, {useState} from 'react';
import {Box, Text} from 'ink';
import {TextInput} from '@inkjs/ui';
import {InstagramClient} from './client.js';

const client = new InstagramClient();

export default function App() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loggedIn, setLoggedIn] = useState(false);

	const handleLogin = async () => {
		const {success, error: loginError} = await client.login(username, password);
		if (success) {
			setLoggedIn(true);
		} else {
			setError(loginError ?? 'An unknown error occurred');
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
					defaultValue={username}
					onChange={setUsername}
					onSubmit={() => {}}
				/>
			</Box>
			<Box>
				<Text>Password: </Text>
				<TextInput
					defaultValue={password}
					onChange={setPassword}
					onSubmit={handleLogin}
				/>
			</Box>
			{error && <Text color="red">{error}</Text>}
		</Box>
	);
}
