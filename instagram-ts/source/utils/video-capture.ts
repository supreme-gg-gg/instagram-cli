import {spawn} from 'node:child_process';
import {createContextualLogger} from './logger.js';

const logger = createContextualLogger('VideoCapture');

export type VideoCaptureOptions = {
	device?: string; // Camera device path or index
	width?: number;
	height?: number;
	fps?: number;
	format?: 'mp4' | 'h264';
};

/**
 * Captures video from a computer camera using ffmpeg.
 * This allows streaming from a computer camera instead of using RTMP.
 *
 * @param outputPath - Path to save the video stream
 * @param options - Video capture options
 * @returns A process that can be used to control the video capture
 */
export function captureVideoFromCamera(
	outputPath: string,
	options: VideoCaptureOptions = {},
): {
	process: ReturnType<typeof spawn>;
	stop: () => void;
} {
	const {
		device = 'default',
		width = 1280,
		height = 720,
		fps = 30,
		format = 'h264',
	} = options;

	// Determine input based on platform
	const isMac = process.platform === 'darwin';
	const isWindows = process.platform === 'win32';
	const isLinux = process.platform === 'linux';

	let inputDevice = '';
	if (isMac) {
		// macOS uses avfoundation
		inputDevice = device === 'default' ? '0' : device;
	} else if (isWindows) {
		// Windows uses dshow
		inputDevice = device === 'default' ? 'video=Integrated Camera' : device;
	} else if (isLinux) {
		// Linux uses v4l2
		inputDevice = device === 'default' ? '/dev/video0' : device;
	}

	const ffmpegArgs: string[] = [];

	if (isMac) {
		ffmpegArgs.push(
			'-f',
			'avfoundation',
			'-framerate',
			String(fps),
			'-video_size',
			`${width}x${height}`,
			'-i',
			`${inputDevice}:none`,
		);
	} else if (isWindows) {
		ffmpegArgs.push(
			'-f',
			'dshow',
			'-framerate',
			String(fps),
			'-video_size',
			`${width}x${height}`,
			'-i',
			inputDevice,
		);
	} else if (isLinux) {
		ffmpegArgs.push(
			'-f',
			'v4l2',
			'-framerate',
			String(fps),
			'-video_size',
			`${width}x${height}`,
			'-i',
			inputDevice,
		);
	}

	// Output format
	if (format === 'h264') {
		ffmpegArgs.push(
			'-c:v',
			'libx264',
			'-preset',
			'ultrafast',
			'-tune',
			'zerolatency',
			'-f',
			'h264',
		);
	} else {
		ffmpegArgs.push('-c:v', 'libx264', '-f', 'mp4');
	}

	ffmpegArgs.push(outputPath);

	logger.info(`Starting video capture with ffmpeg: ${ffmpegArgs.join(' ')}`);

	const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

	ffmpegProcess.stderr?.on('data', (data: Buffer) => {
		const output = data.toString();
		// ffmpeg outputs to stderr by default
		logger.debug(`ffmpeg: ${output}`);
	});

	ffmpegProcess.on('error', error => {
		logger.error('Failed to start ffmpeg', error);
		throw new Error(
			'ffmpeg not found. Please install ffmpeg to use video capture.',
		);
	});

	const stop = () => {
		logger.info('Stopping video capture');
		ffmpegProcess.kill('SIGTERM');
	};

	return {process: ffmpegProcess, stop};
}

/**
 * Streams video directly to an RTMP URL (for Instagram live streaming).
 *
 * @param rtmpUrl - The RTMP stream URL
 * @param streamKey - The stream key
 * @param options - Video capture options
 * @returns A process that can be used to control the stream
 */
export function streamToRtmp(
	rtmpUrl: string,
	streamKey: string,
	options: VideoCaptureOptions = {},
): {
	process: ReturnType<typeof spawn>;
	stop: () => void;
} {
	const {device = 'default', width = 1280, height = 720, fps = 30} = options;

	const fullRtmpUrl = `${rtmpUrl}/${streamKey}`;

	// Determine input based on platform
	const isMac = process.platform === 'darwin';
	const isWindows = process.platform === 'win32';
	const isLinux = process.platform === 'linux';

	let inputDevice = '';
	if (isMac) {
		inputDevice = device === 'default' ? '0' : device;
	} else if (isWindows) {
		inputDevice = device === 'default' ? 'video=Integrated Camera' : device;
	} else if (isLinux) {
		inputDevice = device === 'default' ? '/dev/video0' : device;
	}

	const ffmpegArgs: string[] = [];

	if (isMac) {
		ffmpegArgs.push(
			'-f',
			'avfoundation',
			'-framerate',
			String(fps),
			'-video_size',
			`${width}x${height}`,
			'-i',
			`${inputDevice}:none`,
		);
	} else if (isWindows) {
		ffmpegArgs.push(
			'-f',
			'dshow',
			'-framerate',
			String(fps),
			'-video_size',
			`${width}x${height}`,
			'-i',
			inputDevice,
		);
	} else if (isLinux) {
		ffmpegArgs.push(
			'-f',
			'v4l2',
			'-framerate',
			String(fps),
			'-video_size',
			`${width}x${height}`,
			'-i',
			inputDevice,
		);
	}

	// RTMP output settings
	ffmpegArgs.push(
		'-c:v',
		'libx264',
		'-preset',
		'ultrafast',
		'-tune',
		'zerolatency',
		'-b:v',
		'2500k',
		'-maxrate',
		'2500k',
		'-bufsize',
		'5000k',
		'-g',
		String(fps * 2),
		'-c:a',
		'aac',
		'-b:a',
		'128k',
		'-ar',
		'44100',
		'-f',
		'flv',
		fullRtmpUrl,
	);

	logger.info(`Streaming to RTMP: ${fullRtmpUrl}`);

	const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

	ffmpegProcess.stderr?.on('data', (data: Buffer) => {
		const output = data.toString();
		logger.debug(`ffmpeg: ${output}`);
	});

	ffmpegProcess.on('error', error => {
		logger.error('Failed to start ffmpeg', error);
		throw new Error(
			'ffmpeg not found. Please install ffmpeg to use video streaming.',
		);
	});

	const stop = () => {
		logger.info('Stopping RTMP stream');
		ffmpegProcess.kill('SIGTERM');
	};

	return {process: ffmpegProcess, stop};
}
