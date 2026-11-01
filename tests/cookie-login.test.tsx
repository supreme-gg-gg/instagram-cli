/* eslint-disable @typescript-eslint/no-unsafe-call */

import React from 'react';
import test from 'ava';
import {render} from 'ink-testing-library';
import {validateBrowserCookies, type BrowserCookies} from '../source/client.js';
import CookieLoginForm from '../source/ui/components/cookie-login-form.js';

const delay = async (ms: number): Promise<void> =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

test('validateBrowserCookies trims and accepts valid values', t => {
	t.deepEqual(
		validateBrowserCookies({
			sessionId: ' 123%3Afake-session ',
			csrfToken: ' fake-csrf ',
			dsUserId: ' 123 ',
		}),
		{
			sessionId: '123%3Afake-session',
			csrfToken: 'fake-csrf',
			dsUserId: '123',
		},
	);
});

test('validateBrowserCookies rejects unsafe or malformed values', t => {
	t.throws(
		() =>
			validateBrowserCookies({
				sessionId: 'fake; Domain=evil.example',
				csrfToken: 'fake-csrf',
				dsUserId: '123',
			}),
		{message: /invalid cookie characters/},
	);
	t.throws(
		() =>
			validateBrowserCookies({
				sessionId: 'fake-session',
				csrfToken: 'fake-csrf',
				dsUserId: 'not-a-number',
			}),
		{message: /only digits/},
	);
});

test.serial('CookieLoginForm masks and submits all cookie values', async t => {
	let submitted: BrowserCookies | undefined;
	let submittedUsername: string | undefined;
	const {lastFrame, stdin, unmount} = render(
		<CookieLoginForm
			onSubmit={(username, cookies) => {
				submittedUsername = username;
				submitted = cookies;
			}}
		/>,
	);

	const sessionId = '123%3Afake-session';
	const csrfToken = 'fake-csrf';
	const dsUserId = '123';

	stdin.write('test.user');
	await delay(20);
	stdin.write('\r');
	await delay(20);

	stdin.write(sessionId);
	await delay(20);
	t.false(lastFrame()?.includes(sessionId));
	stdin.write('\r');
	await delay(20);

	stdin.write(csrfToken);
	await delay(20);
	t.false(lastFrame()?.includes(csrfToken));
	stdin.write('\r');
	await delay(20);

	stdin.write(dsUserId);
	await delay(20);
	t.false(lastFrame()?.includes(dsUserId));
	stdin.write('\r');
	await delay(20);

	t.deepEqual(submitted, {sessionId, csrfToken, dsUserId});
	t.is(submittedUsername, 'test.user');
	unmount();
});
