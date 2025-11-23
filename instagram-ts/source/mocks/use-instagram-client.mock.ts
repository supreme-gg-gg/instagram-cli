import type {InstagramClient} from '../client.js';
import {mockClient} from './index.js';

type UseInstagramClientResult = {
	client: InstagramClient | undefined;
	isLoading: boolean;
	error: string | undefined;
};

/**
 * Mock version of useInstagramClient that returns the mock client immediately
 * without any session loading or authentication.
 * Use this in mock/test environments to bypass real Instagram API calls.
 */
export function useInstagramClient(): UseInstagramClientResult {
	return {
		client: mockClient,
		isLoading: false,
		error: undefined,
	};
}
