// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { FunCityOnceRunnerProps, FunCityReducerError } from './types';
import { runTokenizer } from './tokenizer';
import { runParser } from './parser';
import { createReducerContext, reduceNode } from './reducer';
import { buildCandidateVariables } from './standard-variables';

//////////////////////////////////////////////////////////////////////////////

/**
 * Simply runs a script once.
 * @param script Input script text.
 * @param props - Runner properties.
 * @returns Result text when reducer is completed
 */
export const runScriptOnce = async (
  script: string,
  props: FunCityOnceRunnerProps
): Promise<unknown[]> => {
  const { variables = buildCandidateVariables(), errors = [], signal } = props;

  const tokens = runTokenizer(script, errors);
  const nodes = runParser(tokens, errors);
  if (errors.length >= 1) {
    return [];
  }

  const reducerContext = createReducerContext(variables, signal);
  const resultList: unknown[] = [];
  try {
    for (const node of nodes) {
      const results = await reduceNode(reducerContext, node);
      for (const result of results) {
        if (result !== undefined) {
          resultList.push(result);
        }
      }
    }
  } catch (error: unknown) {
    if (error instanceof FunCityReducerError) {
      errors.push(error.info);
      return [];
    }
    throw error;
  }

  return resultList;
};

/**
 * Simply runs a script once.
 * @param script Input script text.
 * @param props - Runner properties.
 * @returns Result text when reducer is completed
 */
export const runScriptOnceToText = async (
  script: string,
  props: FunCityOnceRunnerProps
): Promise<string | undefined> => {
  const { variables = buildCandidateVariables(), errors = [], signal } = props;

  const tokens = runTokenizer(script, errors);
  const nodes = runParser(tokens, errors);
  if (errors.length >= 1) {
    return undefined;
  }

  const reducerContext = createReducerContext(variables, signal);
  const resultList: unknown[] = [];
  try {
    for (const node of nodes) {
      const results = await reduceNode(reducerContext, node);
      for (const result of results) {
        if (result !== undefined) {
          resultList.push(result);
        }
      }
    }
  } catch (error: unknown) {
    if (error instanceof FunCityReducerError) {
      errors.push(error.info);
      return undefined;
    }
    throw error;
  }

  const text = resultList
    .map((result) => reducerContext.convertToString(result))
    .join('');
  return text;
};
