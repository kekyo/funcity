// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { performance } from 'node:perf_hooks';

import {
  buildCandidateVariables,
  createDCodegen,
  createReducerContext,
  parseExpressions,
  runCodeTokenizer,
  runReducer,
} from '../dist/index.mjs';

////////////////////////////////////////////////////////////////////////////////

const source = `set fib (fun n (cond (le n 1) n (add (fib (sub n 1)) (fib (sub n 2)))))
fib 20`;

const parseIntegerArgument = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
};

const iterations = parseIntegerArgument(process.argv[2], 12);
const warmups = parseIntegerArgument(process.argv[3], 2);

const parseBenchmarkNodes = () => {
  const logs = [];
  const tokens = runCodeTokenizer(source, logs, '<benchmark>');
  const nodes = parseExpressions(tokens, logs);
  if (logs.some((log) => log.type === 'error')) {
    throw new Error(
      `benchmark source could not be parsed: ${logs
        .map((log) => log.description)
        .join('; ')}`
    );
  }
  return nodes;
};

const nodes = parseBenchmarkNodes();

const createReducerRunner = () => {
  return async () => {
    return await runReducer(nodes, buildCandidateVariables(), []);
  };
};

const createGeneratedRunner = (backend) => {
  const dcodegen = createDCodegen({ backend });
  const generator = dcodegen.generateProgram(nodes);
  const executor = dcodegen.createExecutor();

  return async () => {
    const reducerContext = createReducerContext(
      buildCandidateVariables(),
      [],
      executor
    );
    return await generator(reducerContext);
  };
};

const benchmark = async (name, run) => {
  let lastResult = undefined;
  for (let index = 0; index < warmups; index++) {
    lastResult = await run();
  }

  const startedAt = performance.now();
  for (let index = 0; index < iterations; index++) {
    lastResult = await run();
  }
  const elapsedMs = performance.now() - startedAt;
  return {
    name,
    elapsedMs,
    result: lastResult,
  };
};

const reducer = await benchmark('reducer', createReducerRunner());
const closure = await benchmark(
  'jit-closure',
  createGeneratedRunner('closure')
);
const sourceRunner = await benchmark(
  'jit-source',
  createGeneratedRunner('source')
);

const reducerResultJson = JSON.stringify(reducer.result);
for (const benchmarkResult of [closure, sourceRunner]) {
  if (JSON.stringify(benchmarkResult.result) !== reducerResultJson) {
    throw new Error(
      `benchmark result mismatch: ${benchmarkResult.name} != reducer`
    );
  }
}

const results = [reducer, closure, sourceRunner].map((benchmarkResult) => ({
  name: benchmarkResult.name,
  elapsedMs: Number(benchmarkResult.elapsedMs.toFixed(3)),
  speedupVsReducer: Number(
    (reducer.elapsedMs / benchmarkResult.elapsedMs).toFixed(3)
  ),
}));

console.log(
  JSON.stringify(
    {
      iterations,
      warmups,
      source,
      result: reducer.result,
      benchmarks: results,
    },
    undefined,
    2
  )
);
