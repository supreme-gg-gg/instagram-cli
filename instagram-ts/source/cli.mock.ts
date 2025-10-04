import meow from 'meow';
import {run} from './app.mock.js';

const cli = meow(
	`
	Usage
	  $ npm run start:mock

	Options
	  --chat   Render the chat view (default)
	  --feed   Render the feed view
	`,
	{
		importMeta: import.meta,
		flags: {
			feed: {
				type: 'boolean',
			},
		},
	},
);

const view = cli.flags.feed ? 'feed' : 'chat';

// This is the entrypoint for the mock application
run(view);
