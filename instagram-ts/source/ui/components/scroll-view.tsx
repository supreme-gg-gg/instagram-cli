import React, {
	useState,
	useEffect,
	useRef,
	type ReactNode,
	useImperativeHandle,
	forwardRef,
} from 'react';
import {Box, type DOMElement} from 'ink';
import measureContentSize from '../../utils/measure-content-size.js';

export type ScrollViewRef = {
	scrollTo: (
		currentOffset: number | ((currentOffset: number) => number),
	) => void;
	scrollToStart: () => void;
	scrollToEnd: () => void;
	getScrollOffset: () => number;
	getContentSize: () => {width: number; height: number};
};

type ScrollDirection = 'vertical' | 'horizontal';

type Props = {
	readonly width: number;
	readonly height: number;
	readonly scrollDirection?: ScrollDirection;
	readonly initialScrollPosition?: 'start' | 'end';
	readonly children: ReactNode;
};

const ScrollView = forwardRef(
	(
		{
			width,
			height,
			children,
			scrollDirection = 'vertical',
			initialScrollPosition = 'end',
		}: Props,
		ref: React.Ref<ScrollViewRef>,
	) => {
		// eslint-disable-next-line @typescript-eslint/ban-types
		const containerRef = useRef<DOMElement | null>(null);
		const [offset, setOffset] = useState<number>(0);
		const [contentSize, setContentSize] = useState<{
			width: number;
			height: number;
		}>({
			width: 0,
			height: 0,
		});

		const scrollTo = (
			currentOffset: number | ((currentOffset: number) => number),
		) => {
			const newOffset =
				typeof currentOffset === 'number'
					? currentOffset
					: currentOffset(offset);

			setOffset(
				Math.max(
					0,
					Math.min(
						scrollDirection === 'vertical'
							? contentSize.height - height
							: contentSize.width - width,
						newOffset,
					),
				),
			);
		};

		const scrollToStart = () => {
			setOffset(0);
		};

		const scrollToEnd = () => {
			setOffset(
				scrollDirection === 'vertical'
					? Math.max(0, contentSize.height - height)
					: Math.max(0, contentSize.width - width),
			);
		};

		const getScrollOffset = () => {
			return offset;
		};

		const getContentSize = () => {
			return contentSize;
		};

		useImperativeHandle(ref, () => ({
			scrollTo,
			scrollToStart,
			scrollToEnd,
			getScrollOffset,
			getContentSize,
		}));

		useEffect(() => {
			if (!containerRef?.current) {
				return;
			}

			const contentSize = measureContentSize(containerRef.current);
			setContentSize(contentSize);
			if (initialScrollPosition === 'end') {
				setOffset(
					scrollDirection === 'vertical'
						? Math.max(0, contentSize.height - height)
						: Math.max(0, contentSize.width - width),
				);
			} else {
				setOffset(0);
			}
		}, [height, width, initialScrollPosition, scrollDirection]);

		return (
			<Box
				flexDirection={scrollDirection === 'horizontal' ? 'row' : 'column'}
				overflow="hidden"
				width={width}
				height={height}
			>
				<Box
					ref={containerRef}
					width={scrollDirection === 'horizontal' ? undefined : '100%'}
					height={scrollDirection === 'vertical' ? undefined : '100%'}
					flexDirection={scrollDirection === 'horizontal' ? 'row' : 'column'}
					// Apply negative margin to shift content based on offset
					// From testing, only margin works but padding doesn't
					// So need an inner Box to apply margin
					marginTop={scrollDirection === 'vertical' ? -offset : undefined}
					marginLeft={scrollDirection === 'horizontal' ? offset : undefined}
				>
					{children}
				</Box>
			</Box>
		);
	},
);

export default ScrollView;
