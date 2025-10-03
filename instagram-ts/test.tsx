import React from 'react';
import test, {type ExecutionContext} from 'ava';
import {render} from 'ink-testing-library';
import Index from './source/commands/index.js';
import {AppMock} from './source/app.mock.js';

test('sanity check', (t: ExecutionContext) => {
	const {lastFrame} = render(<Index />);

	t.not(lastFrame(), undefined);
});

test('renders chat view', (t: ExecutionContext) => {
	const {lastFrame} = render(<AppMock view="chat" />);

	t.not(lastFrame(), undefined);
});

test('renders feed view', (t: ExecutionContext) => {
	const {lastFrame} = render(<AppMock view="feed" />);

	t.not(lastFrame(), undefined);
});
