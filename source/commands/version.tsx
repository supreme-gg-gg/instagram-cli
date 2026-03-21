import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import React, {useState, useEffect} from 'react';
import {Text, Box} from 'ink';
import {readPackageUp} from 'read-package-up';
import {APP_VERSION} from 'instagram-private-api/dist/core/constants.js';

type VersionInfo = {
	cliVersion: string;
	apiVersion: string;
	appVersion: string;
};

export default function Version() {
	const [versionInfo, setVersionInfo] = useState<VersionInfo | undefined>(
		undefined,
	);

	useEffect(() => {
		void (async () => {
			const scriptDir = dirname(fileURLToPath(import.meta.url));
			const cliPkg = await readPackageUp({cwd: scriptDir});

			const apiPkgUrl = import.meta.resolve('instagram-private-api');
			const apiPkg = await readPackageUp({
				cwd: dirname(fileURLToPath(apiPkgUrl)),
			});

			setVersionInfo({
				cliVersion: cliPkg?.packageJson.version ?? 'unknown',
				apiVersion: apiPkg?.packageJson.version ?? 'unknown',
				appVersion: APP_VERSION,
			});
		})();
	}, []);

	if (!versionInfo) {
		return undefined;
	}

	return (
		<Box flexDirection="column">
			<Text>instagram-cli: v{versionInfo.cliVersion}</Text>
			<Text>Using:</Text>
			<Box flexDirection="column" marginLeft={2}>
				<Text>instagram-private-api: v{versionInfo.apiVersion} (patched)</Text>
				<Text>Instagram app version: {versionInfo.appVersion}</Text>
			</Box>
		</Box>
	);
}
