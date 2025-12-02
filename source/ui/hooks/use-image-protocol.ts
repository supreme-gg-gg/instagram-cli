import {useState, useEffect} from 'react';
import {type ImageProtocolName} from 'ink-picture';
import {ConfigManager} from '../../config.js';

export function useImageProtocol() {
	const [protocol, setProtocol] = useState<ImageProtocolName | undefined>(
		undefined,
	);

	useEffect(() => {
		const config = ConfigManager.getInstance();
		const savedProtocol = config.get('image.protocol');
		setProtocol(savedProtocol as ImageProtocolName);
	}, []);

	return protocol;
}
