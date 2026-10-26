import {Buffer} from 'node:buffer';
import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode a Base32 string (RFC 4648) into a byte array.
 * Ignores whitespace, hyphens, and padding ('=').
 */
export function base32Decode(input: string): Uint8Array {
	const cleaned = input.toUpperCase().replaceAll(/[\s=-]/g, '');

	let bits = 0;
	let value = 0;
	const bytes: number[] = [];

	for (const char of cleaned) {
		const index = BASE32_ALPHABET.indexOf(char);
		if (index === -1) {
			throw new Error(`Invalid Base32 character: "${char}"`);
		}

		value = (value << 5) | index;
		bits += 5;

		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}

	return new Uint8Array(bytes);
}

/**
 * Validates whether a given string is a valid Base32 secret.
 */
export function isValidBase32Secret(secret: string): boolean {
	if (!secret || typeof secret !== 'string') return false;
	const cleaned = secret.toUpperCase().replaceAll(/[\s=-]/g, '');
	if (cleaned.length === 0) return false;
	for (const char of cleaned) {
		if (!BASE32_ALPHABET.includes(char)) return false;
	}

	return true;
}

export type TotpOptions = {
	/** Digits in the one-time code (default 6). */
	digits?: number;
	/** Period in seconds (default 30). */
	period?: number;
	/** Unix timestamp in milliseconds to evaluate at (default Date.now()). */
	timestamp?: number;
	/** Hash algorithm (default 'sha1', RFC 6238 standard for TOTP). */
	algorithm?: 'sha1' | 'sha256' | 'sha512';
};

/**
 * Generates an RFC 6238 TOTP code from a Base32 secret.
 */
export function generateTotp(secret: string, options?: TotpOptions): string {
	const digits = options?.digits ?? 6;
	const period = options?.period ?? 30;
	const timestamp = options?.timestamp ?? Date.now();
	const algorithm = options?.algorithm ?? 'sha1';

	const key = base32Decode(secret);
	const counter = Math.floor(timestamp / 1000 / period);

	const counterBuffer = Buffer.alloc(8);
	counterBuffer.writeBigUInt64BE(BigInt(counter));

	const hmac = crypto.createHmac(algorithm, key);
	hmac.update(counterBuffer);
	const digest = hmac.digest();

	const offset = digest.at(-1)! & 0x0f;
	const code =
		((digest[offset]! & 0x7f) << 24) |
		((digest[offset + 1]! & 0xff) << 16) |
		((digest[offset + 2]! & 0xff) << 8) |
		(digest[offset + 3]! & 0xff);

	const modulo = 10 ** digits;
	const otp = (code % modulo).toString().padStart(digits, '0');
	return otp;
}

/**
 * Verifies a given TOTP token against a secret with an allowable time-step window.
 */
export function verifyTotp(
	token: string,
	secret: string,
	options?: TotpOptions & {window?: number},
): boolean {
	const window = options?.window ?? 1;
	const period = options?.period ?? 30;
	const timestamp = options?.timestamp ?? Date.now();

	const cleanToken = token.trim();

	for (let i = -window; i <= window; i++) {
		const testTime = timestamp + i * period * 1000;
		const expected = generateTotp(secret, {...options, timestamp: testTime});
		if (expected === cleanToken) {
			return true;
		}
	}

	return false;
}
