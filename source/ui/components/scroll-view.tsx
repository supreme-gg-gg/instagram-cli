import React, {
	useState,
	useEffect,
	useRef,
	type ReactNode,
	useImperativeHandle,
	forwardRef,
	useCallback,
} from 'react';
import {Box, type DOMElement} from 'ink';
import useContentSize, {
	findChildAtPosition,
	measureAbsoluteLayout,
} from '../hooks/use-content-size.js';
import {useMouse} from '../context/mouse-context.js';

/**
 * Reference interface for programmatically controlling a ScrollView component.
 * Provides methods to scroll to specific positions and query current state.
 */
export type ScrollViewRef = {
	/** Scroll to a specific offset or calculate new offset based on current position */
	scrollTo: (
		currentOffset: number | ((currentOffset: number) => number),
		fireCallback?: boolean,
	) => void;
	/** Scroll to the beginning of the content */
	scrollToStart: (fireCallback?: boolean) => void;
	/** Scroll to the end of the content */
	scrollToEnd: (fireCallback?: boolean) => void;
	/** Get the current scroll offset */
	getScrollOffset: () => number;
	/** Get the total content dimensions */
	getContentSize: () => {width: number; height: number};
};

type ScrollDirection = 'vertical' | 'horizontal';

/**
 * Props for the ScrollView component.
 */
type Props = {
	/** Width of the visible viewport */
	readonly width: number;
	/** Height of the visible viewport */
	readonly height: number;
	/** Direction of scrolling - defaults to 'vertical' */
	readonly scrollDirection?: ScrollDirection;
	/** Initial scroll position when component mounts - defaults to 'end' */
	readonly initialScrollPosition?: 'start' | 'end';
	/** Content to be rendered inside the scrollable area */
	readonly children: ReactNode;
	/** Callback that is triggered when the scroll view hits the top */
	readonly onScrollToStart?: () => void;
	/** Callback that is triggered when the scroll view hits the bottom */
	readonly onScrollToEnd?: () => void;
	/** Lines to scroll per mouse wheel tick. Set to enable mouse wheel scrolling. */
	readonly mouseScrollLines?: number;
	/** Callback fired when a child element is clicked, with the child index. */
	readonly onChildClick?: (index: number) => void;
};

/**
 * A scrollable container component that supports both vertical and horizontal scrolling.
 * Uses negative margins to position content within a clipped viewport.
 */
const ScrollView = forwardRef<ScrollViewRef | undefined, Props>(
	(
		{
			width,
			height,
			children,
			scrollDirection = 'vertical',
			initialScrollPosition = 'end',
			onScrollToStart,
			onScrollToEnd,
			mouseScrollLines,
			onChildClick,
		}: Props,
		ref: React.Ref<ScrollViewRef | undefined>,
	) => {
		// eslint-disable-next-line @typescript-eslint/no-restricted-types
		const containerRef = useRef<DOMElement | null>(null);
		// eslint-disable-next-line @typescript-eslint/no-restricted-types
		const viewportRef = useRef<DOMElement | null>(null);
		const [offset, setOffset] = useState<number>(0);
		const contentSize = useContentSize(containerRef);

		// Track whether boundary callbacks should fire on the next offset change.
		// This avoids calling parent setState inside a state updater
		const fireBoundaryCallbacksRef = useRef(false);

		// Fire boundary callbacks after offset settles, outside of render
		useEffect(() => {
			if (!fireBoundaryCallbacksRef.current) return;
			fireBoundaryCallbacksRef.current = false;

			const maxOffset =
				scrollDirection === 'vertical'
					? contentSize.height - height
					: contentSize.width - width;

			if (onScrollToStart && offset === 0) {
				onScrollToStart();
			}

			if (onScrollToEnd && maxOffset > 0 && offset >= maxOffset) {
				onScrollToEnd();
			}
		}, [
			offset,
			contentSize.height,
			contentSize.width,
			height,
			width,
			scrollDirection,
			onScrollToStart,
			onScrollToEnd,
		]);

		/**
		 * Scroll to a specific offset, clamping to valid bounds.
		 * Accepts either a number or a function that calculates offset based on current position.
		 */
		const scrollTo = useCallback(
			(
				currentOffset: number | ((currentOffset: number) => number),
				fireCallback = true,
			) => {
				fireBoundaryCallbacksRef.current = fireCallback;
				setOffset(currentValue => {
					const requestedOffset =
						typeof currentOffset === 'number'
							? currentOffset
							: currentOffset(currentValue);

					// Clamp offset to valid scrollable range
					const maxOffset =
						scrollDirection === 'vertical'
							? contentSize.height - height
							: contentSize.width - width;

					return Math.max(0, Math.min(maxOffset, requestedOffset));
				});
			},
			[contentSize.height, contentSize.width, height, width, scrollDirection],
		);

		const scrollToStart = useCallback((fireCallback = true) => {
			fireBoundaryCallbacksRef.current = fireCallback;
			setOffset(0);
		}, []);

		const scrollToEnd = useCallback(
			(fireCallback = true) => {
				fireBoundaryCallbacksRef.current = fireCallback;
				setOffset(
					scrollDirection === 'vertical'
						? Math.max(0, contentSize.height - height)
						: Math.max(0, contentSize.width - width),
				);
			},
			[contentSize.height, contentSize.width, height, width, scrollDirection],
		);

		const getScrollOffset = useCallback(() => {
			return offset;
		}, [offset]);

		const getContentSize = useCallback(() => {
			return contentSize;
		}, [contentSize]);

		useImperativeHandle(ref, () => ({
			scrollTo,
			scrollToStart,
			scrollToEnd,
			getScrollOffset,
			getContentSize,
		}));

		// Handle mouse scroll and click events internally
		useMouse(
			useCallback(
				event => {
					// Bounds check: ignore events outside the viewport
					const viewport = viewportRef.current;
					if (viewport) {
						const vp = measureAbsoluteLayout(viewport);
						const cx = event.col - 1;
						const cy = event.row - 1;
						if (
							cx < vp.x ||
							cx >= vp.x + vp.width ||
							cy < vp.y ||
							cy >= vp.y + vp.height
						) {
							return false;
						}
					}

					if (mouseScrollLines !== undefined) {
						if (event.name === 'scroll-up') {
							scrollTo(curr => curr - mouseScrollLines);
							return true;
						}

						if (event.name === 'scroll-down') {
							scrollTo(curr => curr + mouseScrollLines);
							return true;
						}
					}

					if (onChildClick && event.name === 'left-press') {
						const container = containerRef.current;
						if (!container) return false;

						const clickX = event.col - 1;
						const clickY = event.row - 1;
						const containerLayout = measureAbsoluteLayout(container);
						const relativeX = clickX - containerLayout.x;
						const relativeY = clickY - containerLayout.y;
						const childIndex = findChildAtPosition(
							container,
							relativeX,
							relativeY,
						);

						if (childIndex >= 0) {
							onChildClick(childIndex);
							return true;
						}
					}

					return false;
				},
				[mouseScrollLines, onChildClick, scrollTo],
			),
			{isActive: mouseScrollLines !== undefined || onChildClick !== undefined},
		);

		// Set initial scroll position only once when component mounts
		useEffect(() => {
			if (!containerRef?.current) {
				return;
			}

			if (initialScrollPosition === 'end') {
				setOffset(
					scrollDirection === 'vertical'
						? Math.max(0, contentSize.height - height)
						: Math.max(0, contentSize.width - width),
				);
			} else {
				setOffset(0);
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [containerRef.current]);

		return (
			<Box
				ref={viewportRef}
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
					// Apply negative margin to shift content based on scroll offset
					// Note: margin is used instead of padding as it properly moves content out of view
					marginTop={scrollDirection === 'vertical' ? -offset : undefined}
					// Note: the positive offset is not a typo. From testing somehow it is the correct way for setting horizontal offset
					marginLeft={scrollDirection === 'horizontal' ? offset : undefined}
				>
					{children}
				</Box>
			</Box>
		);
	},
);

ScrollView.displayName = 'ScrollView';

export default ScrollView;
