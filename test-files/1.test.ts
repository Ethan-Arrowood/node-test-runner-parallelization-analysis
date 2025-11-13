import { suite, test, before, after } from 'node:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { strict as assert } from 'node:assert';
import path from 'node:path';

suite('HTTP Server Integration Tests 1', { concurrency: true }, () => {
	let serverProcess: ChildProcess;
	// @ts-expect-error -- Will be replaced during test generation
	const PORT = 3001;

	before(() => {
		// Create HTTP echo server in a separate process
		return new Promise<void>((resolve, reject) => {
			const serverPath = path.join(import.meta.dirname, '..', 'server.ts');
			serverProcess = spawn('node', [serverPath], {
				env: {
					...process.env,
					PORT: PORT.toString(),
					APP_MODE: process.env.APP_MODE || 'default'
				}
			});

			serverProcess.stdout!.on('data', (data) => {
				if (data.toString().includes('Server ready')) {
					resolve();
				}
			});

			serverProcess.stderr!.on('data', (data) => {
				reject(new Error(`Server error: ${data}`));
			});

			serverProcess.on('error', reject);
		});
	})

	after(async () => {
		// Gracefully shutdown the server process
		if (serverProcess) {
			serverProcess.kill('SIGTERM');
			// Wait for process to exit
			await new Promise((resolve) => {
				serverProcess.on('exit', resolve);
			});
		}
	})

	test('request 1', async () => {
		const response = await fetch(`http://localhost:${PORT}`);
		const json = await response.json();

		if (!response.ok) {
			assert.fail(json.error);
		}

		assert.ok(json.metrics.fileIoAmount >= 0);
		assert.ok(json.metrics.processCount >= 0);
		assert.ok(json.metrics.threadCount >= 0);
	});

	test('request 2', async () => {
		const response = await fetch(`http://localhost:${PORT}`);
		const json = await response.json();

		if (!response.ok) {
			assert.fail(json.error);
		}

		assert.ok(json.metrics.fileIoAmount >= 0);
		assert.ok(json.metrics.processCount >= 0);
		assert.ok(json.metrics.threadCount >= 0);
	});

	test('request 3', async () => {
		const response = await fetch(`http://localhost:${PORT}`);
		const json = await response.json();

		if (!response.ok) {
			assert.fail(json.error);
		}

		assert.ok(json.metrics.fileIoAmount >= 0);
		assert.ok(json.metrics.processCount >= 0);
		assert.ok(json.metrics.threadCount >= 0);
	});

	test('request 4', async () => {
		const response = await fetch(`http://localhost:${PORT}`);
		const json = await response.json();

		if (!response.ok) {
			assert.fail(json.error);
		}

		assert.ok(json.metrics.fileIoAmount >= 0);
		assert.ok(json.metrics.processCount >= 0);
		assert.ok(json.metrics.threadCount >= 0);
	});
})
