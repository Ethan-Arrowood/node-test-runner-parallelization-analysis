import { createServer } from 'node:http';

import { simulateApplication } from './simulate-application.ts';

const PORT = process.env.PORT || 3000;
const mode = process.env.APP_MODE || 'default';

const server = createServer((req, res) => {
	req.resume();
	req.on('end', async () => {
		// Simulate resource-intensive application work
		const result = await simulateApplication(mode);
		console.log('Application simulation result:', result);

		if (result.success) {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({
				mode: result.mode,
				metrics: {
					fileIoAmount: result.fileIoAmount,
					processCount: result.processCount,
					threadCount: result.threadCount
				}
			}));
		} else {
			res.writeHead(500, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: result.error }));
		}

	});
});

server.listen(PORT, () => {
	console.log('Server ready');
});

process.on('SIGTERM', () => {
	server.close(() => process.exit(0));
});
