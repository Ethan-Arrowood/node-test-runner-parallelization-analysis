import { parentPort, workerData } from 'node:worker_threads';

// Simulate CPU-intensive work
let result = 0;
for (let i = 0; i < workerData.iterations; i++) {
	result += Math.sqrt(i) * Math.random();
}

parentPort!.postMessage({ result });