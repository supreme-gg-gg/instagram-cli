import React, {useState} from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';

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
		<Box
			borderStyle="single"
			borderTop={false}
			borderLeft={false}
			borderRight={false}
		>
			<Box width="100%" paddingX={1}>
				<Text>Message: </Text>
				<TextInput
					value={message}
					onChange={setMessage}
					onSubmit={handleSubmit}
					placeholder="Type your message..."
				/>
			</Box>
		</Box>
	);
}
