import React, {useState} from 'react';
import {Box, Text} from 'ink';
import {TextInput} from '@inkjs/ui';

interface InputBoxProps {
	onSend: (message: string) => void;
}

export default function InputBox({onSend}: InputBoxProps) {
	const [message, setMessage] = useState('');

	const handleSubmit = (value: string) => {
		if (value.trim()) {
			onSend(value.trim());
			setMessage('');
		}
	};

	return (
		<Box borderStyle="bold" borderTop borderLeft borderRight borderBottom>
			<Box width="100%" paddingX={1}>
				<Text>Message: </Text>
				<TextInput
					defaultValue={message}
					onChange={setMessage}
					onSubmit={handleSubmit}
					placeholder="Type your message..."
				/>
			</Box>
		</Box>
	);
}
