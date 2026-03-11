// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  FunCityExecutionBackend,
  FunCityOnceRunnerProps,
  FunCityReducerError,
  FunCityWarningEntry,
} from './types';
import { createReducerContext } from './reducer';
import {
  compileScriptCached,
  createSharedDCodegenExecutor,
} from './compile-cache';
import { buildCandidateVariables } from './variables/standard-variables';

//////////////////////////////////////////////////////////////////////////////

const resolveExecutionBackend = (
  backend: FunCityExecutionBackend | undefined
): FunCityExecutionBackend => backend ?? 'source';

/**
 * Simply runs a script once.
 * @param script Input script text.
 * @param props - Runner properties.
 * @param signal - AbortSignal when available.
 * @returns Result text when reducer is completed
 */
export const runScriptOnce = async (
  script: string,
  props: FunCityOnceRunnerProps,
  signal?: AbortSignal
): Promise<unknown[]> => {
  const {
    variables = buildCandidateVariables(),
    backend,
    aggressiveOptimize,
    logs = [],
    sourceId,
  } = props;
  const executionBackend = resolveExecutionBackend(backend);

  const compiled = compileScriptCached(
    script,
    sourceId,
    'template',
    executionBackend,
    aggressiveOptimize
  );
  logs.push(...compiled.logs);
  if (compiled.logs.length >= 1) {
    return [];
  }

  const warningLogs: FunCityWarningEntry[] = [];
  const reducerContext = createReducerContext(
    variables,
    warningLogs,
    executionBackend === 'reducer'
      ? undefined
      : createSharedDCodegenExecutor(executionBackend, aggressiveOptimize)
  );
  try {
    const resultList = await compiled.program(reducerContext, signal);
    logs.push(...warningLogs);
    return resultList;
  } catch (error: unknown) {
    logs.push(...warningLogs);
    if (error instanceof FunCityReducerError) {
      logs.push(error.info);
      return [];
    }
    throw error;
  }
};

/**
 * Simply runs a script once.
 * @param script Input script text.
 * @param props - Runner properties.
 * @param signal - AbortSignal when available.
 * @returns Result text when reducer is completed
 */
export const runScriptOnceToText = async (
  script: string,
  props: FunCityOnceRunnerProps,
  signal?: AbortSignal
): Promise<string | undefined> => {
  const {
    variables = buildCandidateVariables(),
    backend,
    aggressiveOptimize,
    logs = [],
    sourceId,
  } = props;
  const executionBackend = resolveExecutionBackend(backend);

  const compiled = compileScriptCached(
    script,
    sourceId,
    'template',
    executionBackend,
    aggressiveOptimize
  );
  logs.push(...compiled.logs);
  if (compiled.logs.length >= 1) {
    return undefined;
  }

  const warningLogs: FunCityWarningEntry[] = [];
  const reducerContext = createReducerContext(
    variables,
    warningLogs,
    executionBackend === 'reducer'
      ? undefined
      : createSharedDCodegenExecutor(executionBackend, aggressiveOptimize)
  );
  try {
    const text = await compiled.textProgram(reducerContext, signal);
    logs.push(...warningLogs);
    return text;
  } catch (error: unknown) {
    logs.push(...warningLogs);
    if (error instanceof FunCityReducerError) {
      logs.push(error.info);
      return undefined;
    }
    throw error;
  }
};
