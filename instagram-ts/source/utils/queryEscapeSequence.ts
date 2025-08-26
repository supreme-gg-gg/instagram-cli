/**
 * Send a message to stdout and wait for a response from stdin.
 * Meant for getting replies from control sequences
 * This should NOT be used for getting user input.
 */
function queryEscapeSequence(
	message: string,
	options: {stdout: NodeJS.WriteStream; stdin: NodeJS.ReadStream} = process,
) {
	return new Promise<string | undefined>(resolve => {
		const {stdin, stdout} = options;

		const responseTimeout = 100;
		let responseTimeoutId: NodeJS.Timeout | undefined = undefined;
		const timeoutBetweenReplies = 50;
		let timeoutBetweenRepliesId: NodeJS.Timeout | undefined = undefined;
		let runningReply = '';

		stdin.setEncoding('utf8');
		stdin.setRawMode(true);

		const restoreState = () => {
			if (responseTimeoutId !== undefined) {
				clearTimeout(responseTimeoutId);
			}
			if (timeoutBetweenRepliesId !== undefined) {
				clearTimeout(timeoutBetweenRepliesId);
			}

			stdin.setRawMode(false);
		};

		stdin.on('data', data => {
			if (responseTimeoutId !== undefined) {
				clearTimeout(responseTimeoutId);
			}
			if (timeoutBetweenRepliesId !== undefined) {
				clearTimeout(timeoutBetweenRepliesId);
			}
			runningReply += data;
			timeoutBetweenRepliesId = setTimeout(() => {
				restoreState();
				resolve(runningReply.length > 0 ? runningReply : undefined);
			}, timeoutBetweenReplies);
		});

		stdin.on('close', () => {
			restoreState();
			resolve(runningReply.length > 0 ? runningReply : undefined);
		});
		// stdin.on("")

		responseTimeoutId = setTimeout(() => {
			restoreState();
			resolve(undefined);
		}, responseTimeout);

		stdout.write(message);
	});
}

export default queryEscapeSequence;
