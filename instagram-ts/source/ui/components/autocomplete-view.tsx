import React from 'react';
import {Box, Text} from 'ink';

type AutocompleteViewProps = {
	readonly suggestions: readonly string[];
	readonly selectedIndex: number;
};

const MAX_SUGGESTIONS = 3;

export function AutocompleteView({
	suggestions,
	selectedIndex,
}: AutocompleteViewProps) {
	if (suggestions.length === 0) {
		return null;
	}

	let visibleSuggestions: readonly string[];
	let startIndex = 0;
	const showScrollIndicators = suggestions.length > MAX_SUGGESTIONS;

	if (showScrollIndicators) {
		const offset = Math.floor(MAX_SUGGESTIONS / 2);
		startIndex = Math.max(0, selectedIndex - offset);
		startIndex = Math.min(startIndex, suggestions.length - MAX_SUGGESTIONS);
		visibleSuggestions = suggestions.slice(
			startIndex,
			startIndex + MAX_SUGGESTIONS,
		);
	} else {
		visibleSuggestions = suggestions;
	}

	const hasMoreAbove = showScrollIndicators && startIndex > 0;
	const hasMoreBelow =
		showScrollIndicators && startIndex + MAX_SUGGESTIONS < suggestions.length;

	return (
		<Box flexDirection="column" marginTop={1}>
			{hasMoreAbove && <Text dimColor>...</Text>}
			{visibleSuggestions.map((suggestion, index) => {
				const actualIndex = startIndex + index;
				return (
					<Text
						key={suggestion}
						color={actualIndex === selectedIndex ? 'blue' : 'gray'}
					>
						{suggestion}
					</Text>
				);
			})}
			{hasMoreBelow && (
				<Text dimColor>... (Scroll up or down with arrow keys)</Text>
			)}
		</Box>
	);
}
