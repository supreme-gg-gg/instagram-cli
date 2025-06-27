export interface UIState {
	selectedIndex: number;
	scrollOffset: number;
	inputMode: 'normal' | 'insert' | 'command';
	showHelp: boolean;
}

export interface ChatLayout {
	compact: boolean;
	showTimestamps: boolean;
	showUsernames: boolean;
	colors: boolean;
}

export interface KeyBinding {
	key: string;
	description: string;
	action: string;
}
