import {useState, useEffect} from 'react';
import {InstagramClient} from '../../client.js';
import {ConfigManager} from '../../config.js';
import {SessionManager} from '../../session.js';
import {createContextualLogger} from '../../utils/logger.js';

const logger = createContextualLogger('useInstagramClient');

type UseInstagramClientResult = {
	client: InstagramClient | undefined;
	isLoading: boolean;
	error: string | undefined;
};

type InstagramClientOptions = {
	realtime?: boolean;
};

export function useInstagramClient(
	usernameArgument?: string,
	options: InstagramClientOptions = {},
): UseInstagramClientResult {
	const [client, setClient] = useState<InstagramClient | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		const initializeClient = async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				let targetUsername = usernameArgument;
				targetUsername ??=
					config.get('login.currentUsername') ??
					config.get('login.defaultUsername');

				if (!targetUsername) {
					setError(
						'No username specified. Please login first or specify a username.',
					);
					setIsLoading(false);
					return;
				}

				const sessionManager = new SessionManager(targetUsername);
				const sessionExists = await sessionManager.sessionExists();

				if (!sessionExists) {
					setError(
						`No session found for ${targetUsername}. Please login first.`,
					);
					setIsLoading(false);
					return;
				}

				const instagramClient = new InstagramClient(targetUsername);
				const loginResult = await instagramClient.loginBySession({
					initializeRealtime: options.realtime ?? true,
				});

				if (!loginResult.success) {
					// Only the auth login command can handle these cases
					if (loginResult.checkpointError) {
						setError(
							'Challenge required. Please run the `login` command to resolve.',
						);
					} else {
						setError(
							loginResult.error ??
								'Failed to login with session, try logging in with password again.',
						);
					}

					setIsLoading(false);
					return;
				}

				setClient(instagramClient);
				setIsLoading(false);
			} catch (error_) {
				logger.error('Failed to initialize client', error_);
				setError(
					`Failed to initialize Instagram client: ${
						error_ instanceof Error ? error_.message : String(error_)
					}`,
				);
				setIsLoading(false);
			}
		};

		void initializeClient();
	}, [usernameArgument, options.realtime]);

	return {client, isLoading, error};
}
