#!/usr/bin/env node
import Pastel from 'pastel';
import {initializeLogger} from './utils/logger.js';

// Initialize logger as early as possible
await initializeLogger();

const app = new Pastel({
	importMeta: import.meta,
});

await app.run();
