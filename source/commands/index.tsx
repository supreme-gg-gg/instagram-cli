import React from 'react';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import {Text} from 'ink';
import zod from 'zod';

export const args = zod.tuple([]).rest(zod.string());

type Props = {
	readonly args?: string[];
};

const defaultArgs: string[] = [];

export default function Index({args: unknownArgs = defaultArgs}: Props) {
	if (unknownArgs.length > 0) {
		return (
			<>
				<Text color="red">Unknown command: {unknownArgs.join(' ')}</Text>
				<Text>Run &#39;instagram-cli --help&#39; for available commands.</Text>
			</>
		);
	}

	return (
		<>
			<Gradient
				colors={[
					'#405DE6',
					'#5B51D8',
					'#833AB4',
					'#C13584',
					'#E1306C',
					'#FD1D1D',
					'#F56040',
				]}
			>
				<BigText text="Instagram CLI" colors={['#ff00ff']} />
			</Gradient>
			<Text color="green">The end of brainrot and doomscrolling is here.</Text>
			<Text color="blue">
				Type &#39;instagram-cli --help&#39; to see available commands.
			</Text>
			<Text color="yellow">
				Pro Tip: Use vim-motion (&#39;k&#39;, &#39;j&#39;) to navigate chats and
				messages.
			</Text>
		</>
	);
}
