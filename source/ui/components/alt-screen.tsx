import {useEffect, useCallback, type default as React} from 'react';
import {useApp, useStdout} from 'ink';

async function write(content: string, stdout: NodeJS.WriteStream) {
	return new Promise<void>((resolve, reject) => {
		stdout.write(content, error => {
			if (error) reject(error);
			else resolve();
		});
	});
}

/**
 * This component renders its children in an alternate screen buffer.
 * Original buffer is restored upon unmount.
 *
 * **IMPORTANT**
 * This component must be used at the top level of your application in order to not leave behind any artifacts.
 * ```
 * const App = () => {
 *   return (
 *     <AltScreen>
 *       <YourComponent />
 *     </AltScreen>
 *   );
 * };
 * ```
 */
// eslint-disable-next-line @typescript-eslint/promise-function-async
function AltScreen(properties: {children: React.ReactNode}) {
	const {exit} = useApp();
	const {stdout} = useStdout();
	const enterAltScreen = useCallback(async () => {
		await write('\u001B[?1049h', stdout); // Enter alternate buffer
	}, [stdout]);

	const leaveAltScreen = useCallback(async () => {
		await write('\u001B[?1049l', stdout); // Exit alternate buffer
		exit();
	}, [exit, stdout]);

	useEffect(() => {
		return () => {
			void leaveAltScreen();
		};
	}, [exit, enterAltScreen, leaveAltScreen]);

	void enterAltScreen();
	return properties.children;
}

export default AltScreen;
