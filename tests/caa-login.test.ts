/* eslint-disable @typescript-eslint/no-unsafe-call */

import test from 'ava';
import {IgApiClient} from 'instagram-private-api';
import {CaaTransport} from '../source/utils/caa-transport.js';
import {getLogger} from '../source/utils/logger.js';
import {
	CaaLogin,
	extractAppParameter,
	extractEmbeddedLogin,
	extractLoginContext,
	summarizeCaaResponse,
} from '../source/utils/caa-login.js';

const twoStepApp = 'com.bloks.www.two_step_verification.entrypoint';
const apApp = 'com.bloks.www.ap.two_step_verification.entrypoint_async';

for (const scenario of [
	{kind: 'missing-context', expected: 'preflight missing aac'},
	{kind: 'http-error', expected: 'rejected (HTTP 400)'},
	{kind: 'invalid-json', expected: 'returned invalid JSON'},
	{kind: 'no-session', expected: 'login returned no session'},
]) {
	test.serial(
		`CAA ${scenario.kind} logs its stage without exposing response secrets`,
		async t => {
			const originalPost = CaaTransport.prototype.post;
			const secret = 'PRIVATE_CONTEXT_COOKIE_TOKEN_PASSWORD';
			const logger = getLogger();
			const start = logger.getBufferedLogs().length;
			try {
				CaaTransport.prototype.post = async path => {
					let body: unknown = {};
					let statusCode = 200;
					if (path === '/graphql_www') {
						body = {data: {usdid_registration: {success: true}}};
					} else if (path.includes('process_client_data')) {
						if (scenario.kind === 'invalid-json') {
							return {statusCode, headers: {}, body: `<html>${secret}</html>`};
						}

						const data =
							scenario.kind === 'missing-context'
								? []
								: [
										{
											data: {
												key: 'CAA_ACCOUNT_ACCESS_CONTEXT:aac',
												initial: secret,
											},
										},
									];
						statusCode = scenario.kind === 'http-error' ? 400 : 200;
						body =
							scenario.kind === 'http-error'
								? {message: `challenge_required ${secret}`, cookies: secret}
								: {layout: {bloks_payload: {data}}};
					} else if (path.includes('create_android_keystore')) {
						body = {challenge_nonce: secret};
					} else if (path.includes('send_login_request')) {
						body = {
							layout: {bloks_payload: {action: `CAA_LOGIN_FALLBACK:${secret}`}},
						};
					}

					return {statusCode, headers: {}, body: JSON.stringify(body)};
				};

				const ig = new IgApiClient();
				ig.state.generateDevice('mock-login');
				ig.state.passwordEncryptionPubKey = 'mock-public-key';
				ig.account.encryptPassword = () => ({
					time: '123',
					encrypted: 'mock-password',
				});

				const login = new CaaLogin(ig);
				if (['http-error', 'invalid-json'].includes(scenario.kind)) {
					await t.throwsAsync(login.login('mock-login', secret));
				} else {
					const outcome = await login.login('mock-login', secret);
					t.is(outcome.status, 'error');
				}

				const logs = logger
					.getBufferedLogs()
					.slice(start)
					.map(entry => entry.message)
					.join('\n');
				t.true(logs.includes(scenario.expected));
				t.true(logs.includes('Starting CAA login (app='));
				t.false(logs.includes(secret));
			} finally {
				CaaTransport.prototype.post = originalPost;
			}
		},
	);
}

test('extractLoginContext: skips placeholder contexts before a populated context', t => {
	for (const placeholder of [
		'(dkc null)',
		'(dkc "")',
		'(dkc "  ")',
		'(dkc "',
	]) {
		const result = {
			layout: {
				bloks_payload: {
					data: [
						{
							data: {
								key: 'CAA_ACCOUNT_ACCESS_CONTEXT:aac',
								initial_lispy: placeholder,
							},
						},
						{
							data: {
								key: 'CAA_ACCOUNT_ACCESS_CONTEXT:aac',
								initial_lispy: '(dkc "real-context")',
							},
						},
					],
				},
			},
		};
		t.is(extractLoginContext(result), 'real-context');
	}
});

test('extractLoginContext: supports initial strings and ignores unrelated nodes', t => {
	const result = {
		layout: {
			bloks_payload: {
				data: [
					null,
					{data: {key: 'unrelated', initial: 'wrong-context'}},
					{
						data: {
							key: 'CAA_ACCOUNT_ACCESS_CONTEXT:aac',
							initial: 'direct-context',
						},
					},
				],
			},
		},
	};
	t.is(extractLoginContext(result), 'direct-context');
	t.is(extractLoginContext({}), '');
	t.is(
		extractLoginContext({
			layout: {
				bloks_payload: {
					data: [
						{
							data: {
								key: 'CAA_ACCOUNT_ACCESS_CONTEXT:aac',
								initial_lispy: '(dkc null)',
							},
						},
					],
				},
			},
		}),
		'',
	);
});

test('login context diagnostics distinguish missing and malformed context nodes', t => {
	const missing = summarizeCaaResponse({layout: {bloks_payload: {}}});
	t.deepEqual(missing.data, {type: 'undefined'});
	t.is(missing.contextNodeCount, 0);
	const malformed = summarizeCaaResponse({
		layout: {
			bloks_payload: {
				data: [
					null,
					{data: {key: 'unrelated'}},
					{
						data: {
							key: 'CAA_ACCOUNT_ACCESS_CONTEXT:aac',
							initial: 42,
							initial_lispy: '',
						},
					},
				],
			},
		},
	});
	t.is(malformed.dataNodeCount, 3);
	t.is(malformed.contextNodeCount, 1);
	t.deepEqual(malformed.contextNodes, [
		{
			initial: {type: 'number'},
			initialLispy: {type: 'string', length: 0, nonEmpty: false},
		},
	]);
});

test('login context diagnostics never expose arbitrary response values or keys', t => {
	const secret = 'SECRET_CONTEXT_COOKIE_TOKEN_PASSWORD';
	const summary = summarizeCaaResponse({
		[secret]: secret,
		status: secret,
		message: secret,
		headers: {Authorization: secret, 'Set-Cookie': secret},
		layout: {
			bloks_payload: {
				action: `${apApp} ${secret}`,
				data: [
					{
						data: {
							key: 'CAA_ACCOUNT_ACCESS_CONTEXT:aac',
							initial: secret,
							initial_lispy: `(get ${JSON.stringify(secret)})`,
						},
					},
				],
			},
		},
	});
	t.false(JSON.stringify(summary).includes(secret));
	t.deepEqual(summary.markers, ['CAA_ACCOUNT_ACCESS_CONTEXT:aac', apApp]);
	t.is(summary.contextNodes[0]?.initial.type, 'string');
});

test('login context diagnostics tolerate null and identify known errors without logging messages', t => {
	t.deepEqual(summarizeCaaResponse(null).response, {type: 'null'});
	const summary = summarizeCaaResponse({
		status: 'fail',
		message: 'challenge_required: private details',
	});
	t.is(summary.status, 'fail');
	t.deepEqual(summary.markers, ['challenge_required']);
	t.false(JSON.stringify(summary).includes('private details'));
});

// ── extractAppParameter ───────────────────────────────────────────────────────

test('extractAppParameter: pairs the key array with the value array by position', t => {
	const action = `(bk.action.core.Navigate "${twoStepApp}" (f4i (dkc "two_step_verification_context" "flow_source" "should_fallback_to_sms") (dkc "AWctx123" "two_factor_login" false)))`;
	t.is(
		extractAppParameter({action}, twoStepApp, 'two_step_verification_context'),
		'AWctx123',
	);
	t.is(
		extractAppParameter({action}, twoStepApp, 'flow_source'),
		'two_factor_login',
	);
});

test('extractAppParameter: descends into nested server_params', t => {
	const action = String.raw`(bk.action.x "${apApp}" (f4i (dkc "client_input_params" "server_params") (dkc (f4i (dkc) (dkc)) (f4i (dkc "context_data" "screen") (dkc "CTX \"quoted\" (paren)" 3)))))`;
	t.is(
		extractAppParameter({action}, apApp, 'context_data'),
		'CTX "quoted" (paren)',
	);
});

test('extractAppParameter: searches strings nested anywhere in the response', t => {
	const result = {
		layout: {
			bloks_payload: {
				data: [{tree: `"${apApp}" (f4i (dkc "context_data") (dkc "deep"))`}],
			},
		},
	};
	t.is(extractAppParameter(result, apApp, 'context_data'), 'deep');
});

test('extractAppParameter: ignores a map that belongs to a later app reference', t => {
	const action = `"${apApp}" (bk.action.x "com.bloks.www.other.app") (f4i (dkc "context_data") (dkc "wrong"))`;
	t.is(extractAppParameter({action}, apApp, 'context_data'), '');
});

test('extractAppParameter: rejects non-literal values', t => {
	const action = `"${apApp}" (f4i (dkc "context_data") (dkc (bk.action.GetVar "x")))`;
	t.is(extractAppParameter({action}, apApp, 'context_data'), '');
});

test('extractAppParameter: returns empty string when the app is absent', t => {
	t.is(extractAppParameter({action: '(noop)'}, apApp, 'context_data'), '');
});

// ── extractEmbeddedLogin ──────────────────────────────────────────────────────

test('extractEmbeddedLogin: decodes the login payload embedded in the action', t => {
	const payload = JSON.stringify({
		login_response: JSON.stringify({logged_in_user: {pk: 1, username: 'me'}}),
		headers: JSON.stringify({'IG-Set-Authorization': 'Bearer IGT:2:abc'}),
		cookies: 'Set-Cookie: sessionid=1; Path=/',
	});
	const result = {
		layout: {
			bloks_payload: {
				action: `(bk.action.caa.HandleLoginResponse "other" ${JSON.stringify(payload)})`,
			},
		},
	};
	const embedded = extractEmbeddedLogin(result);
	t.deepEqual(embedded?.loginResponse, {
		logged_in_user: {pk: 1, username: 'me'},
	});
	t.is(embedded?.headers['IG-Set-Authorization'], 'Bearer IGT:2:abc');
	t.is(embedded?.rawCookies, 'Set-Cookie: sessionid=1; Path=/');
});

test('extractEmbeddedLogin: returns undefined without a login payload', t => {
	t.is(
		extractEmbeddedLogin({layout: {bloks_payload: {action: '(noop "x")'}}}),
		undefined,
	);
	t.is(extractEmbeddedLogin({}), undefined);
});
