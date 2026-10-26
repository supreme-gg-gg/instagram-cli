/* eslint-disable @typescript-eslint/no-unsafe-call */

import test from 'ava';
import {
	base32Decode,
	isValidBase32Secret,
	generateTotp,
	verifyTotp,
} from '../source/utils/totp.js';

test('base32Decode correctly decodes valid base32 strings', t => {
	// "hello" in Base32 is "NBSWY3DP"
	t.is(new TextDecoder().decode(base32Decode('NBSWY3DP')), 'hello');
	// Case insensitivity, spacing, hyphens, and padding
	t.is(new TextDecoder().decode(base32Decode('nbs-wy 3dp===')), 'hello');
});

test('base32Decode throws on invalid base32 characters', t => {
	t.throws(() => base32Decode('NBSWY3DP89!'), {
		message: /Invalid Base32 character/,
	});
});

test('isValidBase32Secret validates base32 strings', t => {
	t.true(isValidBase32Secret('JBSWY3DPEHPK3PXP'));
	t.true(isValidBase32Secret('jbsw-y3dp ehpk3pxp'));
	t.false(isValidBase32Secret(''));
	t.false(isValidBase32Secret('189!'));
});

test('generateTotp matches RFC 6238 reference test vectors (SHA-1)', t => {
	// RFC 6238 test key: "12345678901234567890" -> Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

	t.is(generateTotp(secret, {timestamp: 59 * 1000, digits: 8}), '94287082');
	t.is(generateTotp(secret, {timestamp: 59 * 1000, digits: 6}), '287082');

	t.is(
		generateTotp(secret, {timestamp: 1_111_111_109 * 1000, digits: 6}),
		'081804',
	);
	t.is(
		generateTotp(secret, {timestamp: 1_111_111_111 * 1000, digits: 6}),
		'050471',
	);
	t.is(
		generateTotp(secret, {timestamp: 1_234_567_890 * 1000, digits: 6}),
		'005924',
	);
	t.is(
		generateTotp(secret, {timestamp: 2_000_000_000 * 1000, digits: 6}),
		'279037',
	);
});

test('verifyTotp verifies within allowable time window', t => {
	const secret = 'JBSWY3DPEHPK3PXP';
	const now = 1_700_000_000 * 1000;
	const currentCode = generateTotp(secret, {timestamp: now});

	t.true(verifyTotp(currentCode, secret, {timestamp: now}));
	// Within 1 step window (30 seconds back or ahead)
	t.true(verifyTotp(currentCode, secret, {timestamp: now + 25 * 1000}));
	t.true(verifyTotp(currentCode, secret, {timestamp: now - 25 * 1000}));
	// Outside 1 step window (e.g. 70 seconds)
	t.false(verifyTotp(currentCode, secret, {timestamp: now + 70 * 1000}));
});
