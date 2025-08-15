import React, {useState, useEffect} from 'react';
import {Box} from 'ink';

type Props = {
	children: React.ReactNode;
};

const FullScreen = (props: Props) => {
	const [size, setSize] = useState({
		columns: process.stdout.columns,
		rows: process.stdout.rows,
	});

	useEffect(() => {
		function onResize() {
			setSize({
				columns: process.stdout.columns,
				rows: process.stdout.rows,
			});
		}

		process.stdout.on('resize', onResize);
		process.stdout.write('\x1b[?1049h');
		return () => {
			process.stdout.off('resize', onResize);
			process.stdout.write('\x1b[?1049l');
		};
	}, []);

	return (
		<Box width={size.columns} height={size.rows}>
			{props.children}
		</Box>
	);
};

export default FullScreen;
