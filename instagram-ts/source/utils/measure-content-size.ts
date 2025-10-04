import {type DOMElement} from 'ink';

type ContentSize = {
	/**
	 * Total width of content, including overflow
	 */
	width: number;

	/**
	 * Total height of content, including overflow
	 */
	height: number;
};

/**
 * Measure the total content size of a node's children, including any
 * overflowing content. This is useful for implementing scrollable views.
 *
 * Unlike `measureElement`, which returns the constrained size of the container,
 * this function returns the actual bounding box of all children.
 */
const measureContentSize = (node: DOMElement): ContentSize => {
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
		const left = offsetX + childNode.yogaNode.getComputedLeft();
		const top = offsetY + childNode.yogaNode.getComputedTop();
		const width = childNode.yogaNode.getComputedWidth();
		const height = childNode.yogaNode.getComputedHeight();

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
			if ((grandChild as DOMElement).yogaNode) {
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

export default measureContentSize;
