import meow from 'meow';
import {run} from './app.mock.js';

const cli = meow(
	`
	Usage
	  $ npm run start:mock

	Options
	  --chat   Render the chat view (default)
	  --feed   Render the feed view
	  --story  Render the story view

	Examples
	  $ npm run start:mock -- --chat
	  $ npm run start:mock -- --feed
	  $ npm run start:mock -- --story
	`,
	{
		importMeta: import.meta,
		flags: {
			feed: {
				type: 'boolean',
			},
			story: {
				type: 'boolean',
			},
		},
	},
);

const view = cli.flags.feed ? 'feed' : cli.flags.story ? 'story' : 'chat';

try {
	await run(view);
} catch {
	// eslint-disable-next-line n/prefer-global/process, unicorn/no-process-exit
	process.exit(1);
}
