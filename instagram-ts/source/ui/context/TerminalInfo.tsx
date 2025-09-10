import React, {createContext, useState, useContext, useEffect} from 'react';
import queryEscapeSequence from '../../utils/queryEscapeSequence.js';
import supportsColor from 'supports-color';
import checkIsUnicodeSupported from 'is-unicode-supported';

/**
 * Terminal dimensions in pixels and character cells.
 */
export interface TerminalDimensions {
	/** Terminal viewport width in pixels */
	viewportWidth: number;
	/** Terminal viewport height in pixels */
	viewportHeight: number;
	/** Width of a single character cell in pixels */
	cellWidth: number;
	/** Height of a single character cell in pixels */
	cellHeight: number;
}

/**
 * Terminal capabilities for different rendering protocols.
 */
export interface TerminalCapabilities {
	/** Whether the terminal supports Unicode characters */
	supportsUnicode: boolean;
	/** Whether the terminal supports color output */
	supportsColor: boolean;
	/** Whether the terminal supports Sixel graphics protocol */
	supportsSixelGraphics: boolean;
	/** Whether the terminal supports Kitty graphics protocol */
	supportsKittyGraphics: boolean;
	/**
	 * Whether the terminal supports iTerm2 inline images
	 * @deprecated This is NOT implemented yet
	 */
	supportsITerm2Graphics: boolean;
}

/**
 * Complete terminal information including dimensions and capabilities.
 */
export interface TerminalInfo {
	/** Physical and logical dimensions of the terminal */
	dimensions: TerminalDimensions;
	/** Supported rendering capabilities */
	capabilities: TerminalCapabilities;
}

/**
 * React context for sharing terminal information throughout the component tree.
 *
 * This context provides terminal dimensions and capabilities to child components.
 * It is undefined until the TerminalInfoProvider completes its initialization.
 * @todo maybe use a state management solution instead
 */
export const TerminalInfoContext = createContext<TerminalInfo | undefined>(
	undefined,
);

/**
 * TerminalInfo Provider Component
 *
 * This provider component must wrap any components that need terminal information,
 * including the Image component and any other components that depend on terminal
 * capabilities or dimensions.
 *
 * **Initialization Process:**
 * 1. Queries terminal dimensions using escape sequences
 * 2. Detects Unicode support using environment checks
 * 3. Detects color support using environment checks
 * 4. Tests graphics protocol support (Kitty, Sixel)
 * 5. Provides complete terminal information to child components
 *
 * **Required for:**
 * - Image rendering components (automatic protocol selection)
 * - Layout components that need precise dimensions
 * - Any component that adapts behavior based on terminal capabilities
 *
 * **Usage:**
 * ```tsx
 * import { TerminalInfoProvider } from './context/TerminalInfo.js';
 * import Image from './components/image/index.js';
 *
 * function App() {
 *   return (
 *     <TerminalInfoProvider>
 *       <Image src="image.jpg" />
 *       // Other components that need terminal info
 *     </TerminalInfoProvider>
 *   );
 * }
 * ```
 *
 * **Error Handling:**
 * Components using terminal info hooks will throw helpful error messages
 * if they detect they're not wrapped in this provider after a 2-second timeout.
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to terminal info
 * @returns JSX element providing terminal information context
 */
export const TerminalInfoProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [terminalInfo, setTerminalInfo] = useState<TerminalInfo | undefined>(
		undefined,
	);

	useEffect(() => {
		const queryTerminalInfo = async () => {
			// Terminal dimensions in pixels
			const pixelDimensionsResponse = await queryEscapeSequence('\x1b[14t');
			if (!pixelDimensionsResponse) {
				// TODO: add fallback to default values
				throw new Error('Failed to determine terminal size in pixels.');
			}
			// example format: "\x1b[4;1012;1419t"
			const parsedResponse =
				// eslint-disable-next-line no-control-regex
				pixelDimensionsResponse.match(/\x1b\[4;(\d+);(\d+)t/);
			if (!parsedResponse || !parsedResponse[1] || !parsedResponse[2]) {
				throw new Error('Failed to determine terminal size.');
			}
			const height = parseInt(parsedResponse[1], 10);
			const width = parseInt(parsedResponse[2], 10);
			if (Number.isNaN(height) || Number.isNaN(width)) {
				throw new Error('Failed to determine terminal size.');
			}
			const dimensions: TerminalDimensions = {
				viewportWidth: width,
				viewportHeight: height,
				cellWidth: width / process.stdout.columns,
				cellHeight: height / process.stdout.rows,
			};

			// Capabilities
			// TODO: "Note that the check is quite naive. It just assumes all non-Windows terminals support Unicode and hard-codes which Windows terminals that do support Unicode. However, people have been using this logic in some popular packages for years without problems."
			const supportsUnicode = checkIsUnicodeSupported();
			// TODO: consider checking for more precise capabilities like 256 colors oand 16m colors
			const isColorSupported = !!supportsColor.stdout;
			// The kitty docs wants us to query for kitty support before terminal attributes
			// Example response: \x1b_Gi=31;error message or OK\x1b\, or nothing
			const kittyResponse = await queryEscapeSequence(
				'\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\ \x1b[c',
			);
			let supportsKittyGraphics = false;
			if (kittyResponse && kittyResponse.includes('OK')) {
				supportsKittyGraphics = true;
			}
			// Response will include '4' if sixel is supported
			const deviceAttributesResponse = await queryEscapeSequence('\x1b[c');
			let supportsSixelGraphics = false;
			if (
				deviceAttributesResponse &&
				deviceAttributesResponse.endsWith('c') &&
				deviceAttributesResponse
					.slice(0, -1)
					.split(';')
					.find(attr => attr === '4')
			) {
				supportsSixelGraphics = true;
			}

			const capabilities: TerminalCapabilities = {
				supportsUnicode,
				supportsColor: isColorSupported,
				supportsKittyGraphics,
				supportsSixelGraphics,
				supportsITerm2Graphics: false, // TODO
			};

			setTerminalInfo({
				dimensions,
				capabilities,
			});
		};
		queryTerminalInfo();
	}, []);

	return (
		<TerminalInfoContext.Provider value={terminalInfo}>
			{children}
		</TerminalInfoContext.Provider>
	);
};

/**
 * Hook to access complete terminal information.
 *
 * **Error Handling:**
 * This hook implements a 2-second timeout to detect if it's being used
 * outside of a TerminalInfoProvider. If no terminal info is available
 * after the timeout, it throws a helpful error message.
 *
 * @returns TerminalInfo object with dimensions and capabilities, or undefined during initialization
 * @throws Error if not used within TerminalInfoProvider context (after 2-second timeout)
 */
export const useTerminalInfo = () => {
	const terminalInfo = useContext(TerminalInfoContext);

	useEffect(() => {
		if (terminalInfo) return;
		const timeoutId = setTimeout(() => {
			if (!terminalInfo) {
				throw new Error(
					'Terminal info not available. (Did you forget to wrap your component in <TerminalInfoProvider>?)',
				);
			}
		}, 2000);
		// Clean up timeout if component unmounts or terminalInfo becomes available
		return () => clearTimeout(timeoutId);
	}, [terminalInfo]);

	return terminalInfo;
};

/**
 * Hook to access terminal dimensions only.
 *
 * This is a convenience hook that extracts just the dimensions from the
 * terminal info context. Includes the same error handling as useTerminalInfo.
 *
 * @returns TerminalDimensions object or undefined during initialization
 * @throws Error if not used within TerminalInfoProvider context (after 2-second timeout)
 */
export const useTerminalDimensions = () => {
	const terminalInfo = useTerminalInfo();
	return terminalInfo?.dimensions;
};

/**
 * Hook to access terminal capabilities only.
 *
 * This is a convenience hook that extracts just the capabilities from the
 * terminal info context. Includes the same error handling as useTerminalInfo.
 *
 * @returns TerminalCapabilities object or undefined during initialization
 * @throws Error if not used within TerminalInfoProvider context (after 2-second timeout)
 */
export const useTerminalCapabilities = () => {
	const terminalInfo = useTerminalInfo();
	return terminalInfo?.capabilities;
};
