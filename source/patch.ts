/* eslint-disable import-x/order, import-x/newline-after-import, import-x/no-extraneous-dependencies, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

// 1. Patch constants
const constants = require('instagram-private-api/dist/core/constants');
Object.defineProperty(constants, 'APP_VERSION', {value: '416.0.0.47.66'});
Object.defineProperty(constants, 'APP_VERSION_CODE', {value: '382206157'});

// 2. Patch DirectThreadEntity.broadcastText
// Deferred to avoid triggering circular dependency chains in the library's
// internal module graph. The patch is applied lazily on first require.
let patched = false;
const originalLoad = require('node:module')._load;
require('node:module')._load = function (request: string, ...args: any[]) {
	const result = originalLoad.call(this, request, ...args);
	if (!patched && request.includes('direct-thread.entity')) {
		patched = true;
		result.DirectThreadEntity.prototype.broadcastText = async function (
			text: string,
			reply_to_message?: any,
			skipLinkCheck?: boolean,
		) {
			if (!skipLinkCheck) {
				const urlRegexSafe = require('url-regex-safe');
				const urls = text.match(urlRegexSafe({strict: false}));
				if (Array.isArray(urls)) {
					return this.broadcastLink(text, urls);
				}
			}

			const form: any = {text};

			if (reply_to_message) {
				form.replied_to_action_source = 'swipe';
				form.replied_to_item_id = reply_to_message.item_id;
				form.replied_to_client_context = reply_to_message.client_context;
			}

			return this.broadcast({
				item: 'text',
				form,
			});
		};
	}

	return result;
};
