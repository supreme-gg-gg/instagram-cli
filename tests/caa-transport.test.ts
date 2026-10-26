/* eslint-disable @typescript-eslint/no-unsafe-call */

import http2 from 'node:http2';
import test from 'ava';
import {CaaTransport} from '../source/utils/caa-transport.js';

test.serial('CaaTransport closes and invalidates session on close()', t => {
	const transport = new CaaTransport('example.com');
	t.notThrows(() => {
		transport.close();
	});
});

test.serial('CaaTransport resets session when stream times out', async t => {
	const transport = new CaaTransport('example.com');
	let destroyed = false;

	// Mock http2.connect
	const originalConnect = http2.connect;
	let connectCount = 0;

	(http2 as unknown as {connect: typeof http2.connect}).connect = (() => {
		connectCount++;
		const mockSession = {
			closed: false,
			destroyed: false,
			connecting: false,
			setTimeout() {},
			on() {
				return mockSession;
			},
			close() {
				destroyed = true;
				mockSession.closed = true;
			},
			destroy() {
				destroyed = true;
				mockSession.destroyed = true;
			},
			request() {
				const mockStream = {
					setTimeout(ms: number, cb: () => void) {
						setTimeout(cb, 5);
					},
					close() {},
					on() {
						return mockStream;
					},
					end() {},
				};
				return mockStream;
			},
		};
		return mockSession as unknown as http2.ClientHttp2Session;
	}) as typeof http2.connect;

	try {
		await t.throwsAsync(
			async () => {
				await transport.post('/test', {foo: 'bar'}, {});
			},
			{message: /timed out/},
		);

		t.true(destroyed, 'Session should have been closed/destroyed on timeout');

		// A subsequent request should reconnect rather than reusing the dead session
		await t.throwsAsync(async () => {
			await transport.post('/test-2', {foo: 'bar'}, {});
		});

		t.is(connectCount, 2, 'Should have reconnected for subsequent request');
	} finally {
		(http2 as unknown as {connect: typeof http2.connect}).connect =
			originalConnect;
		transport.close();
	}
});

test.serial('CaaTransport resets session when stream emits error', async t => {
	const transport = new CaaTransport('example.com');
	let destroyed = false;

	const originalConnect = http2.connect;
	let connectCount = 0;

	(http2 as unknown as {connect: typeof http2.connect}).connect = (() => {
		connectCount++;
		const mockSession = {
			closed: false,
			destroyed: false,
			connecting: false,
			setTimeout() {},
			on() {
				return mockSession;
			},
			close() {
				destroyed = true;
				mockSession.closed = true;
			},
			destroy() {
				destroyed = true;
				mockSession.destroyed = true;
			},
			request() {
				const mockStream = {
					setTimeout() {},
					close() {},
					on(event: string, cb: (err?: Error) => void) {
						if (event === 'error') {
							setTimeout(() => {
								cb(new Error('connection reset'));
							}, 5);
						}

						return mockStream;
					},
					end() {},
				};
				return mockStream;
			},
		};
		return mockSession as unknown as http2.ClientHttp2Session;
	}) as typeof http2.connect;

	try {
		await t.throwsAsync(
			async () => {
				await transport.post('/test', {foo: 'bar'}, {});
			},
			{message: /connection reset/},
		);

		t.true(destroyed, 'Session should be closed on stream error');

		await t.throwsAsync(async () => {
			await transport.post('/test-2', {foo: 'bar'}, {});
		});

		t.is(connectCount, 2, 'Should reconnect for next request');
	} finally {
		(http2 as unknown as {connect: typeof http2.connect}).connect =
			originalConnect;
		transport.close();
	}
});

test.serial('CaaTransport handles GET request correctly', async t => {
	const transport = new CaaTransport('example.com');
	const originalConnect = http2.connect;

	(http2 as unknown as {connect: typeof http2.connect}).connect = (() => {
		const mockSession = {
			closed: false,
			destroyed: false,
			connecting: false,
			setTimeout() {},
			on() {
				return mockSession;
			},
			close() {},
			destroy() {},
			request(headers: Record<string, string>) {
				t.is(headers[':method'], 'GET');
				t.is(headers[':path'], '/api/v1/qe/sync/');
				const mockStream = {
					setTimeout() {},
					close() {},
					on(event: string, cb: (...args: any[]) => void) {
						if (event === 'response') {
							setTimeout(() => {
								cb({
									':status': 405,
									'ig-set-password-encryption-key-id': '179',
									'ig-set-password-encryption-pub-key': 'mockpubkey',
								});
							}, 5);
						} else if (event === 'end') {
							setTimeout(cb, 10);
						}

						return mockStream;
					},
					end() {},
				};
				return mockStream;
			},
		};
		return mockSession as unknown as http2.ClientHttp2Session;
	}) as typeof http2.connect;

	try {
		const res = await transport.get('/api/v1/qe/sync/', {});
		t.is(res.statusCode, 405);
		t.is(res.headers['ig-set-password-encryption-key-id'], '179');
		t.is(res.headers['ig-set-password-encryption-pub-key'], 'mockpubkey');
	} finally {
		(http2 as unknown as {connect: typeof http2.connect}).connect =
			originalConnect;
		transport.close();
	}
});
