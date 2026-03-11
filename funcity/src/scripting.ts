// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  FunCityOnceRunnerProps,
  FunCityReducerError,
  FunCityWarningEntry,
} from './types';
import { runTokenizer } from './tokenizer';
import { runParser } from './parser';
import { createReducerContext } from './reducer';
import { createDCodegen } from './dcodegen';
import { buildCandidateVariables } from './variables/standard-variables';

//////////////////////////////////////////////////////////////////////////////

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
  const { variables = buildCandidateVariables(), logs = [], sourceId } = props;

  const tokens = runTokenizer(script, logs, sourceId);
  const nodes = runParser(tokens, logs);
  if (logs.length >= 1) {
    return [];
  }

  const warningLogs: FunCityWarningEntry[] = [];
  const dcodegen = createDCodegen();
  const reducerContext = createReducerContext(
    variables,
    warningLogs,
    dcodegen.createExecutor()
  );
  const generator = dcodegen.generateProgram(nodes);
  try {
    const resultList = await generator(reducerContext, signal);
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
  const { variables = buildCandidateVariables(), logs = [], sourceId } = props;

  const tokens = runTokenizer(script, logs, sourceId);
  const nodes = runParser(tokens, logs);
  if (logs.length >= 1) {
    return undefined;
  }

  const warningLogs: FunCityWarningEntry[] = [];
  const dcodegen = createDCodegen();
  const reducerContext = createReducerContext(
    variables,
    warningLogs,
    dcodegen.createExecutor()
  );
  const generator = dcodegen.generateTextProgram(nodes);
  try {
    const text = await generator(reducerContext, signal);
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
