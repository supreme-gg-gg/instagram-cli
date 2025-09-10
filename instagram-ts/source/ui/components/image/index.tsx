import React, {useState, useEffect, useCallback} from 'react';
import {type ImageProps, type ImageProtocol} from './protocol.js';
import AsciiImage from './Ascii.js';
import HalfBlockImage from './HalfBlock.js';
import BrailleImage from './Braille.js';
import SixelImage from './Sixel.js';

/**
 * Creates a registry for managing image rendering protocols.
 *
 * The registry allows registration and retrieval of different image rendering
 * protocols such as ASCII, Braille, Half-block, and Sixel.
 *
 * @returns An object with methods to register and retrieve protocols
 */
const createProtocolRegistry = () => {
	const protocols: Record<string, ImageProtocol> = {};

	return {
		/** Register a new image rendering protocol */
		register: (protocol: ImageProtocol) => {
			protocols[protocol.name] = protocol;
		},

		/** Get a specific protocol by name */
		getProtocol: (name: string) => {
			return protocols[name];
		},

		/** Get all available protocol names */
		getAllProtocols: () => {
			return Object.keys(protocols);
		},
	};
};

// Global protocol registry instance
const protocolRegistry = createProtocolRegistry();

// Register all available image rendering protocols
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

/**
 * Internal component that renders an image using a specific protocol.
 *
 * @param props - Image props with protocol specification
 * @returns JSX element rendering the image with the specified protocol
 */
const ImageRenderer = (props: ImageProps & {protocol: string}) => {
	const ProtocolComponent =
		protocolRegistry.getProtocol(props.protocol)?.render ??
		protocolRegistry.getProtocol('ascii')!.render;
	return <ProtocolComponent {...props} />;
};

/**
 * Main Image component with automatic protocol fallback.
 *
 * This component automatically detects terminal capabilities and falls back
 * to supported rendering protocols in order of preference:
 * sixel -> braille -> halfBlock -> ascii
 *
 * **IMPORTANT: TerminalInfo Provider Requirement**
 * This component MUST be used within a `<TerminalInfoProvider>` component tree.
 * The Image component requires terminal capability detection to function properly
 * and will throw an error if the TerminalInfo context is not available.
 *
 * Example usage:
 * ```tsx
 * import React from 'react';
 * import { Box } from 'ink';
 * import { TerminalInfoProvider } from '../context/TerminalInfo.js';
 * import Image from './components/image/index.js';
 *
 * function App() {
 *   return (
 *     <TerminalInfoProvider>
 *       <Box flexDirection="column">
 *         <Image
 *           src="https://example.com/image.jpg"
 *           width={40}
 *           height={20}
 *           alt="Example image"
 *         />
 *         <Image
 *           src="/local/path/image.png"
 *           protocol="sixel"
 *         />
 *       </Box>
 *     </TerminalInfoProvider>
 *   );
 * }
 * ```
 *
 * Features:
 * - Automatic protocol detection and fallback
 * - Support for multiple image formats (PNG, JPEG, WebP, etc.)
 * - Responsive sizing based on parent container dimensions
 * - Error handling with graceful degradation
 * - Terminal capability detection for optimal rendering
 * - Support for both local files and remote URLs
 *
 * Protocol Options:
 * - `sixel`: Highest quality, requires Sixel graphics support
 * - `braille`: High resolution monochrome, requires Unicode support
 * - `halfBlock`: Good color quality, requires Unicode and color support
 * - `ascii`: Universal compatibility, works in all terminals
 *
 * @param props - Image properties including source, dimensions, and initial protocol
 * @returns JSX element rendering the image with the best supported protocol
 * @throws Error if not used within TerminalInfoProvider context
 */
function Image({
	protocol: initialProtocol = 'ascii',
	...props
}: Omit<ImageProps & {protocol?: string}, 'onSupportDetected'>) {
	const [protocol, setProtocol] = useState(initialProtocol);
	const [supportCheckComplete, setSupportCheckComplete] = useState(false);
	const [fallbackAttempts, setFallbackAttempts] = useState(0);

	/**
	 * Determines the next fallback protocol based on the current protocol and attempt count.
	 *
	 * Fallback hierarchy:
	 * - sixel -> braille -> halfBlock -> ascii
	 * - braille -> halfBlock -> ascii
	 * - halfBlock -> ascii
	 * - ascii (final fallback, always supported)
	 *
	 * @param currentProtocol - The currently attempted protocol
	 * @param attemptCount - Number of fallback attempts made
	 * @returns The next protocol to try
	 */
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

	/**
	 * Handles support detection feedback from child components.
	 *
	 * If the current protocol is supported, marks the support check as complete.
	 * If not supported, attempts to fall back to the next protocol in the hierarchy.
	 *
	 * @param isSupported - Whether the current protocol is supported
	 */
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

	// Render protocol for support detection phase
	if (!supportCheckComplete) {
		// Render the current protocol to detect support
		const ProtocolComponent =
			protocolRegistry.getProtocol(protocol)?.render ??
			protocolRegistry.getProtocol('ascii')!.render;
		return (
			<ProtocolComponent {...props} onSupportDetected={handleSupportDetected} />
		);
	}

	// Render with confirmed supported protocol
	return (
		<ImageRenderer
			protocol={protocol}
			{...props}
			onSupportDetected={handleSupportDetected}
		/>
	);
}

/** Array of all available image rendering protocol names */
export const ImageProtocols = protocolRegistry.getAllProtocols();

export default Image;
