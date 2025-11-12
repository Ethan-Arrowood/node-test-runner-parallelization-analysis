import { getMode, randomInRange, listModes, type ModeName, assertModeName, assertModeNames } from './modes.ts';

interface WorkloadRequest {
	fileIoMB: number;
	fileIoAmount: number;
	processCount: number;
	cpuMultiplier: number;
}

// Simulate what the app will do with a given mode
function analyzeWorkload(modeName: ModeName, numRequests = 1): WorkloadRequest[] {
	const mode = getMode(modeName);
	const requests: WorkloadRequest[] = [];

	for (let i = 0; i < numRequests; i++) {
		// Simulate file I/O amount (using mode's range)
		const fileIoMB = randomInRange(mode.fileIoRange[0], mode.fileIoRange[1]);
		const fileIoAmount = Math.floor(fileIoMB) * 1024 * 1024;

		// Simulate process count (using mode's range)
		const processCount = Math.floor(randomInRange(mode.processRange[0], mode.processRange[1] + 0.999));

		// CPU work multiplier
		const cpuMultiplier = mode.cpuWorkMultiplier;

		requests.push({
			fileIoMB,
			fileIoAmount,
			processCount,
			cpuMultiplier
		});
	}

	return requests;
}

interface ModeStats {
	avgFileIo: string;
	minFileIo: string;
	maxFileIo: string;
	avgProcesses: string;
	minProcesses: number;
	maxProcesses: number;
	avgCpuMultiplier: string;
	intensityScore: number;
	intensity: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Calculate aggregate statistics for a mode
function calculateStats(requests: WorkloadRequest[]): ModeStats {
	const avgFileIo = requests.reduce((sum, r) => sum + r.fileIoMB, 0) / requests.length;
	const minFileIo = Math.min(...requests.map(r => r.fileIoMB));
	const maxFileIo = Math.max(...requests.map(r => r.fileIoMB));

	const avgProcesses = requests.reduce((sum, r) => sum + r.processCount, 0) / requests.length;
	const minProcesses = Math.min(...requests.map(r => r.processCount));
	const maxProcesses = Math.max(...requests.map(r => r.processCount));

	const avgCpuMultiplier = requests.reduce((sum, r) => sum + r.cpuMultiplier, 0) / requests.length;

	// Calculate intensity score (0-100)
	// File I/O: 0-100MB maps to 0-50 points
	// Process count: 0-3 maps to 0-25 points
	// CPU multiplier: 0.5-2.0 maps to 0-25 points
	const fileIoScore = (avgFileIo / 100) * 50;
	const processCountScore = (avgProcesses / 3) * 25;
	const cpuScore = ((avgCpuMultiplier - 0.5) / 1.5) * 25;
	const intensityScore = Math.round(fileIoScore + processCountScore + cpuScore);

	return {
		avgFileIo: avgFileIo.toFixed(1),
		minFileIo: minFileIo.toFixed(1),
		maxFileIo: maxFileIo.toFixed(1),
		avgProcesses: avgProcesses.toFixed(1),
		minProcesses,
		maxProcesses,
		avgCpuMultiplier: avgCpuMultiplier.toFixed(1),
		intensityScore,
		intensity: intensityScore < 30 ? 'LOW' : intensityScore < 60 ? 'MEDIUM' : 'HIGH'
	};
}

// Display mode analysis
function displayAnalysis(modeName: ModeName, numRequests = 100) {
	console.log(`\n${'='.repeat(70)}`);
	console.log(`Mode Analysis: ${modeName}`);
	console.log(`${'='.repeat(70)}\n`);

	const mode = getMode(modeName);

	console.log(`Mode Configuration:`);
	console.log(`  Description: ${mode.description}`);
	console.log(`  File I/O Range: ${mode.fileIoRange[0]}-${mode.fileIoRange[1]}MB`);
	console.log(`  Process Range: ${mode.processRange[0]}-${mode.processRange[1]}`);
	console.log(`  CPU Multiplier: ${mode.cpuWorkMultiplier}x`);

	const requests = analyzeWorkload(modeName, numRequests);

	console.log(`\nSimulating ${numRequests} requests with mode '${modeName}':\n`);

	// Show aggregate statistics
	const stats = calculateStats(requests);
	console.log(`${'─'.repeat(70)}`);
	console.log(`Statistics (from ${numRequests} simulated requests):`);
	console.log(`  File I/O: avg=${stats.avgFileIo}MB, min=${stats.minFileIo}MB, max=${stats.maxFileIo}MB`);
	console.log(`  Processes: avg=${stats.avgProcesses}, min=${stats.minProcesses}, max=${stats.maxProcesses}`);
	console.log(`  CPU Multiplier: ${stats.avgCpuMultiplier}x`);
	console.log(`  Intensity Score: ${stats.intensityScore}/100 (${stats.intensity})`);
	console.log(`${'='.repeat(70)}\n`);
}

// Compare multiple modes
function compareModesAnalysis(modeNames: ModeName[]): void {
	console.log(`\n${'='.repeat(70)}`);
	console.log(`Comparing Modes`);
	console.log(`${'='.repeat(70)}\n`);

	const results = [];
	for (const modeName of modeNames) {
		const requests = analyzeWorkload(modeName, 100);
		const stats = calculateStats(requests);
		results.push({
			mode: modeName,
			...stats
		});
	}

	console.log(`Mode         | Avg I/O | Avg Proc | CPU Mult | Intensity`);
	console.log(`-------------|---------|----------|----------|----------`);

	for (const result of results) {
		console.log(
			`${result.mode.padEnd(12)} | ` +
			`${String(result.avgFileIo).padStart(5)}MB | ` +
			`${String(result.avgProcesses).padStart(8)} | ` +
			`${String(result.avgCpuMultiplier).padStart(7)}x | ` +
			`${String(result.intensityScore).padStart(3)}/100 ${result.intensity}`
		);
	}

	console.log(`\n${'='.repeat(70)}\n`);
}

const HELP = `
Mode Analyzer - Preview and compare different workload modes

Usage:
  node mode-analyzer.ts list
    List all available modes and their configurations

  node mode-analyzer.ts analyze <mode>
    Analyze a specific mode and show expected workload statistics

  node mode-analyzer.ts compare <mode1> <mode2> [mode3...]
    Compare multiple modes side-by-side

Examples:
  node mode-analyzer.ts list
  node mode-analyzer.ts analyze medium
  node mode-analyzer.ts compare minimal low medium high maximum
`;

// Main CLI
const command = process.argv[2];

switch (command) {
	case 'analyze': {
		const modeName = process.argv[3] || 'default';

		assertModeName(modeName);
		displayAnalysis(modeName);
		break;
	}
	case 'compare': {
		const modes = process.argv.slice(3);
		if (modes.length < 2) {
			throw new Error('Usage: node mode-analyzer.js compare <mode1> <mode2> [mode3...]');
		}
		assertModeNames(modes);
		compareModesAnalysis(modes);
		break;
	}
	case 'list': {
		listModes();
		break;
	}
	case 'help':
	default: {
		console.log(HELP);
	}
}
