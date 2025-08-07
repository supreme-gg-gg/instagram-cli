import {useState, useEffect} from 'react';
import {InstagramClient} from '../../client.js';
import {ConfigManager} from '../../config.js';
import {SessionManager} from '../../session.js';

interface UseInstagramClientResult {
	client: InstagramClient | null;
	isLoading: boolean;
	error: string | null;
}

export function useInstagramClient(
	usernameArg?: string,
): UseInstagramClientResult {
	const [client, setClient] = useState<InstagramClient | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const initializeClient = async () => {
			try {
				const config = ConfigManager.getInstance();
				await config.initialize();

				let targetUsername = usernameArg;
				if (!targetUsername) {
					targetUsername =
						config.get<string>('login.currentUsername') ||
						config.get<string>('login.defaultUsername');
				}

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
				await instagramClient.loginBySession();
				setClient(instagramClient);
				setIsLoading(false);
			} catch (err) {
				setError(
					`Failed to initialize Instagram client: ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
				setIsLoading(false);
			}
		};

		initializeClient();
	}, [usernameArg]);

	return {client, isLoading, error};
}
