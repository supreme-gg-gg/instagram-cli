export interface ImageProps {
	src: string;
	width?: number;
	height?: number;
	alt?: string;
	onSupportDetected: (isSupported: boolean) => void;
}

export interface ImageProtocol {
	render(props: ImageProps): JSX.Element | null;
	name: string;
}
