// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  type FunCityBlockNode,
  type FunCityLogEntry,
  type FunCityReducerExecutor,
} from './types';
import {
  createDCodegen,
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
const sharedClosureDCodegen = createDCodegen({ backend: 'closure' });
const compiledScriptCache = new Map<string, FunCityCompiledScript>();

const toCompilationCacheKey = (
  script: string,
  sourceId: string,
  mode: FunCityCompileMode
) => `${mode}\u0000${sourceId}\u0000${script}`;

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
 * @returns Reducer executor.
 */
export const createSharedDCodegenExecutor = (): FunCityReducerExecutor => {
  return sharedSourceDCodegen.createExecutor();
};

/**
 * Compile a script with cache.
 * @param script - Source text.
 * @param sourceId - Source identifier.
 * @param mode - Parse mode.
 * @returns Cached compilation result.
 */
export const compileScriptCached = (
  script: string,
  sourceId: string,
  mode: FunCityCompileMode
): FunCityCompiledScript => {
  const cacheKey = toCompilationCacheKey(script, sourceId, mode);
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

  const compiled: FunCityCompiledScript = {
    sourceId,
    mode,
    nodes,
    logs: logs.slice(),
    program: sharedSourceDCodegen.generateProgram(nodes),
    textProgram: sharedClosureDCodegen.generateTextProgram(nodes),
  };
  setCompiledScriptCache(cacheKey, compiled);
  return compiled;
};
