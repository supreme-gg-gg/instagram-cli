import React, {useState, useEffect} from 'react';
import {type ImageProps, type ImageProtocol} from './protocol.js';
import HalfBlockImage from './HalfBlock.js';
import BrailleImage from './Braille.js';
import SixelImage from './Sixel.js';

// @ts-expect-error to be implemented
function AsciiImage(props: ImageProps) {
	return null;
}

const createProtocolRegistry = () => {
	const protocols: Record<string, ImageProtocol> = {};

	return {
		register: (protocol: ImageProtocol) => {
			if (protocol.isSupported === undefined) {
				protocol.isSupported = async () => true;
			}
			protocols[protocol.name] = protocol;
		},

		getProtocol: (name: string) => {
			return protocols[name];
		},
		getAllProtocols: () => {
			return Object.keys(protocols);
		},
	};
};

const protocolRegistry = createProtocolRegistry();
protocolRegistry.register({
	name: 'ascii',
	render: AsciiImage,
});
protocolRegistry.register({
	name: 'halfBlock',
	render: HalfBlockImage,
});
protocolRegistry.register({
	name: 'braille',
	render: BrailleImage,
});
protocolRegistry.register({
	name: 'sixel',
	render: SixelImage,
});

const ImageRenderer = (props: ImageProps & {protocol: string}) => {
	const ProtocolComponent =
		protocolRegistry.getProtocol(props.protocol)?.render ??
		protocolRegistry.getProtocol('ascii')!.render;
	return <ProtocolComponent {...props} />;
};

// Main Image component
function Image({
	protocol: initialProtocol = 'ascii',
	...props
}: ImageProps & {protocol?: string}) {
	const [protocol, setProtocol] = useState(initialProtocol);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let isMounted = true;
		setLoading(true);
		const p = protocolRegistry.getProtocol(initialProtocol);
		const check = async () => {
			let newProtocol = 'ascii';
			if (p && (await p.isSupported!())) {
				newProtocol = initialProtocol;
			}
			if (isMounted) {
				setProtocol(newProtocol);
				setLoading(false);
			}
		};
		check();
		return () => {
			isMounted = false;
		};
	}, [initialProtocol]);

	if (loading) {
		return null;
	}

	return <ImageRenderer protocol={protocol} {...props} />;
}

export const ImageProtocols = protocolRegistry.getAllProtocols();
export default Image;
