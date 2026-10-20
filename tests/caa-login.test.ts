/* eslint-disable @typescript-eslint/no-unsafe-call */

import test from 'ava';
import {
	extractAppParameter,
	extractEmbeddedLogin,
} from '../source/utils/caa-login.js';

const twoStepApp = 'com.bloks.www.two_step_verification.entrypoint';
const apApp = 'com.bloks.www.ap.two_step_verification.entrypoint_async';

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
