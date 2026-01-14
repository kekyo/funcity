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
import { createReducerContext, reduceNode } from './reducer';
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
  const { variables = buildCandidateVariables(), logs = [] } = props;

  const tokens = runTokenizer(script, logs);
  const nodes = runParser(tokens, logs);
  if (logs.length >= 1) {
    return [];
  }

  const warningLogs: FunCityWarningEntry[] = [];
  const reducerContext = createReducerContext(variables, warningLogs);
  const resultList: unknown[] = [];
  try {
    for (const node of nodes) {
      const results = await reduceNode(reducerContext, node, signal);
      for (const result of results) {
        if (result !== undefined) {
          resultList.push(result);
        }
      }
    }
  } catch (error: unknown) {
    logs.push(...warningLogs);
    if (error instanceof FunCityReducerError) {
      logs.push(error.info);
      return [];
    }
    throw error;
  }

  logs.push(...warningLogs);
  return resultList;
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
  const { variables = buildCandidateVariables(), logs = [] } = props;

  const tokens = runTokenizer(script, logs);
  const nodes = runParser(tokens, logs);
  if (logs.length >= 1) {
    return undefined;
  }

  const warningLogs: FunCityWarningEntry[] = [];
  const reducerContext = createReducerContext(variables, warningLogs);
  const resultList: unknown[] = [];
  try {
    for (const node of nodes) {
      const results = await reduceNode(reducerContext, node, signal);
      for (const result of results) {
        if (result !== undefined) {
          resultList.push(result);
        }
      }
    }
  } catch (error: unknown) {
    logs.push(...warningLogs);
    if (error instanceof FunCityReducerError) {
      logs.push(error.info);
      return undefined;
    }
    throw error;
  }

  logs.push(...warningLogs);
  const text = resultList
    .map((result) => reducerContext.convertToString(result))
    .join('');
  return text;
};
