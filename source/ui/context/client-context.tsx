import {createContext, useContext} from 'react';
import {type InstagramClient} from '../../client.js';

export const ClientContext = createContext<InstagramClient | undefined>(
	undefined,
);

export const useClient = () => {
	const client = useContext(ClientContext);
	if (!client) {
		throw new Error('useClient must be used within a ClientProvider');
	}

	return client;
};
