import React, {useEffect, useState} from 'react';
import ascii from 'ascii-art';
import chalk from 'chalk';
import {Text} from 'ink';

export default function Index() {
	const [logo, setLogo] = useState('');

	useEffect(() => {
		ascii
			.font('InstagramCLI', 'Doom')
			.toPromise()
			.then(setLogo)
			.catch(() => setLogo('InstagramCLI'));
	}, []);

	const messages = [
		chalk.blue("Type 'instagram --help' to see available commands."),
		chalk.yellow(
			"Pro Tip: Use vim-motion ('k', 'j') to navigate chats and messages.",
		),
	];

	return (
		<>
			<Text color="magenta">{logo}</Text>
			<Text color="green">The end of brainrot and doomscrolling is here.</Text>
			{messages.map((msg, i) => (
				<Text key={i}>{msg}</Text>
			))}
		</>
	);
}
