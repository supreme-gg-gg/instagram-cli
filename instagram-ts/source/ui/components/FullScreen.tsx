import React, {useState, useEffect} from 'react';
import {Box, useStdout} from 'ink';

type Props = {
	children: React.ReactNode;
};

const FullScreen = (props: Props) => {
	const {stdout} = useStdout();
	const [size, setSize] = useState({
		columns: stdout.columns,
		rows: stdout.rows,
	});

	useEffect(() => {
		const onResize = () => {
			setSize({
				columns: stdout.columns,
				rows: stdout.rows,
			});
		};

		stdout.on('resize', onResize);
		stdout.write('\x1b[?1049h');
		return () => {
			stdout.off('resize', onResize);
			stdout.write('\x1b[?1049l');
		};
	}, [stdout]);

	return (
		<Box width={size.columns} height={size.rows}>
			{props.children}
		</Box>
	);
};

export default FullScreen;
