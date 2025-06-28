import React, {useState} from 'react';
import {Box, Text} from 'ink';
import {TextInput, PasswordInput, ConfirmInput} from '@inkjs/ui';

export default function LoginForm({
	onSubmit,
}: {
	onSubmit: (
		username: string,
		password: string,
		verificationCode?: string,
	) => void;
}) {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [step, setStep] = useState<
		'username' | 'password' | '2fa-confirm' | '2fa-code'
	>('username');
	const [verificationCode, setVerificationCode] = useState('');

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
			) : step === 'password' ? (
				<PasswordInput
					placeholder="Password"
					onChange={setPassword}
					onSubmit={() => setStep('2fa-confirm')}
				/>
			) : step === '2fa-confirm' ? (
				<>
					<Text>Do you use 2FA (2 Factor Authentication)?</Text>
					<ConfirmInput
						onConfirm={() => setStep('2fa-code')}
						onCancel={() => onSubmit(username, password)}
					/>
				</>
			) : (
				<>
					<Text>2FA Code (from Auth App, SMS not supported)</Text>
					<TextInput
						placeholder="2FA Code"
						defaultValue={verificationCode}
						onChange={setVerificationCode}
						onSubmit={() =>
							onSubmit(username, password, verificationCode || undefined)
						}
					/>
				</>
			)}
		</Box>
	);
}
