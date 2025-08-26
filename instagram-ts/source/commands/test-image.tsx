import React, {useState, useEffect} from 'react';
import Image from '../ui/components/image/index.js';
import {Text, Box} from 'ink';
import {TerminalDimensionsProvider} from '../ui/context/TerminalPixelDimensions.js';
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

type Props = {
	args: zod.infer<typeof args>;
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

export default function TestImage(props: Props) {
	const [, setTick] = useState(true);

	useEffect(() => {
		const id = setInterval(() => {
			setTick(t => !t);
		}, 10000);
		return () => clearInterval(id);
	}, []);
	return (
		<TerminalDimensionsProvider>
			<Box flexDirection="column">
				<Text>{props.args[0]}</Text>
				<Box flexDirection="column">
					{/* First row */}
					<Box flexDirection="row">
						{testImages.slice(0, 3).map((src, index) => (
							<Box
								key={index}
								borderStyle="round"
								borderColor="cyan"
								width={32}
								height={17}
							>
								<Image
									src={src}
									alt={`Test Image ${index + 1}`}
									protocol={props.args[0]}
								/>
							</Box>
						))}
					</Box>
					{/* Second row */}
					<Box flexDirection="row">
						{testImages.slice(3, 6).map((src, index) => (
							<Box
								key={index + 3}
								borderStyle="round"
								borderColor="cyan"
								width={32}
								height={17}
							>
								<Image
									src={src}
									alt={`Test Image ${index + 4}`}
									protocol={props.args[0]}
								/>
							</Box>
						))}
					</Box>
				</Box>
			</Box>
			<Box>
				<Text>Ctrl+C to exit</Text>
			</Box>
		</TerminalDimensionsProvider>
	);
}
