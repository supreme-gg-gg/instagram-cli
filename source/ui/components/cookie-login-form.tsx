import React, {useState} from 'react';
import {Box, Text} from 'ink';
import type {BrowserCookies} from '../../client.js';
import TextInput from './text-input.js';

type Step = 'username' | 'sessionId' | 'csrfToken' | 'dsUserId';

type Properties = {
	readonly onSubmit: (username: string, cookies: BrowserCookies) => void;
};

export default function CookieLoginForm({onSubmit}: Properties) {
	const [step, setStep] = useState<Step>('username');
	const [username, setUsername] = useState('');
	const [sessionId, setSessionId] = useState('');
	const [csrfToken, setCsrfToken] = useState('');
	const [dsUserId, setDsUserId] = useState('');

	const advance = (value: string, nextStep: Step) => {
		if (value.trim()) setStep(nextStep);
	};

	const submit = () => {
		if (!dsUserId.trim()) return;

		onSubmit(username, {sessionId, csrfToken, dsUserId});
		setUsername('');
		setSessionId('');
		setCsrfToken('');
		setDsUserId('');
	};

	return (
		<Box flexDirection="column">
			<Text bold>Experimental browser-cookie login</Text>
			<Text color="yellow">
				Your sessionid grants account access. Never share it; it will be stored
				locally with owner-only permissions.
			</Text>
			<Text>
				{step === 'username'
					? 'Enter Instagram username:'
					: step === 'sessionId'
						? 'Paste sessionid:'
						: step === 'csrfToken'
							? 'Paste csrftoken:'
							: 'Paste ds_user_id:'}
			</Text>
			{step === 'username' ? (
				<TextInput
					placeholder="username"
					value={username}
					onChange={setUsername}
					onSubmit={() => {
						advance(username, 'sessionId');
					}}
				/>
			) : step === 'sessionId' ? (
				<TextInput
					mask="*"
					placeholder="sessionid"
					value={sessionId}
					onChange={setSessionId}
					onSubmit={() => {
						advance(sessionId, 'csrfToken');
					}}
				/>
			) : step === 'csrfToken' ? (
				<TextInput
					mask="*"
					placeholder="csrftoken"
					value={csrfToken}
					onChange={setCsrfToken}
					onSubmit={() => {
						advance(csrfToken, 'dsUserId');
					}}
				/>
			) : (
				<TextInput
					mask="*"
					placeholder="ds_user_id"
					value={dsUserId}
					onChange={setDsUserId}
					onSubmit={submit}
				/>
			)}
		</Box>
	);
}
