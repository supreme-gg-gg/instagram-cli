import React, {useState} from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';

export default function LoginForm({
	onSubmit,
}: {
	onSubmit: (username: string, password: string) => void;
}) {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [step, setStep] = useState<'username' | 'password'>('username');

	return (
		<Box flexDirection="column">
			<Text>Instagram Login</Text>
			{step === 'username' ? (
				<TextInput
					placeholder="Username"
					value={username}
					onChange={setUsername}
					showCursor={true}
					onSubmit={() => setStep('password')}
				/>
			) : (
				<TextInput
					mask="*"
					placeholder="Password"
					value={password}
					onChange={setPassword}
					onSubmit={() => onSubmit(username, password)}
				/>
			)}
		</Box>
	);
}
