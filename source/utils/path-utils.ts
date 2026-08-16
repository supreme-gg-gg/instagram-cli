import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {cwd} from 'node:process';

/**
 * Expands a path starting with '~' to an absolute path pointing to the user's home directory.
 */
export function expandTilde(filePath: string): string {
	if (filePath === '~') {
		return os.homedir();
	}

	if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
		return path.join(os.homedir(), filePath.slice(2));
	}

	return filePath;
}

/**
 * Resolves a user-provided path to an absolute path, expanding '~' and
 * normalizing relative segments along the way.
 */
export function resolveUserPath(
	filePath: string,
	cwdPath: string = cwd(),
): string {
	const expandedPath = expandTilde(filePath);

	if (path.isAbsolute(expandedPath)) {
		return path.normalize(expandedPath);
	}

	return path.resolve(cwdPath, expandedPath);
}

/** Maximum file size (in bytes) for text embedding via #path syntax. */
const maxTextEmbedBytes = 50 * 1024; // 50 KB

/** Maximum file size (in bytes) for media uploads via :upload. */
const maxMediaUploadBytes = 50 * 1024 * 1024; // 50 MB

/**
 * Path segments and filenames that indicate sensitive files which should
 * never be read or transmitted over the network.
 */
const sensitivePatterns: readonly RegExp[] = [
	/(?:^|\/)\.ssh\//,
	/(?:^|\/)\.gnupg\//,
	/(?:^|\/)\.aws\//,
	/(?:^|\/)\.docker\/config\.json$/,
	/(?:^|\/)\.kube\//,
	/(?:^|\/)\.npmrc$/,
	/(?:^|\/)\.netrc$/,
	/(?:^|\/)\.env(?:\.|$)/,
	/(?:^|\/)\.git\/config$/,
	/(?:^|\/)\.gitconfig$/,
	/(?:^|\/)session\.ts\.json$/,
	/(?:^|\/)credentials(?:\.json)?$/,
	/(?:^|\/)id_(?:rsa|ed25519|ecdsa|dsa)(?:\.pub)?$/,
	/(?:^|\/)known_hosts$/,
	/(?:^|\/)authorized_keys$/,
	/(?:^|\/)\.password/,
	/(?:^|\/)\.token/,
];

export type FileValidationResult = {
	readonly allowed: boolean;
	readonly reason?: string;
	readonly sizeBytes?: number;
};

/**
 * Validates whether a resolved absolute path is safe to read and transmit.
 *
 * Checks performed:
 * 1. Path must be inside the user's home directory (blocks /etc/passwd etc.)
 * 2. Path must not match known sensitive file patterns
 * 3. File size must be within the limit for its intended use
 *
 * @param absolutePath - The fully resolved path to validate.
 * @param mode - 'text' for #path embedding (50 KB cap), 'media' for :upload (50 MB cap).
 * @returns Validation result with allowed flag and reason if blocked.
 */
export async function validateFilePath(
	absolutePath: string,
	mode: 'text' | 'media' = 'text',
): Promise<FileValidationResult> {
	const normalized = path.normalize(absolutePath);
	const home = os.homedir();

	// 1. Must be inside the user's home directory
	if (!normalized.startsWith(home + path.sep) && normalized !== home) {
		return {
			allowed: false,
			reason: `Blocked: path is outside your home directory`,
		};
	}

	// 2. Must not match sensitive file patterns
	for (const pattern of sensitivePatterns) {
		if (pattern.test(normalized)) {
			return {
				allowed: false,
				reason: `Blocked: path matches a sensitive file pattern`,
			};
		}
	}

	// 3. File size must be within the limit
	const maxBytes = mode === 'text' ? maxTextEmbedBytes : maxMediaUploadBytes;
	let stat;
	try {
		stat = await fs.stat(normalized);
	} catch {
		return {allowed: false, reason: `File not found or not accessible`};
	}

	if (stat.size > maxBytes) {
		const limitMb = mode === 'text' ? '50 KB' : '50 MB';
		return {
			allowed: false,
			reason: `File is too large (${formatBytes(stat.size)}, limit: ${limitMb})`,
		};
	}

	return {allowed: true, sizeBytes: stat.size};
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
