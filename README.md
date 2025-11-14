# Node.js Test Runner Parallelization Analysis

When building test suites for resource-intensive applications, understanding test parallelization becomes critical. Modern applications often are comprised of multiple processes, worker threads, high-volume file I/O, and significant CPU usage. Unit tests generally are less resource intensive as they will only test a small subset of the overall application code; potentially even using mocks or stubs to replace certain parts. Comparatively integration tests generally run the entire application code in a separate process and then test it resulting in more realistic execution behavior. Not only do these types of tests take longer to run, but also are more resource intensive since there is at least two processes involved; the test suite and the application. End-to-end (E2E) tests are similar, except they often have the application running on a separate system, such as testing an actual production environment deployment, thus the tests themselves may be the only thing running on the specific machine.

This analysis focusses on the **integration testing** scenario specifically, seeking to best understand parallelization limitations for resource intensive test runs. Moreover, it explores the optimal parallelization configuration for the Node.js test runner when its testing a resource intensive application on the same machine. Running too few tests sequentially is slow. Running too many concurrently causes resource contention, thrashing, and unpredictable failures.

Node.js test runner uses the system maximum available parallelism by default; meaning given a set of test files, regardless of what they do (such as spin up an application in another process) the test runner will parallelize the execution as much as possible. The hypothesis is that this is an inefficient and potentially unreliable configuration for resource intensive tests.

The procedure is to measure the overall duration and assert correctness of a set of test files testing a simulated application with concurrency values from sequential up to maximum system parallelism. We run this measurement some for a reasonable sample size, and then analyze the results. The goal is to determine the most consistently efficient parallelism configuration for running resource intensive integration tests while performing regular system operations. The point is to emulate what an actual application developer would be doing locally and to find the optimal setting so that they can run integration tests efficiently and reliably. Of course maximum parallelism would work if the developer wasn't using their machine for anything else, but that is unrealistic. We are optimizing for developer experience, not absolute performance.

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

## Benchmark from Sequential to Max Concurrency

This repo contains a directory of test files (`test-files`) that have been generated using the `generate-tests.ts` script and `test.template.ts` template.

The test files are designed to run in parallel by running the server application on incrementing ports in new processes.

So in order to execute any single test file, it will use at least 2 process. One for the test execution itself, and another for the server. The server incorporates the simulated application and thus can potentially result in more processes, threads, and I/O utilization based on the configured [mode](#modes).

You can run these files however you want using the Node.js test runner `node --test`, but you may be interested in using the dedicated `benchmark-test-run.ts` script to automate benchmarking and analysis of running some specified number of test files from sequential to max concurrency. By default the script will execute all 20 test files in `default` mode from sequential to maximum concurrency. All of these things are configurable using positional CLI args or environment variables

```
node benchmark-test-run.ts [number of test files] [app mode] [max concurrency]
```

Environment Variables:

- `NUM_TEST_FILES` : set the number of test files to execute; should not exceed the generated number of files
- `APP_MODE` : set the simulated application mode
- `MAX_CONCURRENCY` : set the maximum concurrency to test up to

This script will create a `benchmark-results-*` directory and write the benchmark results out to a `results-*.json` file. It will also automatically render results and some statistics to stdout.

This script only runs the tests once per concurrency. Through testing and analysis it was determined there is a significant amount of variance in the performance of runs. In order to get a statistically accurate understanding, we recommend benchmarking multiple times and analyzing the collection of results. See the [Benchmark Multiple Runs](#benchmark-multiple-runs) for more information and another useful script.

## Benchmark Multiple Runs

```
Usage: node benchmark-multiple-test-runs.ts [sample size] [number of test files] [application mode] [max concurrency]

Run benchmarks, analyze results, and render visualizations.

(Set CONFIRMED=1 to skip confirmation prompt)

You can also use one of the following commands to run specific actions:

  analyze [results directory] - Analyze existing benchmark results
                                (Produces a statistical-analysis.json file within the results directory)

  bench [sample size] [number of test files] [application mode] [max concurrency] - Run benchmarks

  render [statistical analysis file] - Render statistical analysis from existing results
```

As mentioned in the [Benchmark from Sequential to Max Concurrency](#benchmark-from-sequential-to-max-concurrency) section, we recommend running the benchmark multiple times to get an accurate understanding of the best parallelism configuration. The included script `benchmark-multiple-test-runs.ts` enables you to easily run these benchmarks and then produce statistical analysis. It includes individual commands for running each operation separately if necessary. It will also create a `benchmark-results-*` directory and `results-*.json` files, plus an additional `statistical-analysis.json` file.

The default sample size is `25`, and the other options have the same defaults as `benchmark-test-run.ts`...
- number of tests defaults to `20`
- app mode is `default`
- max concurrency is system available parallelism

## Examples Results

I ran the benchmarks on my M3 Macbook Pro using Node.js v24.11.1 while running a reasonable amount of other applications (Slack, Google Chrome, multiple VSCode instances, etc.). I avoided doing any other expensive things on my machine when I ran the test, such as streaming videos or running larger applications. I clicked around my browser doing emails, reviewed and replied to GitHub and Slack notifications, and generally just acted like I was doing regular developer things while the test benchmarks executed.

Here is the stdout of my benchmark run:
```
Confirming benchmark configuration:
  Sample Size: 25
  Number of Test Files: 20
  Application Mode: default
  Max Concurrency: 12

Is this configuration correct? (y/n): y

=== Running benchmark sample 1 of 25 ===

=== Running benchmark sample 2 of 25 ===

=== Running benchmark sample 3 of 25 ===

=== Running benchmark sample 4 of 25 ===

=== Running benchmark sample 5 of 25 ===

=== Running benchmark sample 6 of 25 ===

=== Running benchmark sample 7 of 25 ===

=== Running benchmark sample 8 of 25 ===

=== Running benchmark sample 9 of 25 ===

=== Running benchmark sample 10 of 25 ===

=== Running benchmark sample 11 of 25 ===

=== Running benchmark sample 12 of 25 ===

=== Running benchmark sample 13 of 25 ===

=== Running benchmark sample 14 of 25 ===

=== Running benchmark sample 15 of 25 ===

=== Running benchmark sample 16 of 25 ===

=== Running benchmark sample 17 of 25 ===

=== Running benchmark sample 18 of 25 ===

=== Running benchmark sample 19 of 25 ===

=== Running benchmark sample 20 of 25 ===

=== Running benchmark sample 21 of 25 ===

=== Running benchmark sample 22 of 25 ===

=== Running benchmark sample 23 of 25 ===

=== Running benchmark sample 24 of 25 ===

=== Running benchmark sample 25 of 25 ===


========================================
Benchmark runs completed!
========================================

All 25 samples have been collected.
Results saved to: /Users/ethan/dev/ethan-arrowood/node-test-runner-parallelization-analysis/benchmark-results-1763078871208

Performing statistical analysis...


Statistical analysis saved to: /Users/ethan/dev/ethan-arrowood/node-test-runner-parallelization-analysis/benchmark-results-1763078871208/statistical-analysis.json

========================================
Statistical Analysis Results
========================================

Configuration:
  Test Files: 20
  App Mode: default
  Sample Size: 25 runs

Duration Statistics (ms):
------------------------------------------------------------------------------------------------------------------------
Concurrency  |     Mean |   Median |   StdDev |      Min |      Max |      P25 |      P75 |      P95 |      P99
------------------------------------------------------------------------------------------------------------------------
1            | 10023.44 |  9939.00 |   362.70 |  9255.00 | 10885.00 |  9758.00 | 10299.00 | 10607.40 | 10829.56
2            |  5814.08 |  5776.00 |   307.34 |  5269.00 |  6876.00 |  5628.00 |  5937.00 |  6164.40 |  6709.92
3            |  4616.44 |  4582.00 |   364.52 |  4138.00 |  5729.00 |  4304.00 |  4807.00 |  5251.80 |  5631.56
4            |  4034.36 |  3904.00 |   367.65 |  3614.00 |  5238.00 |  3808.00 |  4194.00 |  4647.80 |  5102.16
5            |  3782.40 |  3759.00 |   332.15 |  3329.00 |  4739.00 |  3507.00 |  3950.00 |  4263.60 |  4625.00
6            |  3752.84 |  3597.00 |   458.57 |  3236.00 |  4874.00 |  3481.00 |  3825.00 |  4751.00 |  4846.40
7            |  3502.76 |  3468.00 |   294.06 |  3096.00 |  4520.00 |  3284.00 |  3611.00 |  3990.00 |  4408.40
8            |  3686.08 |  3671.00 |   472.19 |  2979.00 |  5106.00 |  3337.00 |  3865.00 |  4574.80 |  4988.16
9            |  3698.28 |  3601.00 |   473.22 |  3231.00 |  5177.00 |  3407.00 |  3769.00 |  4804.40 |  5110.04
10           |  3778.20 |  3534.00 |   654.09 |  3007.00 |  5466.00 |  3391.00 |  3968.00 |  5339.20 |  5464.32
11           |  3902.40 |  3724.00 |   690.41 |  2932.00 |  5717.00 |  3413.00 |  4308.00 |  5096.00 |  5571.80
12           |  3958.00 |  3952.00 |   488.48 |  3210.00 |  5055.00 |  3532.00 |  4374.00 |  4792.40 |  4999.56
------------------------------------------------------------------------------------------------------------------------

Speedup Analysis (vs Sequential):
--------------------------------------------------------------------------------
Concurrency  |   Mean Speedup |   Median Speedup |   Best Speedup |  Worst Speedup
--------------------------------------------------------------------------------
1            |          1.00x |            1.00x |          1.00x |          1.00x
2            |          1.72x |            1.72x |          1.76x |          1.58x
3            |          2.17x |            2.17x |          2.24x |          1.90x
4            |          2.48x |            2.55x |          2.56x |          2.08x
5            |          2.65x |            2.64x |          2.78x |          2.30x
6            |          2.67x |            2.76x |          2.86x |          2.23x
7            |          2.86x |            2.87x |          2.99x |          2.41x
8            |          2.72x |            2.71x |          3.11x |          2.13x
9            |          2.71x |            2.76x |          2.86x |          2.10x
10           |          2.65x |            2.81x |          3.08x |          1.99x
11           |          2.57x |            2.67x |          3.16x |          1.90x
12           |          2.53x |            2.51x |          2.88x |          2.15x
--------------------------------------------------------------------------------

========================================
Duration Visualization
========================================

Mean Duration (each █ = 181.4ms):

C 1 │ ███████████████████████████████████████████████████████ 10023.44ms
C 2 │ ████████████████████████████████ 5814.08ms
C 3 │ █████████████████████████ 4616.44ms
C 4 │ ██████████████████████ 4034.36ms
C 5 │ █████████████████████ 3782.40ms
C 6 │ █████████████████████ 3752.84ms
C 7 │ ███████████████████ 3502.76ms
C 8 │ ████████████████████ 3686.08ms
C 9 │ ████████████████████ 3698.28ms
C10 │ █████████████████████ 3778.20ms
C11 │ ██████████████████████ 3902.40ms
C12 │ ██████████████████████ 3958.00ms

Duration Range (Min to Max):

C 1 │                                                    ├───●────┤ [9255-10885ms, median=9939ms]
C 2 │                              ├──●─────┤ [5269-6876ms, median=5776ms]
C 3 │                        ├─●──────┤ [4138-5729ms, median=4582ms]
C 4 │                     ├─●──────┤ [3614-5238ms, median=3904ms]
C 5 │                   ├──●────┤ [3329-4739ms, median=3759ms]
C 6 │                   ├─●──────┤ [3236-4874ms, median=3597ms]
C 7 │                  ├─●─────┤ [3096-4520ms, median=3468ms]
C 8 │                 ├───●───────┤ [2979-5106ms, median=3671ms]
C 9 │                   ├─●────────┤ [3231-5177ms, median=3601ms]
C10 │                  ├─●──────────┤ [3007-5466ms, median=3534ms]
C11 │                 ├────●──────────┤ [2932-5717ms, median=3724ms]
C12 │                   ├───●─────┤ [3210-5055ms, median=3952ms]

Legend: ├─●─┤ = min─median─max

Box Plot (P25, Median, P75):

C 1 │                                                       ├┃═┤ [P25=9758, P75=10299]
C 2 │                                ├┃┤ [P25=5628, P75=5937]
C 3 │                         ├┃┤ [P25=4304, P75=4807]
C 4 │                      ├┃┤ [P25=3808, P75=4194]
C 5 │                    ├═┃┤ [P25=3507, P75=3950]
C 6 │                    ├┃┤ [P25=3481, P75=3825]
C 7 │                   ├┃┤ [P25=3284, P75=3611]
C 8 │                   ├═┃┤ [P25=3337, P75=3865]
C 9 │                    ├┃┤ [P25=3407, P75=3769]
C10 │                    ┃══┤ [P25=3391, P75=3968]
C11 │                    ├═┃══┤ [P25=3413, P75=4308]
C12 │                    ├══┃═┤ [P25=3532, P75=4374]

========================================
Summary & Key Findings
========================================

Fastest Configuration:
  Concurrency: 7
  Mean Duration: 3502.76ms
  Speedup: 2.86x

Most Consistent Configuration:
  Concurrency: 7
  Std Deviation: 294.06ms
  Coefficient of Variation: 8.40%

Overall Statistics:
  Total Samples: 25
  Concurrency Levels Tested: 12
  Sequential Mean: 10023.44ms
  Best Mean: 3502.76ms
  Maximum Speedup: 2.86x
```

The results demonstrate that the most consistent configuration is to use slightly more than half of my system's maximum parallelization potential. The box plot and duration range visualizations clearly show that `7` concurrent test processes produced the most consistently performant integration test execution. Furthermore, even at maximum parallelization, my system had no issues as no tests failed throughout the benchmark. This may not be true for other, less-modern machines that don't have the capabilities to handle overloaded use.

## Modes

Real applications and integration tests don't always do the same amount of work. They don't necessarily use the same number of processes, worker threads, or handle the same amount of I/O work. So when conducting this research it was naive to always use the exact same amount of work. Rather than adding in a large variance of randomness, we use **modes** that can either specify an exact amount of work or a range that can then be randomized.

For example, the `default` mode tells the simulated application to use anywhere from 0MB to 100MB of File I/O, 0 to 3 processes, and use 0 to 4 worker threads with a regular amount of CPU work.

Meanwhile the `maximum` mode specifies 100MB of File I/O, 3 processes, 4 worker threads with double the amount of CPU work.

The various modes can be used to see how test parallelization works over a variety of circumstances. Generally, specifying ranges is important since in a real set of integration test files, one file might do significantly more work than the next.

### Mode Information

For information on available modes and their configurations use the included `mode.ts info` command.

List all modes and their configuration details:

```
node mode.ts info
```

Compare select modes:

```
node mode.ts info default minimal maximum
```

### Mode Testing

You can test modes using the `mode.ts test` command. This will run the simulated application with the given mode then execute 10 async requests simultaneously and display metrics.

Test a single mode:

```
node mode.ts test default
```

Test multiple modes:

```
node mode.ts test default minimal maximum
```