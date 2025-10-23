import React, {useState, useEffect} from 'react';
import Image, {TerminalInfoProvider, type ImageProtocolName} from 'ink-picture';
import {Text, Box} from 'ink';
import zod from 'zod';
import {argument} from 'pastel';

export const args = zod.tuple([
	zod.string().describe(
		argument({
			name: 'protocol',
			description: 'Image protocol to use',
		}),
	),
]);

type Properties = {
	readonly args: zod.infer<typeof args>;
};

const testImages = [
	'https://sipi.usc.edu/database/preview/misc/4.1.01.png',
	'https://sipi.usc.edu/database/preview/misc/4.1.06.png',
	'https://sipi.usc.edu/database/preview/misc/4.2.06.png',
	'https://www.math.hkust.edu.hk/~masyleung/Teaching/CAS/MATLAB/image/images/cameraman.jpg',
	'https://example.com/bad-url/image-that-doesnt-exist.jpg',
	'/home/endernoke/Downloads/wn_php.png',
	'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Lenna_%28test_image%29.png/500px-Lenna_%28test_image%29.png',
];

export default function TestImage(properties: Properties) {
	// eslint-disable-next-line react/hook-use-state
	const [, setTick] = useState(true);

	useEffect(() => {
		const id = setInterval(() => {
			setTick(t => !t);
		}, 10_000);
		return () => {
			clearInterval(id);
		};
	}, []);
	return (
		<TerminalInfoProvider>
			<Box flexDirection="column">
				<Text>{properties.args[0]}</Text>
				<Box flexDirection="column">
					{/* First row */}
					<Box flexDirection="row">
						{testImages.slice(0, 3).map((source, index) => (
							<Box
								key={index}
								borderStyle="round"
								borderColor="cyan"
								width={32}
								height={17}
							>
								<Image
									src={source}
									alt={`Test Image ${index + 1}`}
									protocol={properties.args[0] as ImageProtocolName}
								/>
							</Box>
						))}
					</Box>
					{/* Second row */}
					<Box flexDirection="row">
						{testImages.slice(3, 6).map((source, index) => (
							<Box
								key={index + 3}
								borderStyle="round"
								borderColor="cyan"
								width={32}
								height={17}
							>
								<Image
									src={source}
									alt={`Test Image ${index + 4}`}
									protocol={properties.args[0] as ImageProtocolName}
								/>
							</Box>
						))}
					</Box>
				</Box>
			</Box>
			<Box>
				<Text>Ctrl+C to exit</Text>
			</Box>
		</TerminalInfoProvider>
	);
}
