// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  type FunCityBlockNode,
  type FunCityExecutionBackend,
  type FunCityLogEntry,
  type FunCityReducerContext,
  type FunCityReducerExecutor,
} from './types';
import {
  createDCodegen,
  type FunCityDynamicCodeGeneratorBackend,
  type FunCityGeneratedProgram,
  type FunCityGeneratedTextProgram,
} from './dcodegen';
import { parseExpressions, runParser } from './parser';
import { runCodeTokenizer, runTokenizer } from './tokenizer';

//////////////////////////////////////////////////////////////////////////////

/**
 * Cached compilation mode.
 */
export type FunCityCompileMode = 'template' | 'code';

/**
 * Cached compilation result.
 */
export interface FunCityCompiledScript {
  /**
   * Compiled source identifier.
   */
  readonly sourceId: string;
  /**
   * Compilation mode.
   */
  readonly mode: FunCityCompileMode;
  /**
   * Parsed nodes.
   */
  readonly nodes: readonly FunCityBlockNode[];
  /**
   * Parse logs.
   */
  readonly logs: readonly FunCityLogEntry[];
  /**
   * Compiled program generator.
   */
  readonly program: FunCityGeneratedProgram;
  /**
   * Compiled text generator.
   */
  readonly textProgram: FunCityGeneratedTextProgram;
}

const compilationCacheLimit = 64;
const sharedSourceDCodegen = createDCodegen({ backend: 'source' });
const sharedAggressiveSourceDCodegen = createDCodegen({
  backend: 'source',
  aggressiveOptimize: true,
});
const sharedClosureDCodegen = createDCodegen({ backend: 'closure' });
const compiledScriptCache = new Map<string, FunCityCompiledScript>();
const defaultExecutionBackend: FunCityExecutionBackend = 'source';

const resolveExecutionBackend = (
  backend: FunCityExecutionBackend | undefined
): FunCityExecutionBackend => backend ?? defaultExecutionBackend;

const isDynamicCodegenBackend = (
  backend: FunCityExecutionBackend
): backend is FunCityDynamicCodeGeneratorBackend => backend !== 'reducer';

const resolveAggressiveOptimize = (
  backend: FunCityExecutionBackend,
  aggressiveOptimize: boolean | undefined
): boolean => (backend === 'source' ? (aggressiveOptimize ?? false) : false);

const getSharedDCodegen = (
  backend: FunCityDynamicCodeGeneratorBackend,
  aggressiveOptimize: boolean | undefined
) => {
  if (backend === 'closure') {
    return sharedClosureDCodegen;
  }
  return resolveAggressiveOptimize(backend, aggressiveOptimize)
    ? sharedAggressiveSourceDCodegen
    : sharedSourceDCodegen;
};

const toCompilationCacheKey = (
  script: string,
  sourceId: string,
  mode: FunCityCompileMode,
  backend: FunCityExecutionBackend,
  aggressiveOptimize: boolean
) =>
  `${mode}\u0000${backend}\u0000${aggressiveOptimize ? 'aggr1' : 'aggr0'}\u0000${sourceId}\u0000${script}`;

const setCompiledScriptCache = (
  key: string,
  compiled: FunCityCompiledScript
): void => {
  compiledScriptCache.set(key, compiled);
  if (compiledScriptCache.size <= compilationCacheLimit) {
    return;
  }
  const firstKey = compiledScriptCache.keys().next().value;
  if (firstKey !== undefined) {
    compiledScriptCache.delete(firstKey);
  }
};

/**
 * Create a reducer executor backed by the shared dynamic code generator.
 * @param backend - Dynamic code generator backend.
 * @returns Reducer executor.
 */
export const createSharedDCodegenExecutor = (
  backend?: FunCityDynamicCodeGeneratorBackend,
  aggressiveOptimize?: boolean
): FunCityReducerExecutor => {
  return getSharedDCodegen(
    backend ?? defaultExecutionBackend,
    aggressiveOptimize
  ).createExecutor();
};

const createReducerBackedProgram = (
  nodes: readonly FunCityBlockNode[]
): FunCityGeneratedProgram => {
  return async (
    context: FunCityReducerContext,
    signal?: AbortSignal
  ): Promise<unknown[]> => {
    const resultList: unknown[] = [];
    for (const node of nodes) {
      const results = await context.reduceNode(node, signal);
      for (const result of results) {
        if (result !== undefined) {
          resultList.push(result);
        }
      }
    }
    return resultList;
  };
};

const createReducerBackedTextProgram = (
  nodes: readonly FunCityBlockNode[]
): FunCityGeneratedTextProgram => {
  const reducerProgram = createReducerBackedProgram(nodes);
  return async (
    context: FunCityReducerContext,
    signal?: AbortSignal
  ): Promise<string> => {
    const resultList = await reducerProgram(context, signal);
    return resultList.map((value) => context.convertToString(value)).join('');
  };
};

/**
 * Compile a script with cache.
 * @param script - Source text.
 * @param sourceId - Source identifier.
 * @param mode - Parse mode.
 * @param backend - Execution backend.
 * @returns Cached compilation result.
 */
export const compileScriptCached = (
  script: string,
  sourceId: string,
  mode: FunCityCompileMode,
  backend?: FunCityExecutionBackend,
  aggressiveOptimize?: boolean
): FunCityCompiledScript => {
  const resolvedBackend = resolveExecutionBackend(backend);
  const resolvedAggressiveOptimize = resolveAggressiveOptimize(
    resolvedBackend,
    aggressiveOptimize
  );
  const cacheKey = toCompilationCacheKey(
    script,
    sourceId,
    mode,
    resolvedBackend,
    resolvedAggressiveOptimize
  );
  const cached = compiledScriptCache.get(cacheKey);
  if (cached) {
    compiledScriptCache.delete(cacheKey);
    compiledScriptCache.set(cacheKey, cached);
    return cached;
  }

  const logs: FunCityLogEntry[] = [];
  const tokens =
    mode === 'code'
      ? runCodeTokenizer(script, logs, sourceId)
      : runTokenizer(script, logs, sourceId);
  const nodes =
    mode === 'code' ? parseExpressions(tokens, logs) : runParser(tokens, logs);

  const sharedDCodegen = isDynamicCodegenBackend(resolvedBackend)
    ? getSharedDCodegen(resolvedBackend, resolvedAggressiveOptimize)
    : undefined;
  const compiled: FunCityCompiledScript = {
    sourceId,
    mode,
    nodes,
    logs: logs.slice(),
    program:
      sharedDCodegen?.generateProgram(nodes) ??
      createReducerBackedProgram(nodes),
    textProgram:
      sharedDCodegen?.generateTextProgram(nodes) ??
      createReducerBackedTextProgram(nodes),
  };
  setCompiledScriptCache(cacheKey, compiled);
  return compiled;
};
