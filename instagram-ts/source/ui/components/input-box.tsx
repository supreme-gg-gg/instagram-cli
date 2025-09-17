import React, {useState} from 'react';
import {Box} from 'ink';
import TextInput from 'ink-text-input';

type InputBoxProperties = {
	readonly onSend: (message: string) => void;
};

export default function InputBox({onSend}: InputBoxProperties) {
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
				showCursor
				value={message} // Control the input value
				placeholder="Type a message and press Enter to send..."
				onChange={setMessage}
				onSubmit={handleSubmit}
			/>
		</Box>
	);
}
