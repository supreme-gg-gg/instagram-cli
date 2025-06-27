#!/usr/bin/env node
import {runCli} from './commands.js';

// Run the CLI
runCli().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
