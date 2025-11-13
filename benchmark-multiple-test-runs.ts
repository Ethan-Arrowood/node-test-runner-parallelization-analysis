// Given a sample size (5, 25, 50, etc.), a number of test files (5, 10, 20), and application mode (default, etc.)
// Confirm settings (skip if CONFIRMED=1) and then
// Execute the benchmark-test-run and collect the results
// Compute statistics like average, fastest, slowest, mean, median, standard deviation, etc.
// Save result to a file for tracking
// Render results in table + ASCII graph for visualization

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises'
import { benchmark, getTestFiles, writeResults } from './benchmark-test-run.ts';
import { availableParallelism } from 'node:os';

const SAMPLE_SIZE = parseInt(process.env.SAMPLE_SIZE || process.argv[2] || '25', 10);
const NUM_TEST_FILES = parseInt(process.env.NUM_TEST_FILES || process.argv[3] || '10', 10);
const APP_MODE = process.env.APP_MODE || process.argv[4] || 'default';
process.env.APP_MODE = APP_MODE;
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || process.argv[5], 10) || availableParallelism();

console.log('Confirming benchmark configuration:');
console.log(`  Sample Size: ${SAMPLE_SIZE}`);
console.log(`  Number of Test Files: ${NUM_TEST_FILES}`);
console.log(`  Application Mode: ${APP_MODE}`);
console.log(`  Max Concurrency: ${MAX_CONCURRENCY}\n`);

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

const benchmarkResultsDir = join(import.meta.dirname, `benchmark-results-${Date.now()}`);
await mkdir(benchmarkResultsDir, { recursive: true });

const testFiles = getTestFiles(NUM_TEST_FILES);

for (let i = 0; i < SAMPLE_SIZE; i++) {
	console.log(`\n=== Running benchmark sample ${i + 1} of ${SAMPLE_SIZE} ===`);

	const results = [];
	for await (const result of benchmark(MAX_CONCURRENCY, testFiles)) {
		results.push(result);
	}

	await writeResults({
		numberOfTestFiles: NUM_TEST_FILES,
		applicationMode: APP_MODE,
		results
	}, benchmarkResultsDir);
}

