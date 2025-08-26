import React, {createContext, useState, useContext, useEffect} from 'react';
import replied from 'replied';
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
	dimensions?: TerminalDimensions;
	capabilities?: TerminalCapabilities;
}

export const TerminalDimensionsContext = createContext<
	TerminalDimensions | undefined
>(undefined);

export const TerminalCapabilitiesContext = createContext<
	TerminalCapabilities | undefined
>(undefined);

export const TerminalDimensionsProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [terminalDimensions, setTerminalDimensions] = useState<
		TerminalDimensions | undefined
	>(undefined);

	useEffect(() => {
		const queryPixelDimensions = async () => {
			const pixelDimensionsResponse = await replied('\x1b[14t'); // query for pixel dimensions
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
			setTerminalDimensions({
				viewportWidth: width,
				viewportHeight: height,
				cellWidth: width / process.stdout.columns,
				cellHeight: height / process.stdout.rows,
			});
		};
		queryPixelDimensions();
	}, []);

	return (
		<TerminalDimensionsContext.Provider value={terminalDimensions}>
			{children}
		</TerminalDimensionsContext.Provider>
	);
};

export const TerminalCapabilitiesProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [terminalCapabilities, setTerminalCapabilities] = useState<
		TerminalCapabilities | undefined
	>(undefined);

	useEffect(() => {
		const queryCapabilities = async () => {
			// TODO: "Note that the check is quite naive. It just assumes all non-Windows terminals support Unicode and hard-codes which Windows terminals that do support Unicode. However, people have been using this logic in some popular packages for years without problems."
			const supportsUnicode = checkIsUnicodeSupported();
			// TODO: consider checking for more precise capabilities like 256 colors oand 16m colors
			const isColorSupported = !!supportsColor.stdout;
			// The kitty docs wants us to query for kitty support before terminal attributes
			// Example response: \x1b_Gi=31;error message or OK\x1b\, or nothing
			const kittyResponse = await replied(
				'\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\',
			);
			let supportsKittyGraphics = false;
			if (kittyResponse && kittyResponse.includes('OK')) {
				supportsKittyGraphics = true;
			}
			// Response will include '4' if sixel is supported
			const deviceAttributesResponse = await replied('\x1b[c');
			let supportsSixelGraphics = false;
			if (
				deviceAttributesResponse &&
				deviceAttributesResponse.split(';').find(attr => attr === '4')
			) {
				supportsSixelGraphics = true;
			}

			setTerminalCapabilities({
				supportsUnicode,
				supportsColor: isColorSupported,
				supportsKittyGraphics,
				supportsSixelGraphics,
				supportsITerm2Graphics: false, // TODO
			});
		};
		queryCapabilities();
	}, []);

	return (
		<TerminalCapabilitiesContext.Provider value={terminalCapabilities}>
			{children}
		</TerminalCapabilitiesContext.Provider>
	);
};

export const TerminalInfoProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => (
	<TerminalDimensionsProvider>
		<TerminalCapabilitiesProvider>{children}</TerminalCapabilitiesProvider>
	</TerminalDimensionsProvider>
);

export const useTerminalDimensions = () => {
	const terminalDimensions = useContext(TerminalDimensionsContext);

	useEffect(() => {
		if (terminalDimensions) return;
		const timeoutId = setTimeout(() => {
			if (!terminalDimensions) {
				throw new Error(
					'Terminal dimensions not available. (Did you forget to wrap your component in <TerminalDimensionsProvider>?)',
				);
			}
		}, 1000);
		// Clean up timeout if component unmounts or terminalDimensions becomes available
		return () => clearTimeout(timeoutId);
	}, [terminalDimensions]);

	return terminalDimensions;
};

export const useTerminalCapabilities = () => {
	const terminalCapabilities = useContext(TerminalCapabilitiesContext);

	useEffect(() => {
		if (terminalCapabilities) return;
		const timeoutId = setTimeout(() => {
			if (!terminalCapabilities) {
				throw new Error(
					'Terminal capabilities not available. (Did you forget to wrap your component in <TerminalCapabilitiesProvider>?)',
				);
			}
		}, 1000);
		// Clean up timeout if component unmounts or terminalCapabilities becomes available
		return () => clearTimeout(timeoutId);
	}, [terminalCapabilities]);

	return terminalCapabilities;
};

export const useTerminalInfo = (): TerminalInfo => {
	const dimensions = useTerminalDimensions();
	const capabilities = useTerminalCapabilities();
	return {dimensions, capabilities};
};
