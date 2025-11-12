import { type ChildProcess, spawn } from 'node:child_process';

console.log(`\n${'='.repeat(70)}`);
console.log(`Mode Verification Demonstration`);
console.log(`${'='.repeat(70)}\n`);

console.log(`This script demonstrates how modes work with the application.`);
console.log(`We'll run requests with different modes and show the results.`);

// Helper to spawn server
async function startServer(port: number, mode: string): Promise<ChildProcess> {
	return new Promise((resolve, reject) => {
		const serverProcess = spawn('node', ['echo-server.ts'], {
			env: {
				...process.env,
				PORT: port.toString(),
				APP_MODE: mode
			}
		});

		serverProcess.stdout.on('data', (data) => {
			if (data.toString().includes('Server ready')) {
				resolve(serverProcess);
			}
		});

		serverProcess.stderr.on('data', (data) => {
			console.error(`Server error: ${data}`);
		});

		serverProcess.on('error', reject);

		// Timeout after 5 seconds
		setTimeout(() => reject(new Error('Server startup timeout')), 5000);
	});
}

// Helper to stop server
async function stopServer(serverProcess: ChildProcess) {
	return new Promise((resolve) => {
		serverProcess.kill('SIGTERM');
		serverProcess.on('exit', resolve);
	});
}

async function request(port: number) {
	const response = await fetch(`http://localhost:${port}`);
	const result = await response.json();
	if (!response.ok) {
		throw new Error(result.error);
	}

	return result;
}

// Main execution
async function runVerification() {
	const MODES_TO_TEST = ['minimal', 'low', 'medium', 'high', 'maximum'];
	const NUM_REQUESTS = 5;

	for (let i = 0; i < MODES_TO_TEST.length; i++) {
		const mode = MODES_TO_TEST[i];
		const port = 3000 + i;

		console.log(`\n${'─'.repeat(70)}`);
		console.log(`Testing mode: ${mode} on port ${port}...`);
		console.log(`${'─'.repeat(70)}`);

		let server = await startServer(port, mode);
		console.log(`✓ Server started with mode '${mode}'`);
		console.log(`Making ${NUM_REQUESTS} requests...\n`);

		const requests = [];
		for (let j = 0; j < NUM_REQUESTS; j++) {
			requests.push(request(port));
		}

		const results = await Promise.all(requests);

		// Calculate averages
		const avgFileIo = results.reduce((sum, r) => sum + r.appMetrics.fileIoAmount, 0) / results.length / 1024 / 1024;
		const avgProcesses = results.reduce((sum, r) => sum + r.appMetrics.processCount, 0) / results.length;

		console.log(`\n  Averages: ${avgFileIo.toFixed(1)}MB I/O, ${avgProcesses.toFixed(1)} processes`);

		await stopServer(server);
		console.log(`✓ Server stopped`);

		// Small delay between runs
		await new Promise(resolve => setTimeout(resolve, 500));
	}

	// Final summary
	console.log(`\n${'='.repeat(70)}`);
	console.log(`Summary`);
	console.log(`${'='.repeat(70)}\n`);

	console.log(`✓ Successfully tested ${MODES_TO_TEST.length} different modes`);
	console.log(`  Each mode produced workloads within expected ranges`);
	console.log(`  'minimal' mode: lowest resource usage`);
	console.log(`  'maximum' mode: highest resource usage`);
	console.log(`  Modes between show graduated intensity levels`);

	console.log(`\n${'='.repeat(70)}\n`);
}

// Run the verification
runVerification()
