import {type ImageProps, ImageProtocol} from './protocol.js';
import HalfBlockProtocol from './HalfBlock.js';
import BrailleProtocol from './Braille.js';
import SixelProtocol from './Sixel.js';

class AsciiProtocol extends ImageProtocol {
	// @ts-expect-error to be implemented
	override render(props: ImageProps) {
		return null;
	}
}

const protocolFactory = {
	ascii: new AsciiProtocol(),
	halfBlock: new HalfBlockProtocol(),
	braille: new BrailleProtocol(),
	sixel: new SixelProtocol(),
	// Add more protocols as needed
};

// Main Image component
function Image({
	src,
	width,
	height,
	protocol = 'ascii',
	...props
}: ImageProps & {protocol?: keyof typeof protocolFactory}) {
	if (!protocolFactory[protocol]) {
		console.warn(`Unknown protocol "${protocol}", falling back to ASCII`);
		protocol = 'ascii';
	}

	return protocolFactory[protocol].render({src, width, height, ...props});
}

export const ImageProtocols = Object.keys(protocolFactory) as Array<
	keyof typeof protocolFactory
>;
export default Image;
