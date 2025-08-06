import React, {useState} from 'react';
import {Box} from 'ink';
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
		<Box borderStyle="round" paddingX={1} marginTop={1}>
			<TextInput
				defaultValue={message} // Control the input value
				onChange={setMessage}
				onSubmit={handleSubmit}
				placeholder="Type a message and press Enter to send..."
			/>
		</Box>
	);
}
