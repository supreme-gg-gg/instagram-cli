import {useState, useEffect} from 'react';
import {type DOMElement} from 'ink';

/**
 * Represents the total dimensions of content within a container,
 * including any content that overflows the visible area.
 */
type ContentSize = {
	/** Total width of content, including overflow */
	width: number;
	/** Total height of content, including overflow */
	height: number;
};

/**
 * Measure the total content size of a node's children, including any
 * overflowing content. This is useful for implementing scrollable views.
 *
 * Unlike `measureElement`, which returns the constrained size of the container,
 * this function returns the actual bounding box of all children.
 */
export const measureContentSize = (node: DOMElement): ContentSize => {
	if (!node.yogaNode) {
		return {width: 0, height: 0};
	}

	// If there are no children, the content size is 0
	if (node.childNodes.length === 0) {
		return {width: 0, height: 0};
	}

	let maxX = 0;
	let maxY = 0;

	// Recursively calculate the bounding box of all children
	const calculateBounds = (
		childNode: DOMElement,
		offsetX: number,
		offsetY: number,
	) => {
		if (!childNode.yogaNode) {
			return;
		}

		// Get the child's position relative to its parent
		const {
			left: childLeft,
			top: childTop,
			width,
			height,
		} = childNode.yogaNode.getComputedLayout();
		const left = offsetX + childLeft;
		const top = offsetY + childTop;

		// Update max bounds
		const right = left + width;
		const bottom = top + height;

		if (right > maxX) {
			maxX = right;
		}

		if (bottom > maxY) {
			maxY = bottom;
		}

		// Recursively process children
		for (const grandChild of childNode.childNodes) {
			if (grandChild.yogaNode) {
				calculateBounds(grandChild as DOMElement, left, top);
			}
		}
	};

	// Calculate bounds for all direct children
	for (const childNode of node.childNodes) {
		if ((childNode as DOMElement).yogaNode) {
			calculateBounds(childNode as DOMElement, 0, 0);
		}
	}

	return {
		width: Math.ceil(maxX),
		height: Math.ceil(maxY),
	};
};

/**
 * Hook that measures the content size of a DOM element.
 * It proactively polls for size changes to detect deep updates in the
 * component tree that don't trigger a re-render on the container.
 *
 * @param containerRef - Reference to the container DOM element
 * @returns The current content size {width, height}
 */
const useContentSize = (
	// eslint-disable-next-line @typescript-eslint/no-restricted-types
	containerRef: React.RefObject<DOMElement | null>,
): ContentSize => {
	const [contentSize, setContentSize] = useState<ContentSize>({
		width: 0,
		height: 0,
	});

	/**
	 * Set up polling to detect content size changes.
	 * This is necessary because changes deep in the children tree don't cause
	 * the parent component to re-render, so measurement needs to be proactive.
	 */
	useEffect(() => {
		const intervalId = setInterval(() => {
			// Do nothing if the container isn't mounted yet
			if (!containerRef.current) {
				return;
			}

			const newSize = measureContentSize(containerRef.current);

			// Use functional update to ensure we compare against the latest state
			setContentSize(currentSize => {
				if (
					newSize.width !== currentSize.width ||
					newSize.height !== currentSize.height
				) {
					// Size has changed, trigger a re-render
					return newSize;
				}

				// Size is the same, React will bail out of the update
				return currentSize;
			});
		}, 1000 / 60); // Poll at ~60fps to match Ink's typical frame rate

		// Cleanup interval on unmount or ref change
		return () => {
			clearInterval(intervalId);
		};
	}, [containerRef]);

	return contentSize;
};

export type AbsoluteLayout = {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
};

/**
 * Calculates the absolute position (in SGR terminal coordinates, 0-based) and size of an Ink DOM element.
 * It walks up the tree summing `getComputedLeft()` and `getComputedTop()` of Yoga nodes.
 */
export const measureAbsoluteLayout = (
	node: DOMElement | undefined,
): AbsoluteLayout => {
	if (!node) {
		return {x: 0, y: 0, width: 0, height: 0};
	}

	let x = 0;
	let y = 0;
	const width = node.yogaNode?.getComputedWidth() ?? 0;
	const height = node.yogaNode?.getComputedHeight() ?? 0;

	let currentNode: DOMElement | undefined = node;
	while (currentNode?.yogaNode) {
		x += currentNode.yogaNode.getComputedLeft();
		y += currentNode.yogaNode.getComputedTop();
		currentNode = currentNode.parentNode;
	}

	return {x, y, width, height};
};

/**
 * Given a container node and a position relative to that container,
 * returns the index of the child whose layout rect contains the point,
 * or -1 if no child matches.
 *
 * Automatically descends through single-child wrapper nodes (adjusting
 * coordinates for each level's offset and padding) until it reaches a
 * node with multiple children, then checks which child contains the point.
 * This means callers don't need to know about intermediate wrapper `<Box>` nodes.
 */
export const findChildAtPosition = (
	node: DOMElement | undefined,
	x: number,
	y: number,
): number => {
	if (!node) return -1;

	// Descend through single-child wrappers, adjusting coordinates
	let current: DOMElement = node;
	let adjustedX = x;
	let adjustedY = y;

	while (current.childNodes.length === 1) {
		const only = current.childNodes[0] as DOMElement;
		if (!only.yogaNode) break;
		const layout = only.yogaNode.getComputedLayout();
		adjustedX -= layout.left;
		adjustedY -= layout.top;
		current = only;
	}

	// Now check which direct child of `current` contains the point
	const children = current.childNodes;
	for (const [i, child_] of children.entries()) {
		const child = child_ as DOMElement;
		if (!child.yogaNode) continue;

		const {left, top, width, height} = child.yogaNode.getComputedLayout();

		if (
			adjustedX >= left &&
			adjustedX < left + width &&
			adjustedY >= top &&
			adjustedY < top + height
		) {
			return i;
		}
	}

	return -1;
};

export default useContentSize;
