import React from 'react';
import test, {type ExecutionContext} from 'ava';
import {render} from 'ink-testing-library';
import Index from './source/commands/index.js';

test('sanity check', (t: ExecutionContext) => {
	const {lastFrame} = render(<Index />);

	t.not(lastFrame(), undefined);
});
