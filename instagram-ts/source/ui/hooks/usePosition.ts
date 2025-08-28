import {useState, useEffect, useCallback, type RefObject} from 'react';
import {type DOMElement} from 'ink';

export type Position = {
	/**
	 * Column position (x-coordinate) in terminal cells.
	 */
	col: number;
	/**
	 * Row position (y-coordinate) in terminal cells.
	 */
	row: number;
	/**
	 * Element width in terminal cells.
	 */
	width: number;
	/**
	 * Element height in terminal cells.
	 */
	height: number;
	/**
	 * Application width in terminal cells.
	 */
	appWidth: number;
	/**
	 * Application height in terminal cells.
	 */
	appHeight: number;
};

/**
 * Get the current position and dimensions of a mounted component in terminal cells.
 *
 * @param ref - React ref pointing to a Box component
 * @returns Position object with col, row, width, and height
 */
const usePosition = (
	ref: RefObject<DOMElement | null>,
): Position | undefined => {
	const [position, setPosition] = useState<Position | undefined>(undefined);

	const updatePosition = useCallback(() => {
		if (!ref.current?.yogaNode) {
			return;
		}

		const {current: node} = ref;
		const {yogaNode} = node;

		// Calculate absolute position by traversing up the tree
		let absoluteCol = 0;
		let absoluteRow = 0;
		let appWidth = 0;
		let appHeight = 0;
		let currentNode: DOMElement | undefined = node;

		while (currentNode) {
			if (currentNode.yogaNode) {
				absoluteCol += currentNode.yogaNode.getComputedLeft();
				absoluteRow += currentNode.yogaNode.getComputedTop();
				appWidth = currentNode.yogaNode.getComputedWidth();
				appHeight = currentNode.yogaNode.getComputedHeight();
			}

			currentNode = currentNode.parentNode;
		}

		const newPosition: Position = {
			col: absoluteCol,
			row: absoluteRow,
			width: yogaNode!.getComputedWidth(),
			height: yogaNode!.getComputedHeight(),
			appWidth,
			appHeight,
		};

		setPosition(previousPosition => {
			// Only update if position actually changed to avoid unnecessary re-renders
			if (
				!previousPosition ||
				previousPosition.col !== newPosition.col ||
				previousPosition.row !== newPosition.row ||
				previousPosition.width !== newPosition.width ||
				previousPosition.height !== newPosition.height ||
				previousPosition.appWidth !== newPosition.appWidth ||
				previousPosition.appHeight !== newPosition.appHeight
			) {
				return newPosition;
			}

			return previousPosition;
		});
	}, [ref]);

	// Calculate position after every render
	// This ensures we capture all layout changes from the root node down
	// Otherwise we will need to track changes in all of the node's parent nodes which is also expensive
	useEffect(() => {
		updatePosition();
	});

	return position;
};

export default usePosition;
