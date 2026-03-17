import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {Text, Box} from 'ink';
import {readPackageUp} from 'read-package-up';

type VersionInfo = {
	cliVersion: string;
	apiVersion: string;
	appVersion: string;
};

export default function Version() {
	const [versionInfo, setVersionInfo] = React.useState<VersionInfo | undefined>(
		undefined,
	);

	React.useEffect(() => {
		void (async () => {
			const scriptDir = dirname(fileURLToPath(import.meta.url));
			const cliPkg = await readPackageUp({cwd: scriptDir});

			const {APP_VERSION} =
				(await import('instagram-private-api/dist/core/constants.js')) as {
					APP_VERSION: string;
				};

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
		return <Text>Loading version info...</Text>;
	}

	return (
		<Box flexDirection="column">
			<Text>instagram-cli: v{versionInfo.cliVersion}</Text>
			<Text>instagram-private-api: v{versionInfo.apiVersion} (patched)</Text>
			<Text>Instagram app version: {versionInfo.appVersion}</Text>
		</Box>
	);
}
