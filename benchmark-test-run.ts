import { existsSync, globSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { availableParallelism} from 'node:os';
import test, { run } from 'node:test';

const NUM_TEST_FILES = parseInt(process.argv[2] || '20', 10);
const MAX_CONCURRENCY = availableParallelism();

const testFilesDir = join(import.meta.dirname, 'test-files');
const testFiles: string[] = [];
for (let i = 0; i < NUM_TEST_FILES; i++) {
	testFiles.push(join(testFilesDir, `${i}.test.ts`));
}

console.log(`\n========================================`);
console.log(`Benchmark Configuration:`);
console.log(`  Number of Test Files: ${NUM_TEST_FILES}`);
console.log(`  Max Concurrency: ${MAX_CONCURRENCY}`);
console.log(`========================================\n`);

interface TestRunBenchmarkResult {
	concurrency: number;
	duration: number;
	passed: number;
	failed: number;
	totalTests: number;
}

// Run benchmarks for each concurrency level
async function benchmarkTestRun(concurrency: number): Promise<TestRunBenchmarkResult> {
	return new Promise((resolve, reject) => {
		const testStream = run({
			cwd: testFilesDir,
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

// Run all benchmarks
console.log(`Running benchmarks from concurrency 1 to ${MAX_CONCURRENCY}...\n`);

// Store test run benchmark results
const results: TestRunBenchmarkResult[] = [];

// Run benchmarks sequentially
for (let i = 1; i <= MAX_CONCURRENCY; i++) {
	console.log(`Testing concurrency ${i}... `);
	const result = await benchmarkTestRun(i);
	results.push(result);
	console.log(`✓ ${result.duration}ms (${result.passed} passed, ${result.failed} failed)`);
}

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
