import React, {useState} from 'react';
import {Box, Text} from 'ink';
import {TextInput, PasswordInput} from '@inkjs/ui';

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
					defaultValue={username}
					onChange={setUsername}
					onSubmit={() => setStep('password')}
				/>
			) : (
				<PasswordInput
					placeholder="Password"
					onChange={setPassword}
					onSubmit={() => onSubmit(username, password)}
				/>
			)}
		</Box>
	);
}
