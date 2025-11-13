import { join } from 'node:path';
import { availableParallelism} from 'node:os';
import { run } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';

interface TestRunBenchmarkResult {
	concurrency: number;
	duration: number;
	passed: number;
	failed: number;
	totalTests: number;
}

// Run benchmarks for each concurrency level
async function benchmarkTestRun(concurrency: number, testFiles: string[], ): Promise<TestRunBenchmarkResult> {
	return new Promise((resolve, reject) => {
		const testStream = run({
			files: testFiles,
			concurrency,
		});

		testStream.on('test:summary', (data) => {
			// Only resolve on the main summary, not individual file summaries
			if (!data.file) {
				resolve({
					concurrency,
					duration: data.duration_ms ? Math.round(data.duration_ms) : 0,
					passed: data.counts.passed,
					// @ts-expect-error -- incorrect type definitions
					failed: data.counts.failed,
					totalTests: data.counts.tests
				});
			}
		})

		testStream.on('error', (err) => {
			reject(err);
		});

		// Drain the stream to ensure it completes
		testStream.resume();
	});
}

export async function * benchmark(concurrency: number, testFiles: string[]): AsyncGenerator<TestRunBenchmarkResult, void, unknown> {
	// Run benchmarks sequentially
	for (let i = 1; i <= concurrency; i++) {
		const result = await benchmarkTestRun(i, testFiles);
		yield result;
	}

	return;
}

async function ensureResultsDir() {
	const resultsDir = join(import.meta.dirname, 'benchmark-results');
	await mkdir(resultsDir, { recursive: true });
	return resultsDir;
}

interface BenchmarkResult {
	numberOfTestFiles: number;
	applicationMode: string;
	results: TestRunBenchmarkResult[];
}

export async function writeResults(results: BenchmarkResult, resultsDir: string) {
	return await writeFile(join(resultsDir, `results-${Date.now()}.json`), JSON.stringify(results, null, 2));
}

export function getTestFiles(numFiles: number): string[] {
	const testFilesDir = join(import.meta.dirname, 'test-files');
	const testFiles: string[] = [];
	for (let i = 0; i < numFiles; i++) {
		testFiles.push(join(testFilesDir, `${i}.test.ts`));
	}
	return testFiles;
}

if (import.meta.main) {
	const NUM_TEST_FILES = parseInt(process.env.NUM_TEST_FILES || process.argv[2] || '20', 10);
	const APP_MODE = process.env.APP_MODE || process.argv[3] || 'default';
	// Set the APP_MODE for the test runs
	process.env.APP_MODE = APP_MODE;
	const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || process.argv[4], 10) || availableParallelism();

	const testFiles = getTestFiles(NUM_TEST_FILES);

	console.log(`\n========================================`);
	console.log(`Benchmark Configuration:`);
	console.log(`  Number of Test Files: ${NUM_TEST_FILES}`);
	console.log(`  Application Mode: ${APP_MODE}`);
	console.log(`  Max Concurrency: ${MAX_CONCURRENCY}`);
	console.log(`========================================\n`);

	const resultsDir = await ensureResultsDir();

	const results: TestRunBenchmarkResult[] = [];

	// Run all benchmarks
	console.log(`Running benchmarks from concurrency 1 to ${MAX_CONCURRENCY}...\n`);
	for await (const result of benchmark(MAX_CONCURRENCY, testFiles)) {
		console.log(`Concurrency ${result.concurrency} completed in ${result.duration}ms - Passed: ${result.passed}, Failed: ${result.failed}`);
		results.push(result);
	}

	await writeResults({
		numberOfTestFiles: NUM_TEST_FILES,
		applicationMode: APP_MODE,
		results
	}, resultsDir);

	// Display results
	console.log(`\n========================================`);
	console.log(`Benchmark Results:`);
	console.log(`========================================\n`);
	
	// Find fastest and slowest
	const fastest = results.reduce((min, r) => r.duration < min.duration ? r : min);
	const slowest = results.reduce((max, r) => r.duration > max.duration ? r : max);
	
	// Display table
	console.log(`Concurrency | Duration (ms) | Speedup vs Sequential | Status`);
	console.log(`------------|---------------|-----------------------|-------`);
	
	const sequential = results[0].duration;
	
	for (const result of results) {
		const speedup = (sequential / result.duration).toFixed(2);
		const isFastest = result === fastest ? '🏆' : '';
		const isSlowest = result === slowest ? '🐌' : '';
		const status = result.failed > 0 ? '❌ FAILED' : '✅';
	
		console.log(
			`${String(result.concurrency).padStart(11)} | ` +
			`${String(result.duration).padStart(14)} | ` +
			`${String(speedup + 'x').padStart(20)} | ` +
			`${status} ${isFastest}${isSlowest}`
		);
	}
	
	// Display ASCII graph
	console.log(`\n========================================`);
	console.log(`Duration Graph (each ▪ = ${Math.ceil(slowest.duration / 50)}ms):`);
	console.log(`========================================\n`);
	
	const maxBarLength = 50;
	const scale = slowest.duration / maxBarLength;
	
	for (const result of results) {
		const barLength = Math.round(result.duration / scale);
		const bar = '▪'.repeat(barLength);
		console.log(`C${String(result.concurrency).padStart(2)} │ ${bar} ${result.duration}ms`);
	}
	
	console.log(`\n========================================`);
	console.log(`Summary:`);
	console.log(`  Fastest: Concurrency ${fastest.concurrency} at ${fastest.duration}ms`);
	console.log(`  Slowest: Concurrency ${slowest.concurrency} at ${slowest.duration}ms`);
	console.log(`  Best speedup: ${(sequential / fastest.duration).toFixed(2)}x vs sequential`);
	console.log(`  Sweet spot: Concurrency ${fastest.concurrency} (${(fastest.concurrency / MAX_CONCURRENCY * 100).toFixed(0)}% of max)`);
	console.log(`========================================\n`);
}
