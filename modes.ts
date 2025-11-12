/**
 * Application workload modes
 *
 * Each mode defines ranges for:
 * - fileIoRange: [min, max] in MB (0-100)
 * - processRange: [min, max] number of child processes (0-3)
 * - cpuWorkMultiplier: multiplier for CPU-intensive work (0.5-2.0)
 */

export const MODES = {
	// Intensity-based modes
	'low': {
		description: 'Low intensity workload',
		fileIoRange: [0, 30],
		processRange: [0, 1],
		cpuWorkMultiplier: 0.5
	},
	'medium': {
		description: 'Medium intensity workload',
		fileIoRange: [30, 70],
		processRange: [1, 2],
		cpuWorkMultiplier: 1.0
	},
	'high': {
		description: 'High intensity workload',
		fileIoRange: [70, 100],
		processRange: [2, 3],
		cpuWorkMultiplier: 1.5
	},

	// Resource-specific modes
	'high-io': {
		description: 'Heavy file I/O, variable processes',
		fileIoRange: [80, 100],
		processRange: [0, 3],
		cpuWorkMultiplier: 1.0
	},
	'low-io': {
		description: 'Minimal file I/O, variable processes',
		fileIoRange: [0, 20],
		processRange: [0, 3],
		cpuWorkMultiplier: 1.0
	},
	'cpu-heavy': {
		description: 'Many processes and high CPU work',
		fileIoRange: [0, 100],
		processRange: [2, 3],
		cpuWorkMultiplier: 2.0
	},
	'process-light': {
		description: 'Few child processes',
		fileIoRange: [0, 100],
		processRange: [0, 1],
		cpuWorkMultiplier: 1.0
	},

	// Extreme modes for testing
	'minimal': {
		description: 'Minimal workload (no I/O, no processes)',
		fileIoRange: [0, 0],
		processRange: [0, 0],
		cpuWorkMultiplier: 0.5
	},
	'maximum': {
		description: 'Maximum workload (max I/O, max processes)',
		fileIoRange: [100, 100],
		processRange: [3, 3],
		cpuWorkMultiplier: 2.0
	},

	// Default mode
	'default': {
		description: 'Random workload (original behavior)',
		fileIoRange: [0, 100],
		processRange: [0, 3],
		cpuWorkMultiplier: 1.0
	}
} as const;

export type ModeName = keyof typeof MODES;

export function assertModeName(modeName: string): asserts modeName is ModeName {
	if (!(modeName in MODES)) {
		throw new Error(`Invalid mode name: ${modeName}. Available modes: ${Object.keys(MODES).join(', ')}`);
	}
}

export function assertModeNames(modeNames: string[]): asserts modeNames is ModeName[] {
	modeNames.forEach(assertModeName);
}

/**
 * Get a mode configuration by name
 */
export function getMode(modeName: ModeName = 'default') {
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

/**
 * List all available modes
 */
export function listModes() {
	console.log('\nAvailable Modes:\n');
	Object.entries(MODES).forEach(([name, config]) => {
		console.log(`  ${name.padEnd(15)} - ${config.description}`);
		console.log(`                    File I/O: ${config.fileIoRange[0]}-${config.fileIoRange[1]}MB`);
		console.log(`                    Processes: ${config.processRange[0]}-${config.processRange[1]}`);
		console.log(`                    CPU multiplier: ${config.cpuWorkMultiplier}x`);
		console.log();
	});
}
