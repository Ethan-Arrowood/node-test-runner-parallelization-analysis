# Node.js Test Runner Parallelization Analysis

When building integration test suites for resource-intensive applications, understanding test parallelization becomes critical. Modern applications often require:

- **Dedicated process instances** - Each test file needs its own application server
- **Heavy resource usage** - Applications may spawn worker threads, child processes, and perform significant I/O
- **Multiple environments** - Tests run on powerful development machines (12+ cores) but also on constrained CI runners (2-4 cores)

The challenge: **How many tests should run in parallel?**

Running too few tests sequentially is slow. Running too many causes resource contention, thrashing, and unpredictable failures. This project systematically measures the performance impact of different parallelization strategies.

## Understanding Node.js Test Runner: Parallelism and Concurrency

The Node.js test runner has two distinct concepts that are often confused:

### File-Level Parallelism (True Parallelism)

```javascript
// Each test file runs in a separate OS process
node --test --test-concurrency=5 "*.test.js"
```

- Controlled by `--test-concurrency` flag
- Each test file executes in its own **child process**
- True OS-level parallelism with separate memory spaces
- Default: `os.availableParallelism()` (typically CPU core count)

### Test-Level Concurrency (Async, Not Threads)

```javascript
suite('My Tests', { concurrency: true }, () => {
  test('test 1', async () => { /* ... */ });
  test('test 2', async () => { /* ... */ });
});
```

- Controlled by `concurrency` option in `suite()` or `test()` calls
- Tests run **concurrently on the same event loop** (like `Promise.all()`)
- No additional threads or processes - just async scheduling
- Useful when tests are I/O bound and can run simultaneously

### Key Difference

```
File Parallelism:     [Process 1] [Process 2] [Process 3]  ← True parallelism
Test Concurrency:     [Single Process: Promise.all(...)]   ← Async concurrency
```

For resource-intensive integration tests, **file-level parallelism is the primary concern** because each test file spawns its own application instance.

## Benchmark Test Run with Concurrency Sequential to Max

This repo contains a directory of test files (`test-files`) that have been generated using the `generate-tests.ts` script and `test.template.ts` template.

The test files are designed to run in parallel by running the server application on incrementing ports in new processes.

So in order to execute any single test file, it will use at least 2 process. One for the test execution itself, and another for the server. The server incorporates the simulated application and thus can potentially result in more processes, threads, and I/O utilization.

You can run these files however you want using the Node.js test runner `node --test`, but you may be interested in using the dedicated `benchmark-test-run.ts` script to automate benchmarking and analysis of running some specified number of test files from sequential to max parallelism. By default the script will execute all 20 test files.

```
node benchmark-test-run.ts 20
```