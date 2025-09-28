import React, {useState} from 'react';
import {Box} from 'ink';
import TextInput from 'ink-text-input';

type InputBoxProperties = {
	readonly onSend: (message: string) => void;
	readonly isDisabled?: boolean;
};

export default function InputBox({
	onSend,
	isDisabled = false,
}: InputBoxProperties) {
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
				showCursor={!isDisabled}
				value={message} // Control the input value
				placeholder={
					isDisabled
						? 'Selection mode active - use j/k to navigate, Esc to exit'
						: 'Type a message and press Enter to send...'
				}
				onChange={isDisabled ? () => {} : setMessage}
				onSubmit={isDisabled ? () => {} : handleSubmit}
			/>
		</Box>
	);
}
