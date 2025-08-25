import React, {createContext, useState, useContext, useEffect} from 'react';
import replied from 'replied';

export interface TerminalDimensions {
	viewportWidth: number;
	viewportHeight: number;
	cellWidth: number;
	cellHeight: number;
}

export const TerminalDimensionsContext = createContext<
	TerminalDimensions | undefined
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

	const terminalDimensionsValue =
		terminalDimensions?.cellHeight &&
		terminalDimensions?.cellWidth &&
		terminalDimensions?.viewportHeight &&
		terminalDimensions?.viewportWidth
			? terminalDimensions
			: undefined;

	return (
		<TerminalDimensionsContext.Provider value={terminalDimensionsValue}>
			{children}
		</TerminalDimensionsContext.Provider>
	);
};

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
