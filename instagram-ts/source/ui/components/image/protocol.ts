export interface ImageProps {
	src: string;
	width?: number;
	height?: number;
	alt?: string;
}

export interface ImageProtocol {
	render(props: ImageProps): JSX.Element | null;
	name: string;
	isSupported?(): Promise<boolean>;
}
