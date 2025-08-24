import React from 'react';
import Image, {ImageProtocols} from '../ui/components/image/index.js';
import {Text, Box} from 'ink';

const testImages = [
	'https://sipi.usc.edu/database/preview/misc/4.1.01.png',
	'https://sipi.usc.edu/database/preview/misc/4.1.06.png',
	'https://sipi.usc.edu/database/preview/misc/4.2.06.png',
	'https://www.math.hkust.edu.hk/~masyleung/Teaching/CAS/MATLAB/image/images/cameraman.jpg',
];

export default function TestImage() {
	return (
		<Box flexDirection="column" gap={1}>
			<Text>Test Image Component</Text>
			{ImageProtocols.map((protocol, index) => (
				<Box key={index} flexDirection="column" gap={1}>
					<Text>{protocol} Protocol</Text>
					{testImages.map((src, index) => (
						<Box
							key={index}
							flexDirection="column"
							borderStyle="round"
							borderColor="cyan"
							height={10}
						>
							<Image
								src={src}
								alt={`Test Image ${index + 1}`}
								protocol={protocol}
							/>
						</Box>
					))}
				</Box>
			))}
		</Box>
	);
}
