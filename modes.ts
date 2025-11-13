/**
 * Application workload modes
 *
 * Each mode defines ranges for:
 * - fileIoRange: [min, max] in MB (0-100)
 * - processRange: [min, max] number of child processes (0-3)
 * - cpuWorkMultiplier: multiplier for CPU-intensive work (0.5-2.0)
 */

import { ChildProcess, spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
export interface Mode {
	description: string;
	fileIoRange: [number, number];    // in MB
	processRange: [number, number];   // number of child processes
	threadRange: [number, number]; // number of worker threads
	cpuWorkMultiplier: number;        // multiplier for CPU work within worker threads
}

export const MODES: Record<string, Mode> = {
	// Intensity-based modes
	'low': {
		description: 'Low intensity workload',
		fileIoRange: [0, 30],
		processRange: [0, 1],
		threadRange: [0, 1],
		cpuWorkMultiplier: 0.5
	},
	'medium': {
		description: 'Medium intensity workload',
		fileIoRange: [30, 70],
		processRange: [1, 2],
		threadRange: [1, 2],
		cpuWorkMultiplier: 1.0
	},
	'high': {
		description: 'High intensity workload',
		fileIoRange: [70, 100],
		processRange: [2, 3],
		threadRange: [2, 3],
		cpuWorkMultiplier: 1.5
	},

	// Resource-specific modes
	'high-io': {
		description: 'Heavy file I/O, variable processes',
		fileIoRange: [80, 100],
		processRange: [0, 3],
		threadRange: [0, 3],
		cpuWorkMultiplier: 1.0
	},
	'low-io': {
		description: 'Minimal file I/O, variable processes',
		fileIoRange: [0, 20],
		processRange: [0, 3],
		threadRange: [0, 3],
		cpuWorkMultiplier: 1.0
	},
	'cpu-heavy': {
		description: 'Many processes and high CPU work',
		fileIoRange: [0, 100],
		processRange: [2, 3],
		threadRange: [2, 3],
		cpuWorkMultiplier: 2.0
	},
	'process-light': {
		description: 'Few child processes',
		fileIoRange: [0, 100],
		processRange: [0, 1],
		threadRange: [0, 3],
		cpuWorkMultiplier: 1.0
	},

	// Extreme modes for testing
	'minimal': {
		description: 'Minimal workload (no I/O, no processes)',
		fileIoRange: [0, 0],
		processRange: [0, 0],
		threadRange: [0, 0],
		cpuWorkMultiplier: 0.5
	},
	'maximum': {
		description: 'Maximum workload (max I/O, max processes)',
		fileIoRange: [100, 100],
		processRange: [3, 3],
		threadRange: [4, 4],
		cpuWorkMultiplier: 2.0
	},

	// Default mode
	'default': {
		description: 'Random workload (original behavior)',
		fileIoRange: [0, 100],
		processRange: [0, 3],
		threadRange: [0, 4],
		cpuWorkMultiplier: 1.0
	}
};

/**
 * Get a mode configuration by name
 */
export function getMode(modeName: string = 'default'): Mode {
	const mode = MODES[modeName];
	if (!mode) {
		throw new Error(`Unknown mode: ${modeName}. Available modes: ${Object.keys(MODES).join(', ')}`);
	}
	return mode;
}

/**
 * Get a random value within a range
 */
export function randomInRange(min: number, max: number) {
	if (min === max) {
		return min; // No randomness if range is a single value
	}
	return min + Math.random() * (max - min);
}

async function startServer(port: number, mode: string): Promise<ChildProcess> {
	return new Promise((resolve, reject) => {
		// Timeout server startup after 5s
		const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 5000);
		
		const serverProcess = spawn('node', ['server.ts'], {
			env: {
				...process.env,
				PORT: port.toString(),
				APP_MODE: mode
			}
		});

		serverProcess.stdout.on('data', (data) => {
			if (data.toString().includes('Server ready')) {
				clearTimeout(timeout);
				resolve(serverProcess);
			}
		});

		serverProcess.stderr.on('data', (data) => {
			console.error(`Server error: ${data}`);
		});

		serverProcess.on('error', (err) => {
			clearTimeout(timeout);
			reject(err);
		});
	});
}

async function stopServer(serverProcess: ChildProcess) {
	return new Promise((resolve) => {
		serverProcess.kill('SIGTERM');
		serverProcess.on('exit', resolve);
	});
}

async function testModes(modes: string[]): Promise<void> {
	const table: {
		[modeName: string]: {
			'Avg File I/O (MB)': number;
			'Avg Process Count': number;
			'Avg Thread Count': number;
			'CPU Multiplier': number;
			'Avg Request Duration (ms)': number;
		};
	} = {};

	const port = parseInt(process.env.PORT || '3000', 10);

	for (const modeName of modes) {
		const server = await startServer(port, modeName);

		const results = await Promise.all(
			Array.from({ length: 10 }).map(async () => {
				const start = performance.now();
				const response = await fetch(`http://localhost:${port}`);
				const result = await response.json();
				const end = performance.now();
				if (!response.ok) {
					throw new Error(result.error);
				}
				result.duration = end - start;
				return result;
			})
		);

		const avgFileIo = results.reduce((sum, r) => sum + r.metrics.fileIoAmount, 0) / results.length / 1024 / 1024;
		const avgProcessCount = results.reduce((sum, r) => sum + r.metrics.processCount, 0) / results.length;
		const avgThreadCount = results.reduce((sum, r) => sum + r.metrics.threadCount, 0) / results.length;
		const cpuMultiplier = results[0].mode.cpuWorkMultiplier;
		const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

		table[modeName] = {
			'Avg File I/O (MB)': parseFloat(avgFileIo.toFixed(2)),
			'Avg Process Count': parseFloat(avgProcessCount.toFixed(2)),
			'Avg Thread Count': parseFloat(avgThreadCount.toFixed(2)),
			'CPU Multiplier': cpuMultiplier,
			'Avg Request Duration (ms)': parseFloat(avgDuration.toFixed(2))
		};

		await stopServer(server);
		// Slight delay between tests
		await sleep(100);
	}

	console.table(table);
}

function logModesInfo(modes: string[]): void {
	const table: {
		[modeName: string]: {
			Description: string;
			'File I/O (MB)': [number, number];
			'Processes': [number, number];
			'Threads': [number, number];
			'CPU Multiplier': number;
		};
	} = {};

	for (const modeName of modes) {
		const mode = getMode(modeName);
		table[modeName] = {
			Description: mode.description,
			'File I/O (MB)': mode.fileIoRange,
			'Processes': mode.processRange,
			'Threads': mode.threadRange,
			'CPU Multiplier': mode.cpuWorkMultiplier
		};
	}

	console.table(table);
}

function getModesFromArgv(): string[] {
	let modes = process.argv.slice(3);
	if (modes.length === 0) {
		modes = Object.keys(MODES);
	}
	return modes;
}

if (import.meta.main) {
	const command = process.argv[2];

	switch (command) {
		case 'test': {
			testModes(getModesFromArgv());
			break;
		}
		case 'info': {
			logModesInfo(getModesFromArgv());
			break;
		}
		default: {
			console.log(`Usage: node modes.ts [command] [modes...]`);
			console.log(`Commands:`);
			console.log(`  info [modes...]   - Display information about specified modes (all if none specified)`);
			console.log(`  test [modes...]   - Run test simulations for specified modes`);
			console.log(`\nAvailable Modes: ${Object.keys(MODES).join(', ')}`);
			break;
		}
	}
}