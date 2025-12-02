import React from 'react';
import {Alert} from '@inkjs/ui';
import zod from 'zod';
import StoryView from '../ui/views/story-view.js';
import {useStories} from '../ui/hooks/use-stories.js';

export const args = zod.tuple([]);

export const options = zod.object({});

export default function Stories(): React.ReactElement {
	const {reels, isLoading, error, loadMore, client} = useStories();

	if (isLoading) {
		return <Alert variant="info">Fetching Instagram stories...</Alert>;
	}

	if (error) {
		return <Alert variant="error">{error}</Alert>;
	}

	if (reels.length === 0 && !isLoading) {
		return <Alert variant="info">No stories to display.</Alert>;
	}

	return <StoryView reels={reels} loadMore={loadMore} client={client} />;
}
