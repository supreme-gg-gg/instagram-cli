import React from 'react';
import {Box, Text} from 'ink';

type AutocompleteViewProps = {
	readonly suggestions: readonly string[];
	readonly selectedIndex: number;
};

export function AutocompleteView({
	suggestions,
	selectedIndex,
}: AutocompleteViewProps) {
	if (suggestions.length === 0) {
		return null;
	}

	return (
		<Box flexDirection="column" marginTop={1}>
			{suggestions.map((suggestion, index) => (
				<Text
					key={suggestion}
					color={index === selectedIndex ? 'blue' : 'gray'}
				>
					{suggestion}
				</Text>
			))}
		</Box>
	);
}
