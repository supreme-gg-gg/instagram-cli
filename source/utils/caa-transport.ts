import {Buffer} from 'node:buffer';
import http2 from 'node:http2';
import zlib from 'node:zlib';

/**
 * Minimal HTTP/2 client for the CAA login requests.
 *
 * Instagram's edge answers `send_login_request` with an empty 429 unless the
 * TLS ClientHello resembles the Android app's: TLS 1.3 only, a single cipher
 * suite, X25519/P-256 and no TLS 1.2-era extensions, over HTTP/2.
 * See subzeroid/instagrapi#2852 and #2862.
 */

// OpenSSL still offers TLS 1.2-era extensions with a TLS 1.3-only range:
// SSL_OP_NO_EXTENDED_MASTER_SECRET | SSL_OP_NO_TICKET | SSL_OP_NO_ENCRYPT_THEN_MAC
// (Node does not export the first constant)
const noLegacyExtensions = 0x1 | 0x40_00 | 0x8_00_00;

export type CaaResponse = {
	statusCode: number;
	headers: http2.IncomingHttpHeaders;
	body: string;
};

export class CaaHttpError extends Error {
	readonly statusCode: number;
	readonly body: string;

	constructor(method: string, path: string, response: CaaResponse) {
		let detail = '';
		try {
			const parsed = JSON.parse(response.body) as Record<string, unknown>;
			if (typeof parsed['message'] === 'string') detail = parsed['message'];
		} catch {}

		super(
			`${method} ${path} - ${response.statusCode}${detail ? `; ${detail}` : ''}`,
		);
		this.name = 'CaaHttpError';
		this.statusCode = response.statusCode;
		this.body = response.body;
	}
}

function decode(raw: Uint8Array, encoding: unknown): string {
	if (encoding === 'gzip') return zlib.gunzipSync(raw).toString('utf8');
	if (encoding === 'deflate') return zlib.inflateSync(raw).toString('utf8');
	return Buffer.from(raw).toString('utf8');
}

export class CaaTransport {
	private readonly origin: string;
	private session: http2.ClientHttp2Session | undefined;

	constructor(host: string) {
		this.origin = `https://${host}`;
	}

	async post(
		path: string,
		form: Record<string, string>,
		headers: Record<string, string>,
	): Promise<CaaResponse> {
		const session = this.connect();
		const body = new URLSearchParams(form).toString();
		return new Promise((resolve, reject) => {
			const stream = session.request({
				[http2.constants.HTTP2_HEADER_METHOD]: 'POST',
				[http2.constants.HTTP2_HEADER_PATH]: path,
				...Object.fromEntries(
					Object.entries(headers).map(([name, value]) => [
						name.toLowerCase(),
						value,
					]),
				),
				'content-length': String(Buffer.byteLength(body)),
			});
			const chunks: Uint8Array[] = [];
			let responseHeaders: http2.IncomingHttpHeaders = {};
			stream.setTimeout(30_000, () => {
				stream.close(http2.constants.NGHTTP2_CANCEL);
				reject(new Error(`POST ${path} timed out`));
			});
			stream.on('response', received => {
				responseHeaders = received;
			});
			stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
			stream.on('error', reject);
			stream.on('end', () => {
				try {
					resolve({
						statusCode: Number(responseHeaders[':status']),
						headers: responseHeaders,
						body: decode(
							Buffer.concat(chunks),
							responseHeaders['content-encoding'],
						),
					});
				} catch (error) {
					reject(error instanceof Error ? error : new Error(String(error)));
				}
			});
			stream.end(body);
		});
	}

	close(): void {
		this.session?.close();
		this.session = undefined;
	}

	private connect(): http2.ClientHttp2Session {
		if (this.session && !this.session.closed && !this.session.destroyed) {
			return this.session;
		}

		const session = http2.connect(this.origin, {
			ALPNProtocols: ['h2'],
			minVersion: 'TLSv1.3',
			maxVersion: 'TLSv1.3',
			ciphers: 'TLS_AES_128_GCM_SHA256',
			ecdhCurve: 'X25519:P-256',
			sigalgs:
				'ecdsa_secp256r1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha256',
			secureOptions: noLegacyExtensions,
			settings: {
				headerTableSize: 65_536,
				enablePush: false,
				maxConcurrentStreams: 1000,
				initialWindowSize: 6_291_456,
				maxHeaderListSize: 262_144,
			},
		});
		session.on('error', () => {
			this.session = undefined;
		});
		session.on('close', () => {
			if (this.session === session) this.session = undefined;
		});
		this.session = session;
		return session;
	}
}
