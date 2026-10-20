import {Buffer} from 'node:buffer';
import crypto, {randomInt} from 'node:crypto';
import {type IgApiClient} from 'instagram-private-api';
import {CaaHttpError, CaaTransport} from './caa-transport.js';
import {createContextualLogger} from './logger.js';

/**
 * Instagram's current Android login flow ("CAA", driven by Bloks screens).
 *
 * The legacy `POST /api/v1/accounts/login/` endpoint now answers every
 * request with `needs_upgrade` ("Your version of Instagram is out of date"),
 * regardless of the app version presented. The real app logs in through:
 *
 * 1. USDID registration (a locally generated P-256 device identity)
 * 2. `attestation/create_android_keystore/` (server nonce for X-IG-Attest-Params)
 * 3. `caa.login.process_client_data_and_redirect` (server-issued `aac` context)
 * 4. `caa.login.oauth.token.fetch.async` (credential preflight)
 * 5. `caa.login.async.send_login_request` (the actual login)
 *
 * A successful response embeds the login result (including the
 * `IG-Set-Authorization` bearer token) inside the Bloks action payload.
 * Otherwise the response routes to one of two verification flows, which are
 * driven step by step here so the UI can prompt for a code in between.
 *
 * Request shapes follow instagrapi's implementation (subzeroid/instagrapi,
 * `mixins/bloks.py` and `mixins/attestation.py`).
 */

const caaDomain = 'b.i.instagram.com';
const offlineExperimentGroup = 'caa_iteration_v3_perf_ig_4';
const latencyQplMarkerId = 36_707_139;
// IGUSDIDRegistrationMutation persisted query id
const usdidRegistrationDocId = '124930351917786857261002920888';
const usdidTokenTtl = 3600;
// "Keystore unavailable" attestation state, accepted by the server
const attestationKeystoreError = -1013;

const apEntrypoint = 'com.bloks.www.ap.two_step_verification.entrypoint_async';
const apCodeEntry = 'com.bloks.www.ap.two_step_verification.code_entry';
const apCodeEntryAsync =
	'com.bloks.www.ap.two_step_verification.code_entry_async';
const twoStepEntrypoint = 'com.bloks.www.two_step_verification.entrypoint';

// The app version presented needs a recent Android release; the sample devices
// bundled with instagram-private-api run Android 6–8, which that version
// cannot be installed on. Format: sdk/release; dpi; resolution; manufacturer;
// model; device; cpu
const currentDevices = [
	'34/14; 480dpi; 1344x2992; Google/google; Pixel 8 Pro; husky; husky',
	'34/14; 420dpi; 1080x2400; Google/google; Pixel 8; shiba; shiba',
	'34/14; 420dpi; 1080x2340; samsung; SM-S921B; e1s; s5e9945',
];

type JsonObject = Record<string, unknown>;

/**
 * Replace the generated device with a current Android device, picked
 * deterministically from `seed` so the same account keeps the same device.
 */
export function applyCurrentDevice(ig: IgApiClient, seed: string): void {
	const index =
		crypto.createHash('md5').update(seed).digest().readUInt32BE(0) %
		currentDevices.length;
	ig.state.deviceString = currentDevices[index]!;
}

export type CaaLoginOutcome =
	| {status: 'success'; username?: string}
	| {status: 'code_required'; message: string}
	| {status: 'error'; error: string};

type PendingVerification =
	| {kind: 'profile_code'; submitContext: string}
	| {kind: 'two_step'; context: string; challenge: string};

function base64Url(raw: Uint8Array | string): string {
	return Buffer.from(raw).toString('base64url');
}

/** Read a JSON string literal starting at `start` (which must be a `"`). */
function readJsonString(
	text: string,
	start: number,
): {value: string; end: number} | undefined {
	let escaped = false;
	for (let index = start + 1; index < text.length; index++) {
		const character = text[index];
		if (escaped) {
			escaped = false;
		} else if (character === '\\') {
			escaped = true;
		} else if (character === '"') {
			try {
				const value: unknown = JSON.parse(text.slice(start, index + 1));
				return typeof value === 'string' ? {value, end: index + 1} : undefined;
			} catch {
				return undefined;
			}
		}
	}

	return undefined;
}

/** Return one balanced Bloks `( ... )` expression, respecting quoted strings. */
function parenthesizedExpression(text: string, start: number): string {
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = start; index < text.length; index++) {
		const character = text[index];
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (character === '\\') {
				escaped = true;
			} else if (character === '"') {
				inString = false;
			}

			continue;
		}

		switch (character) {
			case '"': {
				inString = true;

				break;
			}

			case '(': {
				depth++;

				break;
			}

			case ')': {
				depth--;
				if (depth === 0) {
					return text.slice(start, index + 1);
				}

				break;
			}
			// No default
		}
	}

	return '';
}

/** Split a Bloks expression into its direct operands. */
function expressionItems(expression: string): string[] {
	if (!expression.startsWith('(') || !expression.endsWith(')')) {
		return [];
	}

	const items: string[] = [];
	let index = 1;
	while (index < expression.length - 1) {
		const character = expression[index]!;
		if (/\s/.test(character)) {
			index++;
			continue;
		}

		let item: string;
		if (character === '(') {
			item = parenthesizedExpression(expression, index);
		} else if (character === '"') {
			const literal = readJsonString(expression, index);
			item = literal ? expression.slice(index, literal.end) : '';
		} else {
			item = /^[^()\s"]+/.exec(expression.slice(index))?.[0] ?? '';
		}

		if (!item) {
			return [];
		}

		items.push(item);
		index += item.length;
	}

	return items;
}

function collectStrings(value: unknown, output: string[]): void {
	if (typeof value === 'string') {
		output.push(value);
	} else if (Array.isArray(value)) {
		for (const child of value) collectStrings(child, output);
	} else if (value && typeof value === 'object') {
		for (const child of Object.values(value)) collectStrings(child, output);
	}
}

function allStrings(result: unknown): string[] {
	const strings: string[] = [];
	collectStrings(result, strings);
	return strings;
}

/**
 * Look up `key` in a Bloks map, descending into its `server_params` map.
 * Bloks encodes maps as `(f4i (dkc k1 k2 ...) (dkc v1 v2 ...))`: a key array
 * followed by a separate value array, not adjacent key/value pairs.
 */
function readMapParameter(map: string, key: string): string | undefined {
	let expression = map;
	while (expression) {
		const items = expressionItems(expression);
		if (items.length !== 3 || items[0] !== 'f4i') return undefined;
		const keys = expressionItems(items[1]!);
		const values = expressionItems(items[2]!);
		if (
			keys[0] !== 'dkc' ||
			values[0] !== 'dkc' ||
			keys.length !== values.length
		) {
			return undefined;
		}

		expression = '';
		for (let index = 1; index < keys.length; index++) {
			const rawKey = keys[index]!;
			if (!rawKey.startsWith('"')) continue;
			const name: unknown = JSON.parse(rawKey);
			const rawValue = values[index]!;
			if (name === key) {
				// Only accept literal strings, never evaluated expressions
				return rawValue.startsWith('"') ? (JSON.parse(rawValue) as string) : '';
			}

			if (name === 'server_params') {
				expression = rawValue;
			}
		}
	}

	return undefined;
}

/**
 * Read a literal parameter from the static parameter map that a Bloks action
 * passes to `appId`.
 */
export function extractAppParameter(
	result: unknown,
	appId: string,
	key: string,
): string {
	const anchor = JSON.stringify(appId);
	const appReference = /(?<!\w)com\.bloks\.[\w.]+/g;
	for (const text of allStrings(result)) {
		let found = text.indexOf(anchor);
		while (found !== -1) {
			const afterAnchor = found + anchor.length;
			const mapStart = text.indexOf('(f4i', afterAnchor);
			appReference.lastIndex = afterAnchor;
			const nextApp = appReference.exec(text);
			// The map must belong to this app, not to a later app reference
			if (mapStart !== -1 && !(nextApp && nextApp.index < mapStart)) {
				const value = readMapParameter(
					parenthesizedExpression(text, mapStart),
					key,
				);
				if (value !== undefined) return value;
			}

			found = text.indexOf(anchor, afterAnchor);
		}
	}

	return '';
}

/** Depth-first search for a non-empty value by key, descending into JSON strings. */
function findValue(data: unknown, key: string): unknown {
	if (Array.isArray(data)) {
		for (const child of data) {
			const value = findValue(child, key);
			if (value) return value;
		}
	} else if (data && typeof data === 'object') {
		const object = data as JsonObject;
		if (object[key]) return object[key];
		for (const child of Object.values(object)) {
			const value = findValue(child, key);
			if (value) return value;
		}
	} else if (
		typeof data === 'string' &&
		data.length < 10_000 &&
		data.includes(key)
	) {
		try {
			return findValue(JSON.parse(data), key);
		} catch {
			return undefined;
		}
	}

	return undefined;
}

function bloksPayload(result: JsonObject): JsonObject {
	const layout = result['layout'] as JsonObject | undefined;
	return (layout?.['bloks_payload'] as JsonObject | undefined) ?? {};
}

type EmbeddedLogin = {
	loginResponse: JsonObject;
	headers: Record<string, string>;
	rawCookies: string;
};

/** Find the login result Instagram embeds in a Bloks action on success. */
export function extractEmbeddedLogin(
	result: JsonObject,
): EmbeddedLogin | undefined {
	const {action} = bloksPayload(result);
	if (typeof action !== 'string') return undefined;

	let index = action.indexOf('"');
	while (index !== -1) {
		const literal = readJsonString(action, index);
		if (literal?.value.includes('login_response')) {
			try {
				const raw = JSON.parse(literal.value) as JsonObject;
				return {
					loginResponse: JSON.parse(raw['login_response'] as string),
					headers: JSON.parse((raw['headers'] as string) || '{}'),
					rawCookies: (raw['cookies'] as string) ?? '',
				};
			} catch {
				// Not the payload we are after, keep scanning
			}
		}

		index = action.indexOf('"', literal ? literal.end : index + 1);
	}

	return undefined;
}

export class CaaLogin {
	private readonly logger = createContextualLogger('CaaLogin');
	private readonly usdid = crypto.randomUUID();
	private readonly usdidKid = base64Url(crypto.randomBytes(32));
	private readonly usdidKeys = crypto.generateKeyPairSync('ec', {
		namedCurve: 'P-256',
	});

	private waterfallId = crypto.randomUUID();
	private aac = '';
	private attestationNonce = '';
	private pending: PendingVerification | undefined;

	private readonly ig: IgApiClient;
	private readonly transport = new CaaTransport(caaDomain);

	constructor(ig: IgApiClient) {
		this.ig = ig;
	}

	/** Run the preflight and send credentials. */
	public async login(
		username: string,
		password: string,
	): Promise<CaaLoginOutcome> {
		try {
			return await this.runLogin(username, password);
		} finally {
			this.transport.close();
		}
	}

	/** Submit the verification code requested by a previous `login()`. */
	public async submitCode(code: string): Promise<CaaLoginOutcome> {
		try {
			return await this.runSubmitCode(code);
		} finally {
			this.transport.close();
		}
	}

	private async runLogin(
		username: string,
		password: string,
	): Promise<CaaLoginOutcome> {
		this.pending = undefined;
		await this.prepare(username);
		if (!this.aac) {
			return {
				status: 'error',
				error:
					'Instagram did not return a login context (aac). The CAA login flow may have changed.',
			};
		}

		let result: JsonObject;
		try {
			result = await this.sendLoginRequest(username, password);
		} catch (error) {
			if (error instanceof CaaHttpError && error.statusCode === 429) {
				return {
					status: 'error',
					error:
						'Instagram rejected the login request (HTTP 429 Too Many Requests). Repeated attempts can extend this, so wait before trying again.',
				};
			}

			throw error;
		}

		if (this.applyLoginResponse(result)) {
			return this.successOutcome(result);
		}

		return this.routeVerification(result);
	}

	private async runSubmitCode(code: string): Promise<CaaLoginOutcome> {
		const {pending} = this;
		if (!pending) {
			return {status: 'error', error: 'No verification is pending'};
		}

		const result =
			pending.kind === 'profile_code'
				? await this.submitProfileCode(pending.submitContext, code.trim())
				: await this.submitTwoStepCode(pending, code.trim());

		if (this.applyLoginResponse(result)) {
			this.pending = undefined;
			return this.successOutcome(result);
		}

		return {
			status: 'error',
			error: 'Instagram did not accept the verification code.',
		};
	}

	private successOutcome(result: JsonObject): CaaLoginOutcome {
		const user = extractEmbeddedLogin(result)?.loginResponse[
			'logged_in_user'
		] as JsonObject | undefined;
		const username = user?.['username'];
		return {
			status: 'success',
			username: typeof username === 'string' ? username : undefined,
		};
	}

	private async routeVerification(
		result: JsonObject,
	): Promise<CaaLoginOutcome> {
		const strings = allStrings(result);

		// Profile code challenge: Instagram emails/texts a one-time code
		if (strings.some(text => text.includes(apEntrypoint))) {
			const entryContext = extractAppParameter(
				result,
				apEntrypoint,
				'context_data',
			);
			if (entryContext) {
				const entry = await this.apEntrypoint(entryContext);
				const codeContext = extractAppParameter(
					entry,
					apCodeEntry,
					'context_data',
				);
				if (codeContext) {
					const codeEntry = await this.apCodeEntry(codeContext);
					const submitContext = extractAppParameter(
						codeEntry,
						apCodeEntryAsync,
						'context_data',
					);
					if (submitContext) {
						this.pending = {kind: 'profile_code', submitContext};
						return {
							status: 'code_required',
							message:
								'Instagram sent a security code to your email or phone. Enter it below.',
						};
					}
				}
			}
		}

		// Two-factor authentication (authenticator app, SMS, or backup code)
		const twoStepContext = this.extractTwoStepContext(result);
		if (twoStepContext) {
			const smsOn = this.flag(result, 'sms_two_factor_on');
			const totpOn = this.flag(result, 'totp_two_factor_on');
			const challenge = smsOn && !totpOn ? 'sms' : 'totp';
			await this.openTwoStepScreens(twoStepContext, challenge);
			this.pending = {kind: 'two_step', context: twoStepContext, challenge};
			return {
				status: 'code_required',
				message:
					challenge === 'sms'
						? 'Enter the two-factor code sent to you via SMS (or an 8-digit backup code).'
						: 'Enter the code from your authenticator app (or an 8-digit backup code).',
			};
		}

		const markers = strings.filter(
			text => text.startsWith('CAA_') && text.includes(':'),
		);
		this.logger.warn(
			`CAA login returned no session. Markers: ${markers.join(', ') || 'none'}`,
		);
		return {
			status: 'error',
			error: markers.some(marker => marker.startsWith('CAA_LOGIN_FALLBACK:'))
				? 'Instagram rejected this login (check your username and password, or try again later).'
				: 'Instagram did not return a session. If you are sure your credentials are correct, wait a while before retrying; repeated attempts get rate limited.',
		};
	}

	private flag(result: JsonObject, key: string): boolean {
		const value = findValue(result, key);
		if (typeof value === 'string') {
			return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
		}

		return Boolean(value);
	}

	private extractTwoStepContext(result: JsonObject): string {
		const value = findValue(result, 'two_step_verification_context');
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}

		const {action} = bloksPayload(result);
		if (typeof action !== 'string') return '';
		return extractAppParameter(
			{action},
			twoStepEntrypoint,
			'two_step_verification_context',
		).trim();
	}

	/** Apply an embedded login response to the client state. */
	private applyLoginResponse(result: JsonObject): boolean {
		const embedded = extractEmbeddedLogin(result);
		if (!embedded) return false;

		const header = (name: string) =>
			Object.entries(embedded.headers).find(
				([key]) => key.toLowerCase() === name,
			)?.[1];

		// An authorization ending in ':' carries no token
		const authorization = header('ig-set-authorization');
		const hasAuthorization = Boolean(
			authorization && !authorization.endsWith(':'),
		);
		if (hasAuthorization) {
			this.ig.state.authorization = authorization!;
		}

		const wwwClaim = header('x-ig-set-www-claim');
		if (wwwClaim) {
			this.ig.state.igWWWClaim = wwwClaim;
		}

		let hasSessionCookie = false;
		for (const line of embedded.rawCookies.split(/\r?\n/)) {
			const cookie = line.replace(/^set-cookie:\s*/i, '').trim();
			if (!cookie) continue;
			try {
				this.ig.state.cookieJar.setCookie(cookie, this.ig.state.constants.HOST);
				hasSessionCookie ||= cookie.startsWith('sessionid=');
			} catch (error) {
				this.logger.warn(`Could not store login cookie: ${String(error)}`);
			}
		}

		return hasAuthorization || hasSessionCookie;
	}

	// --- Requests ---------------------------------------------------------

	private get familyDeviceId(): string {
		return this.ig.state.phoneId;
	}

	private get machineId(): string {
		return this.ig.state.extractCookie('mid')?.value ?? '';
	}

	private async post(
		url: string,
		form: Record<string, string>,
		options: {headers?: Record<string, string>} = {},
	): Promise<JsonObject> {
		const cookieUrl = `https://${caaDomain}${url}`;
		const headers = {...this.requestHeaders(), ...options.headers};
		const cookie = this.ig.state.cookieJar.getCookieString(cookieUrl);
		if (cookie) headers['Cookie'] = cookie;

		const response = await this.transport.post(url, form, headers);
		this.logger.debug(`POST ${url} -> ${response.statusCode}`);
		this.updateState(response.headers, cookieUrl);
		// Let the client persist session state, as instagram-private-api requests do
		this.ig.request.end$.next();

		// GraphQL and some Bloks responses carry no `status: ok`, so accept any HTTP 200
		if (response.statusCode !== 200) {
			throw new CaaHttpError('POST', url, response);
		}

		try {
			return JSON.parse(response.body) as JsonObject;
		} catch {
			throw new CaaHttpError('POST', url, response);
		}
	}

	/** Header set of the current Android app, as sent by instagrapi. */
	private requestHeaders(): Record<string, string> {
		const {state} = this.ig;
		const locale = state.language;
		const headers: Record<string, string> = {
			'X-IG-App-Locale': locale,
			'X-IG-Device-Locale': locale,
			'X-IG-Mapped-Locale': locale,
			'X-Pigeon-Session-Id': `UFS-${state.pigeonSessionId}-1`,
			'X-Pigeon-Rawclienttime': (Date.now() / 1000).toFixed(3),
			'X-IG-Bandwidth-Speed-KBPS': (
				randomInt(2_500_000, 3_000_000) / 1000
			).toFixed(3),
			'X-IG-Bandwidth-TotalBytes-B': String(randomInt(5_000_000, 90_000_000)),
			'X-IG-Bandwidth-TotalTime-MS': String(randomInt(2000, 9000)),
			'X-IG-App-Startup-Country': locale.split('_')[1] ?? 'US',
			'X-Bloks-Version-Id': state.bloksVersionId,
			'X-IG-WWW-Claim': state.igWWWClaim ?? '0',
			'X-Bloks-Is-Layout-RTL': 'false',
			'X-Bloks-Is-Panorama-Enabled': 'true',
			'X-IG-Device-ID': state.uuid,
			'X-IG-Family-Device-ID': this.familyDeviceId,
			'X-IG-Android-ID': state.deviceId,
			'X-IG-Timezone-Offset': String(state.timezoneOffset),
			'X-IG-Connection-Type': 'WIFI',
			'X-IG-Capabilities': '3brTv10=',
			'X-IG-App-ID': state.fbAnalyticsApplicationId,
			Priority: 'u=3',
			'User-Agent': state.appUserAgent,
			'Accept-Language': locale.replace('_', '-'),
			'Accept-Encoding': 'gzip, deflate',
			'X-FB-HTTP-Engine': 'Tigon/MNS/TCP',
			'X-Tigon-Is-Retry': 'False',
			'X-Zero-Balance': 'INIT',
			'X-Zero-State': 'unknown',
			'Zero-HTTP-Network-Interface': 'wifi',
			'X-FB-Client-IP': 'True',
			'X-FB-Server-Cluster': 'True',
			'IG-INTENDED-USER-ID': '0',
			'X-IG-SALT-IDS': String(randomInt(1_061_162_222, 1_061_262_222)),
			'X-Meta-Usdid': this.usdidHeader(),
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
		};
		if (this.machineId) headers['X-MID'] = this.machineId;
		if (state.authorization) headers['Authorization'] = state.authorization;
		return headers;
	}

	/** Mirror instagram-private-api's response handling for state headers and cookies. */
	private updateState(
		headers: Record<string, string | string[] | undefined>,
		cookieUrl: string,
	): void {
		const {state} = this.ig;
		const header = (name: string) => {
			const value = headers[name];
			return typeof value === 'string' ? value : undefined;
		};

		this.storeMachineId(header('ig-set-x-mid'));
		const wwwClaim = header('x-ig-set-www-claim');
		if (wwwClaim) state.igWWWClaim = wwwClaim;
		const authorization = header('ig-set-authorization');
		if (authorization && !authorization.endsWith(':')) {
			state.authorization = authorization;
		}

		const keyId = header('ig-set-password-encryption-key-id');
		if (keyId) state.passwordEncryptionKeyId = keyId;
		const pubKey = header('ig-set-password-encryption-pub-key');
		if (pubKey) state.passwordEncryptionPubKey = pubKey;

		const setCookie = headers['set-cookie'];
		for (const cookie of Array.isArray(setCookie) ? setCookie : []) {
			try {
				state.cookieJar.setCookie(cookie, cookieUrl);
			} catch (error) {
				this.logger.warn(`Could not store response cookie: ${String(error)}`);
			}
		}
	}

	/**
	 * Instagram now issues the machine id in an `ig-set-x-mid` header rather
	 * than a `mid` cookie. Store it as the cookie instagram-private-api reads,
	 * so it is sent as X-MID and persisted with the session.
	 */
	private storeMachineId(mid: unknown): void {
		if (typeof mid !== 'string' || !mid || this.machineId) return;
		this.ig.state.cookieJar.setCookie(
			`mid=${mid}; Domain=.instagram.com; Path=/; Secure`,
			this.ig.state.constants.HOST,
		);
	}

	private async bloks(
		kind: 'async_action' | 'apps',
		name: string,
		parameters: JsonObject,
		headers: Record<string, string> = {},
	): Promise<JsonObject> {
		const bloksVersion = this.ig.state.bloksVersionId;
		return this.post(
			`/api/v1/bloks/${kind}/${name}/`,
			{
				params: JSON.stringify(parameters),
				_uuid: this.ig.state.uuid,
				bk_client_context: JSON.stringify({
					bloks_version: bloksVersion,
					styles_id: 'instagram',
				}),
				bloks_versioning_id: bloksVersion,
			},
			{
				headers: {
					'X-FB-Friendly-Name': `IgApi: bloks/${kind}/${name}/`,
					...headers,
				},
			},
		);
	}

	private async prepare(username: string): Promise<void> {
		if (!this.ig.state.passwordEncryptionPubKey) {
			await this.ig.qe.syncLoginExperiments();
		}

		await this.registerUsdid();
		await this.processClientData();
		await this.createAndroidKeystore();
		if (this.aac) {
			await this.oauthTokenFetch(username);
		}
	}

	private usdidSign(message: string): Uint8Array {
		return crypto.sign(
			'sha256',
			Buffer.from(message),
			this.usdidKeys.privateKey,
		);
	}

	private usdidHeader(): string {
		const signed = `${this.usdid}.${Math.floor(Date.now() / 1000) + usdidTokenTtl}`;
		return `${signed}.${base64Url(this.usdidSign(signed))}`;
	}

	private async registerUsdid(): Promise<void> {
		const appId = this.ig.state.fbAnalyticsApplicationId;
		const now = Math.floor(Date.now() / 1000);
		const publicKey = this.usdidKeys.publicKey.export({
			type: 'spki',
			format: 'der',
		});
		const payload = base64Url(
			JSON.stringify({
				sub: this.usdid,
				iat: now,
				aud: appId,
				exp: now + usdidTokenTtl,
				pub: publicKey.toString('base64'),
				alg: 'ES256',
			}),
		);
		const protectedHeader = base64Url(
			JSON.stringify({
				typ: 'JWT',
				alg: 'ES256',
				kid: this.usdidKid,
				aid: appId,
				ver: '1',
			}),
		);
		const token = base64Url(
			JSON.stringify({
				payload,
				signatures: [
					{
						protected: protectedHeader,
						signature: base64Url(
							this.usdidSign(`${protectedHeader}.${payload}`),
						),
					},
				],
			}),
		);
		const friendlyName = 'IGUSDIDRegistrationMutation';
		try {
			const result = await this.post(
				'/graphql_www',
				{
					method: 'post',
					pretty: 'false',
					format: 'json',
					server_timestamps: 'true',
					locale: 'user',
					purpose: 'fetch',
					fb_api_req_friendly_name: friendlyName,
					client_doc_id: usdidRegistrationDocId,
					enable_canonical_naming: 'true',
					enable_canonical_variable_overrides: 'true',
					enable_canonical_naming_ambiguous_type_prefixing: 'true',
					variables: JSON.stringify({
						input: {
							usdid_token: {sensitive_string_value: token},
							fdid: {sensitive_string_value: this.familyDeviceId},
						},
					}),
				},
				{
					headers: {
						'X-FB-Friendly-Name': friendlyName,
						'X-Client-Doc-Id': usdidRegistrationDocId,
						'X-Root-Field-Name': 'usdid_registration',
						'X-Graphql-Client-Library': 'pando',
					},
				},
			);
			const data = (result['data'] as JsonObject | undefined) ?? {};
			const registration = Object.entries(data).find(([key]) =>
				key.includes('usdid_registration'),
			)?.[1] as JsonObject | undefined;
			if (!registration?.['success']) {
				this.logger.warn('USDID registration did not report success');
			}
		} catch (error) {
			// Not fatal on its own; the login request reports the real outcome
			this.logger.warn(`USDID registration failed: ${String(error)}`);
		}
	}

	private async processClientData(): Promise<void> {
		this.waterfallId = crypto.randomUUID();
		const result = await this.bloks(
			'async_action',
			'com.bloks.www.bloks.caa.login.process_client_data_and_redirect',
			{
				is_from_logged_out: false,
				logged_out_user: '',
				qpl_join_id: null,
				family_device_id: this.familyDeviceId,
				device_id: this.ig.state.deviceId,
				offline_experiment_group: offlineExperimentGroup,
				waterfall_id: this.waterfallId,
				logout_source: '',
				show_internal_settings: false,
				last_auto_login_time: 0,
				disable_auto_login: false,
				qe_device_id: this.ig.state.uuid,
				use_auto_login_interstitial: true,
				disable_recursive_auto_login_interstitial: true,
				auto_login_interstitial_experiment_group_name: '',
				is_from_logged_in_switcher: false,
				switcher_logged_in_uid: '',
				account_list: [],
				blocked_uid: [],
				INTERNAL_INFRA_THEME: 'THREE_NEUTRAL_GRAY',
				layered_homepage_experiment_group: 'Deploy: Not in Experiment',
				launched_url: '',
				sim_phone_numbers: [],
				is_from_registration_reminder: false,
			},
		);

		const {data} = bloksPayload(result);
		this.aac = '';
		if (!Array.isArray(data)) return;
		for (const node of data as JsonObject[]) {
			const payload = node?.['data'] as JsonObject | undefined;
			if (payload?.['key'] !== 'CAA_ACCOUNT_ACCESS_CONTEXT:aac') continue;
			const {initial} = payload;
			if (typeof initial === 'string' && initial.trim()) {
				this.aac = initial;
				return;
			}

			const lispy = payload['initial_lispy'];
			if (typeof lispy === 'string') {
				const quote = lispy.indexOf('"');
				this.aac =
					quote === -1 ? '' : (readJsonString(lispy, quote)?.value ?? '');
				return;
			}
		}
	}

	private async createAndroidKeystore(): Promise<void> {
		const result = await this.post(
			'/api/v1/attestation/create_android_keystore/',
			{app_scoped_device_id: this.ig.state.uuid, key_hash: ''},
			{
				headers: {
					'X-FB-Friendly-Name': 'IgApi: attestation/create_android_keystore/',
				},
			},
		);
		const nonce = result['challenge_nonce'];
		this.attestationNonce = typeof nonce === 'string' ? nonce : '';
	}

	private networkInfo(): JsonObject {
		return {
			active_subscriptions_info: null,
			default_subscription_info: {
				network_type: null,
				is_data_roaming: 1,
				is_esim: null,
				is_gsm_roaming: 0,
				is_sim_sms_capable: null,
				is_mobile_data_enabled: 1,
				sim_carrier_id: 1,
				sim_carrier_id_name: null,
				sim_state: 5,
				sim_operator: '310260',
				sim_operator_name: 'T-Mobile',
				signal_strength: null,
				group_id_level_1: null,
				network_operator: '310260',
			},
			is_airplane_mode: 0,
			is_active_network_cellular: 0,
			is_device_sms_capable: 1,
			sim_count: 1,
			is_wifi: 1,
		};
	}

	private async oauthTokenFetch(username: string): Promise<void> {
		await this.bloks(
			'async_action',
			'com.bloks.www.caa.login.oauth.token.fetch.async',
			{
				client_input_params: {
					username_input: username,
					si_device_param_network_info: this.networkInfo(),
					aac: this.aac,
					lois_settings: {lois_token: ''},
					cloud_trust_token: null,
					zero_balance_state: '',
					network_bssid: null,
				},
				server_params: {
					is_from_logged_out: 0,
					layered_homepage_experiment_group: 'Deploy: Not in Experiment',
					device_id: this.ig.state.deviceId,
					login_surface: 'login_home',
					waterfall_id: this.waterfallId,
					INTERNAL__latency_qpl_instance_id: Date.now(),
					is_platform_login: 0,
					login_entry_point: 'logged_out',
					INTERNAL__latency_qpl_marker_id: latencyQplMarkerId,
					family_device_id: this.familyDeviceId,
					offline_experiment_group: offlineExperimentGroup,
					access_flow_version: 'pre_mt_behavior',
					is_from_logged_in_switcher: 0,
					qe_device_id: this.ig.state.uuid,
				},
			},
		);
	}

	private async sendLoginRequest(
		username: string,
		password: string,
	): Promise<JsonObject> {
		const {encrypted, time} = this.ig.account.encryptPassword(password);
		// Recent login screens use short base36-like text input ids
		const textInputId = `${crypto.randomBytes(2).toString('hex')}ig`;
		const headers: Record<string, string> = {};
		if (this.attestationNonce) {
			headers['X-IG-Attest-Params'] = JSON.stringify({
				attestation: [
					{
						version: 2,
						type: 'keystore',
						errors: [attestationKeystoreError],
						challenge_nonce: this.attestationNonce,
						signed_nonce: '',
						key_hash: '',
					},
				],
			});
		}

		return this.bloks(
			'async_action',
			'com.bloks.www.bloks.caa.login.async.send_login_request',
			{
				client_input_params: {
					blocked_uids: [],
					aac: this.aac,
					sim_phones: [],
					aymh_accounts: [],
					network_bssid: null,
					secure_family_device_id: '',
					has_granted_read_contacts_permissions: 0,
					auth_secure_device_id: '',
					has_whatsapp_installed: 0,
					si_device_param_network_info: this.networkInfo(),
					password: `#PWD_INSTAGRAM:4:${time}:${encrypted}`,
					sso_token_map_json_string: '',
					block_store_machine_id: '',
					ig_vetted_device_nonces: null,
					cloud_trust_token: null,
					event_flow: 'login_manual',

					password_contains_non_ascii: String(/[^\p{ASCII}]/u.test(password)),
					client_known_key_hash: '',
					sso_accounts_auth_data: [],
					encrypted_msisdn: '',
					has_granted_read_phone_permissions: 0,
					app_manager_id: '',
					should_show_nested_nta_from_aymh: 0,
					device_id: this.ig.state.deviceId,
					zero_balance_state: '',
					login_attempt_count: 1,
					machine_id: this.machineId,
					flash_call_permission_status: {
						READ_PHONE_STATE: 'DENIED',
						READ_CALL_LOG: 'DENIED',
						ANSWER_PHONE_CALLS: 'DENIED',
					},
					accounts_list: [],
					gms_incoming_call_retriever_eligibility: 'eligible',
					family_device_id: this.familyDeviceId,
					fb_ig_device_id: [],
					device_emails: [],
					try_num: 1,
					lois_settings: {lois_token: ''},
					event_step: 'home_page',
					headers_infra_flow_id: '',
					openid_tokens: {},
					contact_point: username,
				},
				server_params: {
					should_trigger_override_login_2fa_action: 0,
					is_from_logged_out: 0,
					should_trigger_override_login_success_action: 0,
					login_credential_type: 'none',
					server_login_source: 'login',
					waterfall_id: this.waterfallId,
					two_step_login_type: 'one_step_login',
					login_source: 'Login',
					is_platform_login: 0,
					login_entry_point: 'logged_out',
					INTERNAL__latency_qpl_marker_id: latencyQplMarkerId,
					is_from_aymh: 0,
					offline_experiment_group: offlineExperimentGroup,
					is_from_landing_page: 0,
					left_nav_button_action: 'NONE',
					password_text_input_id: `${textInputId}:82`,
					is_from_empty_password: 0,
					is_from_msplit_fallback: 0,
					ar_event_source: 'login_home_page',
					qe_device_id: this.ig.state.uuid,
					username_text_input_id: `${textInputId}:81`,
					layered_homepage_experiment_group: 'Deploy: Not in Experiment',
					device_id: this.ig.state.deviceId,
					login_surface: 'login_home',
					INTERNAL__latency_qpl_instance_id: Date.now(),
					reg_flow_source: 'login_home_native_integration_point',
					is_caa_perf_enabled: 1,
					credential_type: 'password',
					is_from_password_entry_page: 0,
					caller: 'gslr',
					family_device_id: this.familyDeviceId,
					is_from_assistive_id: 0,
					access_flow_version: 'pre_mt_behavior',
					is_from_logged_in_switcher: 0,
				},
			},
			headers,
		);
	}

	// --- Profile code challenge ("we sent a code to your email") ----------

	private async apEntrypoint(contextData: string): Promise<JsonObject> {
		return this.bloks('async_action', apEntrypoint, {
			client_input_params: {
				auth_secure_device_id: '',
				accounts_list: [],
				has_whatsapp_installed: 0,
				family_device_id: this.familyDeviceId,
				machine_id: this.machineId,
			},
			server_params: {
				use_open_instead_of_push: 0,
				context_data: contextData,
				INTERNAL__latency_qpl_marker_id: latencyQplMarkerId,
				INTERNAL__latency_qpl_instance_id: Date.now(),
				device_id: this.ig.state.uuid,
				use_close_instead_of_back: 0,
			},
		});
	}

	private async apCodeEntry(contextData: string): Promise<JsonObject> {
		return this.bloks('apps', apCodeEntry, {
			client_input_params: {aac: this.aac},
			server_params: {
				context_data: contextData,
				show_close_button: 0,
				device_id: this.ig.state.uuid,
				INTERNAL_INFRA_screen_id: 'generic_code_entry',
				is_dismissable: 1,
			},
		});
	}

	private async submitProfileCode(
		contextData: string,
		code: string,
	): Promise<JsonObject> {
		return this.bloks('async_action', apCodeEntryAsync, {
			client_input_params: {
				auth_secure_device_id: '',
				aac: this.aac,
				code,
				family_device_id: this.familyDeviceId,
				device_id: this.ig.state.deviceId,
				machine_id: this.machineId,
			},
			server_params: {
				context_data: contextData,
				INTERNAL__latency_qpl_marker_id: latencyQplMarkerId,
				INTERNAL__latency_qpl_instance_id: Date.now(),
				device_id: this.ig.state.uuid,
			},
		});
	}

	// --- Two-factor authentication ----------------------------------------

	private async openTwoStepScreens(
		context: string,
		challenge: string,
	): Promise<void> {
		const common = {
			two_step_verification_context: context,
			flow_source: 'two_factor_login',
		};
		await this.bloks('apps', twoStepEntrypoint, {
			client_input_params: {
				device_id: this.ig.state.deviceId,
				is_whatsapp_installed: 0,
				machine_id: this.machineId,
			},
			server_params: {
				should_fallback_to_sms: 0,
				family_device_id: this.familyDeviceId,
				device_id: this.ig.state.deviceId,
				...common,
			},
		});
		await this.bloks(
			'apps',
			'com.bloks.www.two_step_verification.method_picker',
			{
				client_input_params: {is_whatsapp_installed: 0},
				server_params: {
					should_fallback_to_sms: 0,
					device_id: this.ig.state.deviceId,
					...common,
				},
			},
		);
		// Selecting the method also triggers the SMS send for SMS accounts
		await this.selectTwoStepMethod(context, challenge);
	}

	private async selectTwoStepMethod(
		context: string,
		method: string,
	): Promise<void> {
		await this.bloks(
			'async_action',
			'com.bloks.www.two_step_verification.method_picker.navigation.async',
			{
				client_input_params: {
					selected_method: method,
					cloud_trust_token: null,
					network_bssid: null,
				},
				server_params: {
					should_fallback_to_sms: 0,
					device_id: this.ig.state.deviceId,
					spectra_reg_login_data: null,
					two_step_verification_context: context,
					flow_source: 'two_factor_login',
				},
			},
		);
	}

	private async submitTwoStepCode(
		pending: Extract<PendingVerification, {kind: 'two_step'}>,
		code: string,
	): Promise<JsonObject> {
		const backupCode = code.replaceAll(/[\s-]+/g, '');
		const isBackupCode = /^\d{8}$/.test(backupCode);
		const challenge = isBackupCode ? 'backup_codes' : pending.challenge;
		const common = {
			two_step_verification_context: pending.context,
			flow_source: 'two_factor_login',
		};
		if (isBackupCode) {
			await this.selectTwoStepMethod(pending.context, challenge);
			await this.bloks(
				'apps',
				'com.bloks.www.two_factor_login.enter_backup_code',
				{
					server_params: {device_id: this.ig.state.deviceId, ...common},
				},
			);
		}

		return this.bloks(
			'async_action',
			'com.bloks.www.two_step_verification.verify_code.async',
			{
				client_input_params: {
					auth_secure_device_id: '',
					block_store_machine_id: '',
					code: isBackupCode ? backupCode : code,
					should_trust_device: 1,
					family_device_id: this.familyDeviceId,
					device_id: this.ig.state.deviceId,
					cloud_trust_token: null,
					network_bssid: null,
					machine_id: this.machineId,
				},
				server_params: {
					should_fallback_to_sms: 0,
					device_id: this.ig.state.deviceId,
					spectra_reg_login_data: null,
					challenge,
					...common,
				},
			},
		);
	}
}
