/**
 * Props interface for image rendering components.
 *
 * **Important:** Components using these props must be rendered within a
 * `<TerminalInfoProvider>` context to access terminal capabilities and dimensions.
 *
 * @interface ImageProps
 */
export interface ImageProps {
	/**
	 * The source URL or file path of the image to render
	 * Supports all image formats supported by sharp (JPEG, PNG, WebP, AVIF, GIF, SVG, TIFF)
	 */
	src: string;
	/** Optional width constraint in terminal characters/cells */
	width?: number;
	/** Optional height constraint in terminal characters/cells */
	height?: number;
	/** Alternative text displayed while loading or on error */
	alt?: string;
	/** Callback function to notify parent component about protocol support detection */
	onSupportDetected: (isSupported: boolean) => void;
}

/**
 * Interface defining an image rendering protocol.
 *
 * Each protocol represents a different method of displaying images in the terminal,
 * such as ASCII art, Sixel graphics, Braille patterns, or Unicode half-blocks.
 *
 * @interface ImageProtocol
 */
export interface ImageProtocol {
	/** Function that renders the image using this protocol */
	render(props: ImageProps): JSX.Element | null;
	/** Unique identifier for this protocol */
	name: string;
}
