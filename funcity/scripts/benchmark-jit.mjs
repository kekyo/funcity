// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import {
  buildCandidateVariables,
  createDCodegen,
  createReducerContext,
  parseExpressions,
  runCodeTokenizer,
  runParser,
  runReducer,
  runScriptOnceToText,
  runTokenizer,
} from '../dist/index.mjs';

////////////////////////////////////////////////////////////////////////////////

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRootDir = resolve(scriptDir, '../..');
const defaultResultsRootDir = resolve(repoRootDir, 'test-results');

const parseIntegerArgument = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
};

const formatRunId = (date) => {
  const pad = (value, length) => value.toString().padStart(length, '0');
  return [
    `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1, 2)}${pad(
      date.getDate(),
      2
    )}`,
    `${pad(date.getHours(), 2)}${pad(date.getMinutes(), 2)}${pad(
      date.getSeconds(),
      2
    )}`,
    pad(date.getMilliseconds(), 3),
  ].join('_');
};

const parseArguments = (argv) => {
  const options = {
    profile: 'default',
    resultsRootDir:
      process.env.FUNCITY_BENCHMARK_RESULTS_DIR ?? defaultResultsRootDir,
    iterationScale: 1,
    warmupScale: 1,
  };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    switch (argument) {
      case '--profile': {
        options.profile = argv[index + 1] ?? options.profile;
        index++;
        break;
      }
      case '--results-root': {
        options.resultsRootDir = resolve(
          repoRootDir,
          argv[index + 1] ?? options.resultsRootDir
        );
        index++;
        break;
      }
      default: {
        if (index === 0) {
          options.iterationScale = parseIntegerArgument(argument, 1);
        } else if (index === 1) {
          options.warmupScale = parseIntegerArgument(argument, 1);
        }
        break;
      }
    }
  }

  return options;
};

const options = parseArguments(process.argv.slice(2));

const profiles = {
  default: [
    {
      name: 'fib-recursive-code',
      mode: 'code',
      output: 'program',
      iterations: 12,
      warmups: 2,
      source: `set fib (fun n (cond (le n 1) n (add (fib (sub n 1)) (fib (sub n 2)))))
fib 20`,
    },
    {
      name: 'collection-pipeline-code',
      mode: 'code',
      output: 'program',
      iterations: 30,
      warmups: 3,
      source: `reduce 0 (fun [acc v] (add acc v)) (map (fun [x] (mul x x)) (range 1 260))`,
    },
    {
      name: 'template-loop-render',
      mode: 'template',
      output: 'text',
      iterations: 20,
      warmups: 3,
      source: `Report: {{for i (range 1 420)}}{{if (eq (mod i 15) 0)}}FizzBuzz{{elseif (eq (mod i 3) 0)}}Fizz{{elseif (eq (mod i 5) 0)}}Buzz{{else}}{{i}}{{end}},{{end}}`,
    },
    {
      name: 'template-list-transform',
      mode: 'template',
      output: 'text',
      iterations: 20,
      warmups: 3,
      source: `{{set values (map (fun [x] (mul x 10)) (range 1 260))}}{{for value values}}{{value}};{{end}}`,
    },
  ],
  smoke: [
    {
      name: 'fib-recursive-code',
      mode: 'code',
      output: 'program',
      iterations: 1,
      warmups: 1,
      source: `set fib (fun n (cond (le n 1) n (add (fib (sub n 1)) (fib (sub n 2)))))
fib 12`,
    },
    {
      name: 'collection-pipeline-code',
      mode: 'code',
      output: 'program',
      iterations: 1,
      warmups: 1,
      source: `reduce 0 (fun [acc v] (add acc v)) (map (fun [x] (mul x x)) (range 1 80))`,
    },
    {
      name: 'template-loop-render',
      mode: 'template',
      output: 'text',
      iterations: 1,
      warmups: 1,
      source: `Report: {{for i (range 1 80)}}{{if (eq (mod i 3) 0)}}Fizz{{else}}{{i}}{{end}},{{end}}`,
    },
    {
      name: 'template-list-transform',
      mode: 'template',
      output: 'text',
      iterations: 1,
      warmups: 1,
      source: `{{set values (map (fun [x] (mul x 10)) (range 1 80))}}{{for value values}}{{value}};{{end}}`,
    },
  ],
};

const runtimeComparisonProfiles = {
  default: [
    {
      name: 'fib30-runtime-overhead',
      iterations: 1,
      warmups: 0,
      source: `{{set fib (fun n (cond (le n 1) n (add (fib (sub n 1)) (fib (sub n 2)))))}}{{fib 30}}`,
      nativeSource: `const fib = (n) => (n <= 1 ? n : fib(n - 1) + fib(n - 2)); fib(30);`,
      nativeInput: 30,
    },
  ],
  smoke: [
    {
      name: 'fib30-runtime-overhead',
      iterations: 1,
      warmups: 0,
      source: `{{set fib (fun n (cond (le n 1) n (add (fib (sub n 1)) (fib (sub n 2)))))}}{{fib 18}}`,
      nativeSource: `const fib = (n) => (n <= 1 ? n : fib(n - 1) + fib(n - 2)); fib(18);`,
      nativeInput: 18,
    },
  ],
};

const scenarios = (profiles[options.profile] ?? profiles.default).map(
  (scenario) => ({
    ...scenario,
    iterations: scenario.iterations * options.iterationScale,
    warmups: scenario.warmups * options.warmupScale,
  })
);

const runtimeComparisons = (
  runtimeComparisonProfiles[options.profile] ??
  runtimeComparisonProfiles.default
).map((scenario) => ({
  ...scenario,
  iterations: scenario.iterations * options.iterationScale,
  warmups: scenario.warmups * options.warmupScale,
}));

const parseScenario = (scenario) => {
  const logs = [];
  const startedAt = performance.now();
  const tokens =
    scenario.mode === 'code'
      ? runCodeTokenizer(scenario.source, logs, `<benchmark:${scenario.name}>`)
      : runTokenizer(scenario.source, logs, `<benchmark:${scenario.name}>`);
  const nodes =
    scenario.mode === 'code'
      ? parseExpressions(tokens, logs)
      : runParser(tokens, logs);
  const elapsedMs = performance.now() - startedAt;
  if (logs.some((log) => log.type === 'error')) {
    throw new Error(
      `benchmark source could not be parsed (${scenario.name}): ${logs
        .map((log) => log.description)
        .join('; ')}`
    );
  }
  return {
    nodes,
    parseElapsedMs: Number(elapsedMs.toFixed(3)),
  };
};

const benchmark = async (iterations, warmups, run) => {
  let lastResult = undefined;
  for (let index = 0; index < warmups; index++) {
    lastResult = await run();
  }
  const startedAt = performance.now();
  for (let index = 0; index < iterations; index++) {
    lastResult = await run();
  }
  return {
    elapsedMs: Number((performance.now() - startedAt).toFixed(3)),
    result: lastResult,
  };
};

const runNativeRecursiveFib = (input) => {
  const fib = (n) => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
  return fib(input);
};

const createNativeFibRunner = (scenario) => {
  return {
    compileElapsedMs: 0,
    run: async () => runNativeRecursiveFib(scenario.nativeInput),
  };
};

const createApiRunner = (backend, scenario) => {
  return {
    compileElapsedMs: 0,
    run: async () => {
      return await runScriptOnceToText(scenario.source, {
        backend,
        sourceId: `${scenario.name}.${backend}.fc`,
      });
    },
  };
};

const runRuntimeComparison = async (scenario) => {
  const nativeRunner = createNativeFibRunner(scenario);
  const closureRunner = createApiRunner('closure', scenario);
  const sourceRunner = createApiRunner('source', scenario);
  const selectedRunner = createApiRunner('source', scenario);

  const nativeResult = await benchmark(
    scenario.iterations,
    scenario.warmups,
    nativeRunner.run
  );
  const closureResult = await benchmark(
    scenario.iterations,
    scenario.warmups,
    closureRunner.run
  );
  const sourceResult = await benchmark(
    scenario.iterations,
    scenario.warmups,
    sourceRunner.run
  );
  const selectedResult = await benchmark(
    scenario.iterations,
    scenario.warmups,
    selectedRunner.run
  );

  const sourceResultJson = stringifyResult(sourceResult.result);
  for (const benchmarkResult of [closureResult, selectedResult]) {
    if (stringifyResult(benchmarkResult.result) !== sourceResultJson) {
      throw new Error(`benchmark result mismatch: ${scenario.name}`);
    }
  }

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    warmups: scenario.warmups,
    source: scenario.source,
    nativeSource: scenario.nativeSource,
    result: sourceResult.result,
    benchmarks: [
      {
        name: 'native-node',
        compileElapsedMs: nativeRunner.compileElapsedMs,
        elapsedMs: nativeResult.elapsedMs,
        relativeToNative: 1,
      },
      {
        name: 'jit-closure',
        compileElapsedMs: closureRunner.compileElapsedMs,
        elapsedMs: closureResult.elapsedMs,
        relativeToNative: Number(
          (closureResult.elapsedMs / nativeResult.elapsedMs).toFixed(3)
        ),
      },
      {
        name: 'jit-source',
        compileElapsedMs: sourceRunner.compileElapsedMs,
        elapsedMs: sourceResult.elapsedMs,
        relativeToNative: Number(
          (sourceResult.elapsedMs / nativeResult.elapsedMs).toFixed(3)
        ),
      },
      {
        name: 'jit-selected',
        backend: 'source',
        compileElapsedMs: selectedRunner.compileElapsedMs,
        elapsedMs: selectedResult.elapsedMs,
        relativeToNative: Number(
          (selectedResult.elapsedMs / nativeResult.elapsedMs).toFixed(3)
        ),
      },
    ],
  };
};

const createReducerProgramRunner = (nodes) => {
  return async () => {
    return await runReducer(nodes, buildCandidateVariables(), []);
  };
};

const createReducerTextRunner = (nodes) => {
  return async () => {
    const warningLogs = [];
    const variables = buildCandidateVariables();
    const reducerContext = createReducerContext(variables, warningLogs);
    const result = await runReducer(nodes, variables, warningLogs);
    return result
      .map((value) => reducerContext.convertToString(value))
      .join('');
  };
};

const createGeneratedRunner = (backend, scenario, nodes) => {
  const startedAt = performance.now();
  const dcodegen = createDCodegen({ backend });
  const executor = dcodegen.createExecutor();
  const generator =
    scenario.output === 'text'
      ? dcodegen.generateTextProgram(nodes)
      : dcodegen.generateProgram(nodes);
  const compileElapsedMs = Number((performance.now() - startedAt).toFixed(3));

  return {
    compileElapsedMs,
    run: async () => {
      const reducerContext = createReducerContext(
        buildCandidateVariables(),
        [],
        executor
      );
      return await generator(reducerContext);
    },
  };
};

const createSelectedRunner = (scenario, nodes) => {
  const backend = 'source';
  const generated = createGeneratedRunner(backend, scenario, nodes);
  return {
    name: 'jit-selected',
    backend,
    ...generated,
  };
};

const stringifyResult = (result) => JSON.stringify(result);

const runScenario = async (scenario) => {
  const { nodes, parseElapsedMs } = parseScenario(scenario);

  const reducerRunner =
    scenario.output === 'text'
      ? createReducerTextRunner(nodes)
      : createReducerProgramRunner(nodes);
  const closure = createGeneratedRunner('closure', scenario, nodes);
  const sourceRunner = createGeneratedRunner('source', scenario, nodes);
  const selectedRunner = createSelectedRunner(scenario, nodes);

  const reducer = await benchmark(
    scenario.iterations,
    scenario.warmups,
    reducerRunner
  );
  const closureResult = await benchmark(
    scenario.iterations,
    scenario.warmups,
    closure.run
  );
  const sourceResult = await benchmark(
    scenario.iterations,
    scenario.warmups,
    sourceRunner.run
  );
  const selectedResult = await benchmark(
    scenario.iterations,
    scenario.warmups,
    selectedRunner.run
  );

  const reducerResultJson = stringifyResult(reducer.result);
  for (const benchmarkResult of [closureResult, sourceResult, selectedResult]) {
    if (stringifyResult(benchmarkResult.result) !== reducerResultJson) {
      throw new Error(`benchmark result mismatch: ${scenario.name}`);
    }
  }

  return {
    name: scenario.name,
    mode: scenario.mode,
    output: scenario.output,
    iterations: scenario.iterations,
    warmups: scenario.warmups,
    parseElapsedMs,
    source: scenario.source,
    result: reducer.result,
    benchmarks: [
      {
        name: 'reducer',
        compileElapsedMs: 0,
        elapsedMs: reducer.elapsedMs,
        speedupVsReducer: 1,
      },
      {
        name: 'jit-closure',
        compileElapsedMs: closure.compileElapsedMs,
        elapsedMs: closureResult.elapsedMs,
        speedupVsReducer: Number(
          (reducer.elapsedMs / closureResult.elapsedMs).toFixed(3)
        ),
      },
      {
        name: 'jit-source',
        compileElapsedMs: sourceRunner.compileElapsedMs,
        elapsedMs: sourceResult.elapsedMs,
        speedupVsReducer: Number(
          (reducer.elapsedMs / sourceResult.elapsedMs).toFixed(3)
        ),
      },
      {
        name: selectedRunner.name,
        backend: selectedRunner.backend,
        compileElapsedMs: selectedRunner.compileElapsedMs,
        elapsedMs: selectedResult.elapsedMs,
        speedupVsReducer: Number(
          (reducer.elapsedMs / selectedResult.elapsedMs).toFixed(3)
        ),
      },
    ],
  };
};

const tryGetGitHead = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRootDir,
      encoding: 'utf8',
    }).trim();
  } catch {
    return undefined;
  }
};

const findPreviousSummary = async (resultsRootDir, currentRunId) => {
  if (!existsSync(resultsRootDir)) {
    return undefined;
  }

  const entries = await readdir(resultsRootDir, { withFileTypes: true });
  const previousRunId = entries
    .filter((entry) => entry.isDirectory() && entry.name < currentRunId)
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  if (!previousRunId) {
    return undefined;
  }

  const summaryPath = resolve(resultsRootDir, previousRunId, 'summary.json');
  if (!existsSync(summaryPath)) {
    return undefined;
  }

  return {
    runId: previousRunId,
    summary: JSON.parse(await readFile(summaryPath, 'utf8')),
  };
};

const createComparison = (summary, previous) => {
  if (!previous) {
    return undefined;
  }

  const previousScenarios = new Map(
    previous.summary.scenarios.map((scenario) => [scenario.name, scenario])
  );
  const scenarioComparisons = [];

  for (const scenario of summary.scenarios) {
    const previousScenario = previousScenarios.get(scenario.name);
    if (!previousScenario) {
      continue;
    }

    const previousBenchmarks = new Map(
      previousScenario.benchmarks.map((benchmarkResult) => [
        benchmarkResult.name,
        benchmarkResult,
      ])
    );
    const benchmarks = scenario.benchmarks
      .map((benchmarkResult) => {
        const previousBenchmark = previousBenchmarks.get(benchmarkResult.name);
        if (!previousBenchmark) {
          return undefined;
        }
        return {
          name: benchmarkResult.name,
          previousElapsedMs: previousBenchmark.elapsedMs,
          currentElapsedMs: benchmarkResult.elapsedMs,
          elapsedDeltaMs: Number(
            (benchmarkResult.elapsedMs - previousBenchmark.elapsedMs).toFixed(3)
          ),
          elapsedRatio: Number(
            (benchmarkResult.elapsedMs / previousBenchmark.elapsedMs).toFixed(3)
          ),
        };
      })
      .filter((benchmarkResult) => benchmarkResult !== undefined);
    scenarioComparisons.push({
      name: scenario.name,
      benchmarks,
    });
  }

  return {
    previousRunId: previous.runId,
    scenarios: scenarioComparisons,
  };
};

const buildMarkdown = (summary) => {
  const lines = [
    '# JIT Benchmark Summary',
    '',
    `- Run ID: \`${summary.runId}\``,
    `- Profile: \`${summary.profile}\``,
    `- Git HEAD: \`${summary.gitHead ?? 'unknown'}\``,
    `- Node.js: \`${summary.nodeVersion}\``,
    '',
  ];

  if (summary.comparison) {
    lines.push(
      `- Previous run: \`${summary.comparison.previousRunId}\``,
      '',
      '## Comparison',
      ''
    );
    for (const scenario of summary.comparison.scenarios) {
      lines.push(
        `### ${scenario.name}`,
        '',
        '| Runner | Prev ms | Current ms | Delta ms | Ratio |',
        '| --- | ---: | ---: | ---: | ---: |'
      );
      for (const benchmarkResult of scenario.benchmarks) {
        lines.push(
          `| ${benchmarkResult.name} | ${benchmarkResult.previousElapsedMs} | ${benchmarkResult.currentElapsedMs} | ${benchmarkResult.elapsedDeltaMs} | ${benchmarkResult.elapsedRatio} |`
        );
      }
      lines.push('');
    }
  }

  if ((summary.runtimeComparisons?.length ?? 0) >= 1) {
    lines.push('## Runtime Comparisons', '');
    for (const comparison of summary.runtimeComparisons) {
      lines.push(
        `### ${comparison.name}`,
        '',
        `- Iterations: \`${comparison.iterations}\``,
        `- Warmups: \`${comparison.warmups}\``,
        '',
        '| Runner | Compile ms | Elapsed ms | Relative to native |',
        '| --- | ---: | ---: | ---: |'
      );
      for (const benchmarkResult of comparison.benchmarks) {
        lines.push(
          `| ${benchmarkResult.name} | ${benchmarkResult.compileElapsedMs} | ${benchmarkResult.elapsedMs} | ${benchmarkResult.relativeToNative} |`
        );
      }
      lines.push(
        '',
        '```funcity',
        comparison.source,
        '```',
        '',
        '```js',
        comparison.nativeSource,
        '```',
        ''
      );
    }
  }

  lines.push('## Scenarios', '');
  for (const scenario of summary.scenarios) {
    lines.push(
      `### ${scenario.name}`,
      '',
      `- Mode: \`${scenario.mode}\``,
      `- Output: \`${scenario.output}\``,
      `- Iterations: \`${scenario.iterations}\``,
      `- Warmups: \`${scenario.warmups}\``,
      `- Parse ms: \`${scenario.parseElapsedMs}\``,
      '',
      '| Runner | Compile ms | Elapsed ms | Speedup vs reducer |',
      '| --- | ---: | ---: | ---: |'
    );
    for (const benchmarkResult of scenario.benchmarks) {
      lines.push(
        `| ${benchmarkResult.name} | ${benchmarkResult.compileElapsedMs} | ${benchmarkResult.elapsedMs} | ${benchmarkResult.speedupVsReducer} |`
      );
    }
    lines.push('', '```funcity', scenario.source, '```', '');
  }

  return lines.join('\n');
};

const startedAt = new Date();
const runId = formatRunId(startedAt);
const outputDir = resolve(options.resultsRootDir, runId);

await mkdir(outputDir, { recursive: true });

const scenariosResult = [];
for (const scenario of scenarios) {
  scenariosResult.push(await runScenario(scenario));
}

const runtimeComparisonResults = [];
for (const comparison of runtimeComparisons) {
  runtimeComparisonResults.push(await runRuntimeComparison(comparison));
}

const summary = {
  runId,
  createdAt: startedAt.toISOString(),
  profile: options.profile,
  resultsRootDir: options.resultsRootDir,
  outputDir,
  gitHead: tryGetGitHead(),
  nodeVersion: process.version,
  runtimeComparisons: runtimeComparisonResults,
  scenarios: scenariosResult,
};

const previous = await findPreviousSummary(options.resultsRootDir, runId);
summary.comparison = createComparison(summary, previous);

await writeFile(
  resolve(outputDir, 'summary.json'),
  JSON.stringify(summary, undefined, 2)
);
await writeFile(resolve(outputDir, 'summary.md'), buildMarkdown(summary));

console.log(
  JSON.stringify(
    {
      outputDir,
      runId,
      profile: options.profile,
      comparisonPreviousRunId: summary.comparison?.previousRunId,
      runtimeComparisons: summary.runtimeComparisons,
      scenarios: summary.scenarios.map((scenario) => ({
        name: scenario.name,
        parseElapsedMs: scenario.parseElapsedMs,
        benchmarks: scenario.benchmarks,
      })),
    },
    undefined,
    2
  )
);
