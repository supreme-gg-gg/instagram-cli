import React, {createContext, useState, useContext, useEffect} from 'react';
import queryEscapeSequence from '../../utils/queryEscapeSequence.js';
import supportsColor from 'supports-color';
import checkIsUnicodeSupported from 'is-unicode-supported';

export interface TerminalDimensions {
	viewportWidth: number;
	viewportHeight: number;
	cellWidth: number;
	cellHeight: number;
}

export interface TerminalCapabilities {
	supportsUnicode: boolean;
	supportsColor: boolean;
	supportsSixelGraphics: boolean;
	supportsKittyGraphics: boolean;
	supportsITerm2Graphics: boolean;
}

export interface TerminalInfo {
	dimensions: TerminalDimensions;
	capabilities: TerminalCapabilities;
}

export const TerminalInfoContext = createContext<TerminalInfo | undefined>(
	undefined,
);

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
		}, 5000);
		// Clean up timeout if component unmounts or terminalInfo becomes available
		return () => clearTimeout(timeoutId);
	}, [terminalInfo]);

	return terminalInfo;
};

export const useTerminalDimensions = () => {
	const terminalInfo = useTerminalInfo();
	return terminalInfo?.dimensions;
};

export const useTerminalCapabilities = () => {
	const terminalInfo = useTerminalInfo();
	return terminalInfo?.capabilities;
};
