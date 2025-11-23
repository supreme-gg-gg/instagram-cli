import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function registerProperties(
	object: Record<string, any>,
	fileName: string,
): void {
	const filePath = path.resolve(__dirname, '../../data', fileName);

	const directory = path.dirname(filePath);
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, {recursive: true});
	}

	if (!fs.existsSync(filePath)) {
		fs.writeFileSync(filePath, JSON.stringify([]));
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const registeredProperties: string[] = JSON.parse(
		fs.readFileSync(filePath, 'utf8'),
	);
	const newKeys = Object.keys(object).filter(
		key => !registeredProperties.includes(key),
	);

	if (newKeys.length > 0) {
		registeredProperties.push(...newKeys);
		fs.writeFileSync(filePath, JSON.stringify(registeredProperties, null, 2));
	}
}
