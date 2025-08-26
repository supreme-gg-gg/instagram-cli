import React, {useState, useEffect, useCallback} from 'react';
import {type ImageProps, type ImageProtocol} from './protocol.js';
import HalfBlockImage from './HalfBlock.js';
import BrailleImage from './Braille.js';
import SixelImage from './Sixel.js';

function AsciiImage(props: ImageProps) {
	// ASCII should always be supported as the ultimate fallback
	useEffect(() => {
		props.onSupportDetected(true);
	}, [props.onSupportDetected]);

	return null;
}

const createProtocolRegistry = () => {
	const protocols: Record<string, ImageProtocol> = {};

	return {
		register: (protocol: ImageProtocol) => {
			protocols[protocol.name] = protocol;
		},

		getProtocol: (name: string) => {
			return protocols[name];
		},
		getAllProtocols: () => {
			return Object.keys(protocols);
		},
	};
};

const protocolRegistry = createProtocolRegistry();
protocolRegistry.register({
	name: 'ascii',
	render: AsciiImage,
});
protocolRegistry.register({
	name: 'halfBlock',
	render: HalfBlockImage,
});
protocolRegistry.register({
	name: 'braille',
	render: BrailleImage,
});
protocolRegistry.register({
	name: 'sixel',
	render: SixelImage,
});

const ImageRenderer = (props: ImageProps & {protocol: string}) => {
	const ProtocolComponent =
		protocolRegistry.getProtocol(props.protocol)?.render ??
		protocolRegistry.getProtocol('ascii')!.render;
	return <ProtocolComponent {...props} />;
};

// Main Image component
function Image({
	protocol: initialProtocol = 'ascii',
	...props
}: Omit<ImageProps & {protocol?: string}, 'onSupportDetected'>) {
	const [protocol, setProtocol] = useState(initialProtocol);
	const [supportCheckComplete, setSupportCheckComplete] = useState(false);
	const [fallbackAttempts, setFallbackAttempts] = useState(0);

	// Define fallback hierarchy
	const getFallbackProtocol = useCallback(
		(currentProtocol: string, attemptCount: number): string => {
			if (currentProtocol === 'sixel') {
				return attemptCount === 0
					? 'braille'
					: attemptCount === 1
					? 'halfBlock'
					: 'ascii';
			}
			if (currentProtocol === 'braille') {
				return attemptCount === 0 ? 'halfBlock' : 'ascii';
			}
			if (currentProtocol === 'halfBlock') {
				return 'ascii';
			}
			return 'ascii'; // Final fallback
		},
		[],
	);

	// Callback to handle support detection from child components
	const handleSupportDetected = useCallback(
		(isSupported: boolean) => {
			if (isSupported) {
				// Current protocol is supported
				setSupportCheckComplete(true);
			} else {
				// Try fallback protocol
				const nextProtocol = getFallbackProtocol(protocol, fallbackAttempts);
				if (nextProtocol !== protocol) {
					setProtocol(nextProtocol);
					setFallbackAttempts(prev => prev + 1);
					// supportCheckComplete remains false to trigger another check
				} else {
					// No more fallbacks, use current protocol anyway (shouldn't happen with 'ascii')
					setSupportCheckComplete(true);
				}
			}
		},
		[protocol, fallbackAttempts, getFallbackProtocol],
	);

	// Reset support check when initial protocol changes
	useEffect(() => {
		setProtocol(initialProtocol);
		setSupportCheckComplete(false);
		setFallbackAttempts(0);
	}, [initialProtocol]);

	if (!supportCheckComplete) {
		// Render the current protocol to detect support
		const ProtocolComponent =
			protocolRegistry.getProtocol(protocol)?.render ??
			protocolRegistry.getProtocol('ascii')!.render;
		return (
			<ProtocolComponent {...props} onSupportDetected={handleSupportDetected} />
		);
	}

	return (
		<ImageRenderer
			protocol={protocol}
			{...props}
			onSupportDetected={handleSupportDetected}
		/>
	);
}

export const ImageProtocols = protocolRegistry.getAllProtocols();
export default Image;
