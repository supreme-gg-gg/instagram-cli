export type UIState = {
	selectedIndex: number;
	scrollOffset: number;
	inputMode: 'normal' | 'insert' | 'command';
	showHelp: boolean;
};

export type ChatLayout = {
	compact: boolean;
	showTimestamps: boolean;
	showUsernames: boolean;
	colors: boolean;
};

export type KeyBinding = {
	key: string;
	description: string;
	action: string;
};
