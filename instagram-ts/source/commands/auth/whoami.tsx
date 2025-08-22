import React from 'react';
import {Text} from 'ink';
import {ConfigManager} from '../../config.js';

export default function Whoami() {
	const [username, setUsername] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async () => {
			const config = ConfigManager.getInstance();
			await config.initialize();
			const currentUsername = config.get<string>('login.currentUsername');

			if (currentUsername) {
				setUsername(`Currently active account: @${currentUsername}`);
			} else {
				setUsername('No active account found.');
			}
		})();
	}, []);

	return <Text>{username ? username : 'Fetching user...'}</Text>;
}
