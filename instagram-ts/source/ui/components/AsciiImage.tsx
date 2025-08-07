import React, {useState, useEffect} from 'react';
import {Text} from 'ink';
import {convertImageToColorAscii} from '../../utils/ascii-display.js';

interface AsciiImageProps {
	url: string;
}

export default function AsciiImage({url}: AsciiImageProps) {
	const [ascii, setAscii] = useState<string>('');

	useEffect(() => {
		let isMounted = true;
		const renderAscii = async () => {
			try {
				const result = await convertImageToColorAscii(url);
				if (isMounted) {
					setAscii(result);
				}
			} catch (err) {
				if (isMounted) {
					setAscii('Error converting image.');
				}
			}
		};

		renderAscii();

		return () => {
			isMounted = false;
		};
	}, [url]);

	if (!ascii) {
		return <Text dimColor>[Loading Image...]</Text>;
	}

	return (
		<>
			{ascii.split('\n').map((line, i) => (
				<Text key={i}>{line}</Text>
			))}
		</>
	);
}
