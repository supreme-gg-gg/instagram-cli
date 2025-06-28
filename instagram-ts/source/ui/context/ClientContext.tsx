import {createContext, useContext} from 'react';
import {InstagramClient} from '../../client.js';

export const ClientContext = createContext<InstagramClient | null>(null);

export const useClient = () => {
	const client = useContext(ClientContext);
	if (!client) {
		throw new Error('useClient must be used within a ClientProvider');
	}
	return client;
};
