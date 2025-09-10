import React, {useEffect} from 'react';
import {useApp} from 'ink';

async function write(content: string) {
	return new Promise<void>((resolve, reject) => {
		process.stdout.write(content, error => {
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
const AltScreen = (props: {children: React.ReactNode}) => {
	const {exit} = useApp();
	useEffect(() => {
		const enterAltScreen = async () => {
			await write('\x1b[?1049h'); // enter alternate buffer
		};
		const leaveAltScreen = async () => {
			await write('\x1b[?1049l'); // exit alternate buffer
			exit();
		};
		enterAltScreen();
		return () => {
			leaveAltScreen();
		};
	}, [exit]);
	return <>{props.children}</>;
};

export default AltScreen;
