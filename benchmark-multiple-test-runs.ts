import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises'
import { benchmark, getTestFiles, writeResults } from './benchmark-test-run.ts';
import { availableParallelism } from 'node:os';

// ============================================================================
// Statistical Analysis Functions
// ============================================================================

interface Statistics {
	mean: number;
	median: number;
	stdDev: number;
	min: number;
	max: number;
	p25: number;
	p75: number;
	p95: number;
	p99: number;
}

/**
 * Calculate the mean (average) of an array of numbers
 */
function calculateMean(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the median of an array of numbers
 */
function calculateMedian(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 0) {
		return (sorted[mid - 1] + sorted[mid]) / 2;
	}
	return sorted[mid];
}

/**
 * Calculate the standard deviation of an array of numbers
 */
function calculateStdDev(values: number[]): number {
	if (values.length === 0) return 0;
	const mean = calculateMean(values);
	const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
	const variance = calculateMean(squaredDiffs);
	return Math.sqrt(variance);
}

/**
 * Calculate a specific percentile of an array of numbers
 */
function calculatePercentile(values: number[], percentile: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = (percentile / 100) * (sorted.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	const weight = index - lower;

	return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate comprehensive statistics for an array of numbers
 */
function calculateStatistics(values: number[]): Statistics {
	return {
		mean: calculateMean(values),
		median: calculateMedian(values),
		stdDev: calculateStdDev(values),
		min: Math.min(...values),
		max: Math.max(...values),
		p25: calculatePercentile(values, 25),
		p75: calculatePercentile(values, 75),
		p95: calculatePercentile(values, 95),
		p99: calculatePercentile(values, 99),
	};
}

// ============================================================================
// Result Aggregation Functions
// ============================================================================

interface BenchmarkResult {
	numberOfTestFiles: number;
	applicationMode: string;
	results: {
		concurrency: number;
		duration: number;
		passed: number;
		failed: number;
		totalTests: number;
	}[];
}

interface AggregatedResult {
	concurrency: number;
	durationStats: Statistics;
	passedStats: Statistics;
	failedStats: Statistics;
	sampleCount: number;
}

interface StatisticalAnalysis {
	numberOfTestFiles: number;
	applicationMode: string;
	sampleSize: number;
	aggregatedResults: AggregatedResult[];
	metadata: {
		timestamp: number;
		benchmarkResultsDir: string;
	};
}

/**
 * Read all result files from a benchmark results directory
 */
async function readResultFiles(benchmarkResultsDir: string): Promise<BenchmarkResult[]> {
	const files = await readdir(benchmarkResultsDir);
	const resultFiles = files.filter(file => file.endsWith('.json') && file !== 'statistical-analysis.json');

	const results: BenchmarkResult[] = [];
	for (const file of resultFiles) {
		const filePath = join(benchmarkResultsDir, file);
		const content = await readFile(filePath, 'utf-8');
		results.push(JSON.parse(content));
	}

	return results;
}

/**
 * Aggregate results from multiple benchmark runs and compute statistics
 */
async function aggregateResults(benchmarkResultsDir: string): Promise<StatisticalAnalysis> {
	const results = await readResultFiles(benchmarkResultsDir);

	if (results.length === 0) {
		throw new Error('No results found in directory');
	}

	// Group results by concurrency level
	const resultsByConcurrency = new Map<number, {
		durations: number[];
		passed: number[];
		failed: number[];
	}>();

	for (const result of results) {
		for (const benchResult of result.results) {
			if (!resultsByConcurrency.has(benchResult.concurrency)) {
				resultsByConcurrency.set(benchResult.concurrency, {
					durations: [],
					passed: [],
					failed: [],
				});
			}

			const group = resultsByConcurrency.get(benchResult.concurrency)!;
			group.durations.push(benchResult.duration);
			group.passed.push(benchResult.passed);
			group.failed.push(benchResult.failed);
		}
	}

	// Calculate statistics for each concurrency level
	const aggregatedResults: AggregatedResult[] = [];
	const sortedConcurrencies = Array.from(resultsByConcurrency.keys()).sort((a, b) => a - b);

	for (const concurrency of sortedConcurrencies) {
		const data = resultsByConcurrency.get(concurrency)!;
		aggregatedResults.push({
			concurrency,
			durationStats: calculateStatistics(data.durations),
			passedStats: calculateStatistics(data.passed),
			failedStats: calculateStatistics(data.failed),
			sampleCount: data.durations.length,
		});
	}

	return {
		numberOfTestFiles: results[0].numberOfTestFiles,
		applicationMode: results[0].applicationMode,
		sampleSize: results.length,
		aggregatedResults,
		metadata: {
			timestamp: Date.now(),
			benchmarkResultsDir,
		},
	};
}

// ============================================================================
// Visualization Functions
// ============================================================================

/**
 * Render a statistics table for the aggregated results
 */
function renderStatisticsTable(analysis: StatisticalAnalysis): string {
	const lines: string[] = [];

	lines.push('');
	lines.push('========================================');
	lines.push('Statistical Analysis Results');
	lines.push('========================================');
	lines.push('');
	lines.push(`Configuration:`);
	lines.push(`  Test Files: ${analysis.numberOfTestFiles}`);
	lines.push(`  App Mode: ${analysis.applicationMode}`);
	lines.push(`  Sample Size: ${analysis.sampleSize} runs`);
	lines.push('');

	// Duration statistics table
	lines.push('Duration Statistics (ms):');
	lines.push('-'.repeat(120));
	lines.push(
		'Concurrency'.padEnd(12) + ' | ' +
		'Mean'.padStart(8) + ' | ' +
		'Median'.padStart(8) + ' | ' +
		'StdDev'.padStart(8) + ' | ' +
		'Min'.padStart(8) + ' | ' +
		'Max'.padStart(8) + ' | ' +
		'P25'.padStart(8) + ' | ' +
		'P75'.padStart(8) + ' | ' +
		'P95'.padStart(8) + ' | ' +
		'P99'.padStart(8)
	);
	lines.push('-'.repeat(120));

	for (const result of analysis.aggregatedResults) {
		const stats = result.durationStats;
		lines.push(
			String(result.concurrency).padEnd(12) + ' | ' +
			stats.mean.toFixed(2).padStart(8) + ' | ' +
			stats.median.toFixed(2).padStart(8) + ' | ' +
			stats.stdDev.toFixed(2).padStart(8) + ' | ' +
			stats.min.toFixed(2).padStart(8) + ' | ' +
			stats.max.toFixed(2).padStart(8) + ' | ' +
			stats.p25.toFixed(2).padStart(8) + ' | ' +
			stats.p75.toFixed(2).padStart(8) + ' | ' +
			stats.p95.toFixed(2).padStart(8) + ' | ' +
			stats.p99.toFixed(2).padStart(8)
		);
	}
	lines.push('-'.repeat(120));
	lines.push('');

	// Speedup analysis
	const sequential = analysis.aggregatedResults[0];
	if (sequential) {
		lines.push('Speedup Analysis (vs Sequential):');
		lines.push('-'.repeat(80));
		lines.push(
			'Concurrency'.padEnd(12) + ' | ' +
			'Mean Speedup'.padStart(14) + ' | ' +
			'Median Speedup'.padStart(16) + ' | ' +
			'Best Speedup'.padStart(14) + ' | ' +
			'Worst Speedup'.padStart(14)
		);
		lines.push('-'.repeat(80));

		for (const result of analysis.aggregatedResults) {
			const meanSpeedup = (sequential.durationStats.mean / result.durationStats.mean).toFixed(2);
			const medianSpeedup = (sequential.durationStats.median / result.durationStats.median).toFixed(2);
			const bestSpeedup = (sequential.durationStats.min / result.durationStats.min).toFixed(2);
			const worstSpeedup = (sequential.durationStats.max / result.durationStats.max).toFixed(2);

			lines.push(
				String(result.concurrency).padEnd(12) + ' | ' +
				(meanSpeedup + 'x').padStart(14) + ' | ' +
				(medianSpeedup + 'x').padStart(16) + ' | ' +
				(bestSpeedup + 'x').padStart(14) + ' | ' +
				(worstSpeedup + 'x').padStart(14)
			);
		}
		lines.push('-'.repeat(80));
	}

	return lines.join('\n');
}

/**
 * Render ASCII graphs for duration statistics
 */
function renderASCIIGraphs(analysis: StatisticalAnalysis): string {
	const lines: string[] = [];

	lines.push('');
	lines.push('========================================');
	lines.push('Duration Visualization');
	lines.push('========================================');
	lines.push('');

	// Find the maximum value for scaling
	const maxDuration = Math.max(
		...analysis.aggregatedResults.map(r => r.durationStats.max)
	);

	const maxBarLength = 60;
	const scale = maxDuration / maxBarLength;

	// Mean duration graph
	lines.push(`Mean Duration (each █ = ${scale.toFixed(1)}ms):`);
	lines.push('');
	for (const result of analysis.aggregatedResults) {
		const barLength = Math.round(result.durationStats.mean / scale);
		const bar = '█'.repeat(barLength);
		lines.push(
			`C${String(result.concurrency).padStart(2)} │ ${bar} ${result.durationStats.mean.toFixed(2)}ms`
		);
	}
	lines.push('');

	// Range visualization (min to max)
	lines.push(`Duration Range (Min to Max):`);
	lines.push('');
	for (const result of analysis.aggregatedResults) {
		const minPos = Math.round(result.durationStats.min / scale);
		const maxPos = Math.round(result.durationStats.max / scale);
		const medianPos = Math.round(result.durationStats.median / scale);

		const beforeMin = ' '.repeat(minPos);

		// Build the line with median marker
		let line = beforeMin;
		for (let i = minPos; i <= maxPos; i++) {
			if (i === medianPos) {
				line += '●';
			} else if (i === minPos) {
				line += '├';
			} else if (i === maxPos) {
				line += '┤';
			} else {
				line += '─';
			}
		}

		lines.push(
			`C${String(result.concurrency).padStart(2)} │ ${line} [${result.durationStats.min.toFixed(0)}-${result.durationStats.max.toFixed(0)}ms, median=${result.durationStats.median.toFixed(0)}ms]`
		);
	}
	lines.push('');
	lines.push('Legend: ├─●─┤ = min─median─max');
	lines.push('');

	// Box plot style visualization
	lines.push(`Box Plot (P25, Median, P75):`);
	lines.push('');
	for (const result of analysis.aggregatedResults) {
		const p25Pos = Math.round(result.durationStats.p25 / scale);
		const medianPos = Math.round(result.durationStats.median / scale);
		const p75Pos = Math.round(result.durationStats.p75 / scale);

		const beforeP25 = ' '.repeat(p25Pos);
		let box = '';
		for (let i = p25Pos; i <= p75Pos; i++) {
			if (i === medianPos) {
				box += '┃';
			} else if (i === p25Pos) {
				box += '├';
			} else if (i === p75Pos) {
				box += '┤';
			} else {
				box += '═';
			}
		}

		lines.push(
			`C${String(result.concurrency).padStart(2)} │ ${beforeP25}${box} [P25=${result.durationStats.p25.toFixed(0)}, P75=${result.durationStats.p75.toFixed(0)}]`
		);
	}
	lines.push('');

	return lines.join('\n');
}

/**
 * Render a summary of key findings
 */
function renderSummary(analysis: StatisticalAnalysis): string {
	const lines: string[] = [];

	lines.push('========================================');
	lines.push('Summary & Key Findings');
	lines.push('========================================');
	lines.push('');

	// Find best performing concurrency level (by mean)
	const bestByMean = analysis.aggregatedResults.reduce((best, current) =>
		current.durationStats.mean < best.durationStats.mean ? current : best
	);

	// Find most consistent concurrency level (lowest std dev)
	const mostConsistent = analysis.aggregatedResults.reduce((best, current) =>
		current.durationStats.stdDev < best.durationStats.stdDev ? current : best
	);

	const sequential = analysis.aggregatedResults[0];

	lines.push(`Fastest Configuration:`);
	lines.push(`  Concurrency: ${bestByMean.concurrency}`);
	lines.push(`  Mean Duration: ${bestByMean.durationStats.mean.toFixed(2)}ms`);
	lines.push(`  Speedup: ${(sequential.durationStats.mean / bestByMean.durationStats.mean).toFixed(2)}x`);
	lines.push('');

	lines.push(`Most Consistent Configuration:`);
	lines.push(`  Concurrency: ${mostConsistent.concurrency}`);
	lines.push(`  Std Deviation: ${mostConsistent.durationStats.stdDev.toFixed(2)}ms`);
	lines.push(`  Coefficient of Variation: ${(mostConsistent.durationStats.stdDev / mostConsistent.durationStats.mean * 100).toFixed(2)}%`);
	lines.push('');

	lines.push(`Overall Statistics:`);
	lines.push(`  Total Samples: ${analysis.sampleSize}`);
	lines.push(`  Concurrency Levels Tested: ${analysis.aggregatedResults.length}`);
	lines.push(`  Sequential Mean: ${sequential.durationStats.mean.toFixed(2)}ms`);
	lines.push(`  Best Mean: ${bestByMean.durationStats.mean.toFixed(2)}ms`);
	lines.push(`  Maximum Speedup: ${(sequential.durationStats.mean / bestByMean.durationStats.mean).toFixed(2)}x`);
	lines.push('');

	return lines.join('\n');
}

async function getCLIArgs(args: string[]) {
	const sampleSize = parseInt(process.env.SAMPLE_SIZE || args[0] || '25', 10);
	const numTestFiles = parseInt(process.env.NUM_TEST_FILES || args[1] || '10', 10);
	const appMode = process.env.APP_MODE || args[2] || 'default';
	process.env.APP_MODE = appMode;
	const concurrency = parseInt(process.env.MAX_CONCURRENCY || args[3], 10) || availableParallelism();
	console.log('Confirming benchmark configuration:');
	console.log(`  Sample Size: ${sampleSize}`);
	console.log(`  Number of Test Files: ${numTestFiles}`);
	console.log(`  Application Mode: ${appMode}`);
	console.log(`  Max Concurrency: ${concurrency}\n`);

	if (process.env.CONFIRMED !== '1') {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout
		});

		const answer = await rl.question('Is this configuration correct? (y/n): ');
		if (answer.toLowerCase() !== 'y') {
			console.log('Benchmark aborted. Please set the correct configuration and try again.');
			process.exit(0);
		}
		rl.close();
	} else {
		console.log('Configuration confirmed via environment variable. Proceeding with benchmark...');
	}

	return {
		sampleSize,
		numTestFiles,
		appMode,
		concurrency
	}
}

async function ensureResultsDir(): Promise<string> {
	const benchmarkResultsDir = join(import.meta.dirname, `benchmark-results-${Date.now()}`);
	await mkdir(benchmarkResultsDir, { recursive: true });
	return benchmarkResultsDir;
}

async function runBenchmarks(sampleSize: number, numTestFiles: number, appMode: string, concurrency: number, benchmarkResultsDir: string) {
	const testFiles = getTestFiles(numTestFiles);

	for (let i = 0; i < sampleSize; i++) {
		console.log(`\n=== Running benchmark sample ${i + 1} of ${sampleSize} ===`);
		const results = [];
		for await (const result of benchmark(concurrency, testFiles)) {
			results.push(result);
		}
	
		await writeResults({
			numberOfTestFiles: numTestFiles,
			applicationMode: appMode,
			results
		}, benchmarkResultsDir);
	}
}

async function writeAnalysisResults(benchmarkResultsDir: string, analysis: StatisticalAnalysis) {
	// Save the analysis results to a file
	const analysisFilePath = join(benchmarkResultsDir, 'statistical-analysis.json');
	await writeFile(analysisFilePath, JSON.stringify(analysis, null, 2));
	console.log(`\nStatistical analysis saved to: ${analysisFilePath}`);
}

function renderStatisticalAnalysis(analysis: StatisticalAnalysis): void {
	console.log(renderStatisticsTable(analysis));
	console.log(renderASCIIGraphs(analysis));
	console.log(renderSummary(analysis));
}

if (import.meta.dirname) {
	const command = process.argv[2];

	switch (command) {
		case 'analyze': {
			const benchmarkResultsDir = process.argv[3];
			if (!benchmarkResultsDir) {
				console.error('Please provide the benchmark results directory to analyze.');
				process.exit(1);
			}

			const analysis = await aggregateResults(benchmarkResultsDir);
			await writeAnalysisResults(benchmarkResultsDir, analysis);

			break;
		}
		case 'bench': {
			const { sampleSize, numTestFiles, appMode, concurrency } = await getCLIArgs(process.argv.slice(3));

			const benchmarkResultsDir = await ensureResultsDir();
			
			// Run the benchmarks
			await runBenchmarks(sampleSize, numTestFiles, appMode, concurrency, benchmarkResultsDir);

			console.log('Benchmark runs complete. Results saved to:', benchmarkResultsDir);
			break;
		}
		case 'render': {
			const statisticalAnalysisFile = process.argv[3];
			if (!statisticalAnalysisFile) {
				console.error('Please provide the benchmark results directory to render.');
				process.exit(1);
			}
			
			const statisticalAnalysisContent = await readFile(statisticalAnalysisFile, 'utf-8');
			const analysis: StatisticalAnalysis = JSON.parse(statisticalAnalysisContent);
			
			// Render all visualizations
			renderStatisticalAnalysis(analysis);
			break;
		}
		case 'help': {
			console.log(`Usage: node benchmark-multiple-test-runs.ts [sample size] [number of test files] [application mode] [max concurrency]\n`);
			console.log(`Run benchmarks, analyze results, and render visualizations.\n`);
			console.log(`(Set CONFIRMED=1 to skip confirmation prompt)\n`);
			console.log(`You can also use one of the following commands to run specific actions:\n`);
			console.log(`  analyze [results directory] - Analyze existing benchmark results`);
			console.log(`                                (Produces a statistical-analysis.json file within the results directory)\n`);
			console.log(`  bench [sample size] [number of test files] [application mode] [max concurrency] - Run benchmarks\n`);
			console.log(`  render [statistical analysis file] - Render statistical analysis from existing results\n`);
			break;
		}
		default: {
			const { sampleSize, numTestFiles, appMode, concurrency } = await getCLIArgs(process.argv.slice(2));

			const benchmarkResultsDir = await ensureResultsDir();

			// Run the benchmarks
			await runBenchmarks(sampleSize, numTestFiles, appMode, concurrency, benchmarkResultsDir);

			// After all samples are collected, perform statistical analysis
			console.log('\n\n========================================');
			console.log('Benchmark runs completed!');
			console.log('========================================\n');
			console.log(`All ${sampleSize} samples have been collected.`);
			console.log(`Results saved to: ${benchmarkResultsDir}\n`);

			console.log('Performing statistical analysis...\n');

			const analysis = await aggregateResults(benchmarkResultsDir);

			await writeAnalysisResults(benchmarkResultsDir, analysis);

			// Display all visualizations
			renderStatisticalAnalysis(analysis);
			break;
		}
	}
}



