import {type FlatXoConfig} from 'xo';

type SwitchExhaustivenessCheckOptions = [
	'error' | 'warn' | 'off',
	{
		/** If 'true', allow 'default' cases on switch statements with exhaustive cases. */
		allowDefaultCaseForExhaustiveSwitch?: boolean;
		/** If 'true', the 'default' clause is used to determine whether the switch statement is exhaustive for union type */
		considerDefaultExhaustiveForUnions?: boolean;
		/** Regular expression for a comment that can indicate an intentionally omitted default case. */
		defaultCaseCommentPattern?: string;
		/** If 'true', require a 'default' clause for switches on non-union types. */
		requireDefaultForNonUnion?: boolean;
	},
];

const xoConfig: FlatXoConfig = {
	prettier: true,
	semicolon: true,
	space: false,
	react: true,
	rules: {
		'react/prop-types': 'off',
		'@typescript-eslint/naming-convention': 'off',
		'@typescript-eslint/no-empty-function': 'off',
		'react/no-array-index-key': 'off',
		'react/require-default-props': 'off',
		'unicorn/prevent-abbreviations': 'off',
		'capitalized-comments': 'off',
		'no-useless-return': 'off',
		'arrow-body-style': 'off',
		'no-console': 'warn',
		'promise/prefer-await-to-then': 'off',
		'react/jsx-no-leaked-render': 'off',
		'@typescript-eslint/switch-exhaustiveness-check': [
			'error',
			{considerDefaultExhaustiveForUnions: true},
		] satisfies SwitchExhaustivenessCheckOptions,
	},
};

export default xoConfig;
