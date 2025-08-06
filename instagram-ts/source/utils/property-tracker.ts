import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function registerProperties(obj: Record<string, any>, fileName: string): void {
	const filePath = path.resolve(__dirname, '../../data', fileName);

	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	if (!fs.existsSync(filePath)) {
		fs.writeFileSync(filePath, JSON.stringify([]));
	}

	const registeredProperties: string[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
	const newKeys = Object.keys(obj).filter(key => !registeredProperties.includes(key));

	if (newKeys.length > 0) {
		console.log(`New properties found: ${newKeys.join(', ')}`);
		registeredProperties.push(...newKeys);
		fs.writeFileSync(filePath, JSON.stringify(registeredProperties, null, 2));
	}
}
