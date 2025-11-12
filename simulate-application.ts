import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { getMode, randomInRange, type ModeName} from './modes.ts';

interface SimulationResultSuccess {
	fileIoAmount: number;
	processCount: number;
	mode: ModeName;
	success: true;
}

interface SimulationResultFailure {
	error: unknown;
	mode: ModeName;
	success: false;
}

type SimulationResult = SimulationResultSuccess | SimulationResultFailure;
/**
 * Simulates a resource-intensive application that performs various operations:
 * - File system I/O (configurable via mode)
 * - Spawns child processes (configurable via mode)
 * - Creates worker threads for CPU-intensive work
 * - Database-like operations with serialization
 */
export async function simulateApplication(modeName: ModeName = 'default'): Promise<SimulationResult> {
	console.log('starting simulation with mode:', modeName);
	// Get mode configuration
	const mode = getMode(modeName);

	// Use a unique directory per request to avoid race conditions
	const tmpDir = await mkdtemp(join(tmpdir(), `node-test-runner-parallelization-analysis-`));

	try {
		// File I/O work based on mode range (in MB)
		const fileIoMB = randomInRange(mode.fileIoRange[0], mode.fileIoRange[1]);
		const fileIoAmount = Math.floor(fileIoMB) * 1024 * 1024;
		await performFileOperations(tmpDir, fileIoAmount);

		// Spawn child processes based on mode range
		const processCount = Math.floor(randomInRange(mode.processRange[0], mode.processRange[1] + 0.999));
		await spawnChildProcesses(processCount);

		// CPU-intensive work via worker threads (simulating database operations)
		await performCpuWork(mode.cpuWorkMultiplier);

		return {
			fileIoAmount,
			processCount,
			mode: modeName,
			success: true
		};
	} catch (error) {
		return {
			error: error,
			mode: modeName,
			success: false
		};
	} finally {
		await cleanup(tmpDir);
	}
}

async function performFileOperations(tmpDir: string, totalBytes: number) {
	if (totalBytes === 0) return;

	const chunkSize = 1024 * 1024; // 1MB chunks
	const chunks = Math.ceil(totalBytes / chunkSize);

	// Write files
	const writePromises = [];
	for (let i = 0; i < chunks; i++) {
		const filePath = join(tmpDir, `data-${i}.bin`);
		const data = randomBytes(Math.min(chunkSize, totalBytes - (i * chunkSize)));
		writePromises.push(writeFile(filePath, data));
	}
	await Promise.all(writePromises);

	// Read files back
	const readPromises = [];
	for (let i = 0; i < chunks; i++) {
		const filePath = join(tmpDir, `data-${i}.bin`);
		readPromises.push(readFile(filePath));
	}
	await Promise.all(readPromises);

	// Delete files
	const deletePromises = [];
	for (let i = 0; i < chunks; i++) {
		const filePath = join(tmpDir, `data-${i}.bin`);
		deletePromises.push(unlink(filePath));
	}
	await Promise.all(deletePromises);
}

async function spawnChildProcesses(count: number) {
	if (count === 0) return;

	const processes = [];
	for (let i = 0; i < count; i++) {
		const workDuration = 50 + Math.random() * 150;
		// Spawn a simple process that does some work
		const proc = spawn('node', ['-e', `
			// Simulate some CPU work
			const start = Date.now();
			let sum = 0;
			while (Date.now() - start < ${workDuration}) {
				sum += Math.random();
			}
			console.log('Done');
		`]);

		processes.push(new Promise((resolve) => {
			proc.on('exit', resolve);
		}));
	}

	await Promise.all(processes);
}

function performCpuWork(multiplier = 1.0) {
	return new Promise((resolve, reject) => {
		const iterations = Math.floor(10_000_000 * multiplier);

		const worker = new Worker(`
			import { parentPort, workerData } from 'node:worker_threads';
			
			// Simulate CPU-intensive work
			let result = 0;
			for (let i = 0; i < ${iterations}; i++) {
				result += Math.sqrt(i) * Math.random();
			}
			
			parentPort.postMessage({ result });
			`, { eval: true });

		worker.on('message', (msg) => {
			worker.terminate();
			resolve(msg.result);
		});

		worker.on('error', reject);
		worker.on('exit', (code) => {
			if (code !== 0) {
				reject(new Error(`Worker stopped with exit code ${code}`));
			}
		});
	});
}

async function cleanup(tmpDir: string) {
	try {
		await rm(tmpDir, { recursive: true, force: true });
	} catch (error) {
		// Ignore cleanup errors
	}
}
