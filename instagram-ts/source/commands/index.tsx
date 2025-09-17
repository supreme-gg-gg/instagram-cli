import React from 'react';
import BigText from 'ink-big-text';
import {Text} from 'ink';

export default function Index() {
	return (
		<>
			<BigText text="InstagramCLI" font="simple" colors={['#ff00ff']} />
			<Text color="green">The end of brainrot and doomscrolling is here.</Text>
			<Text color="blue">
				Type &#39;instagram --help&#39; to see available commands.
			</Text>
			<Text color="yellow">
				Pro Tip: Use vim-motion (&#39;k&#39;, &#39;j&#39;) to navigate chats and
				messages.
			</Text>
		</>
	);
}
