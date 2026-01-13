// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import type { FunCityOnceRunnerProps } from './types';
import { runTokenizer } from './tokenizer';
import { runParser } from './parser';
import { createReducerContext, reduceNode } from './reducer';
import { buildCandidateVariables } from './standards';

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

  const reducerContext = createReducerContext(variables, errors, signal);
  const resultList: unknown[] = [];
  for (const node of nodes) {
    const results = await reduceNode(reducerContext, node);
    for (const result of results) {
      if (result !== undefined) {
        resultList.push(result);
      }
    }
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

  const reducerContext = createReducerContext(variables, errors, signal);
  const resultList: unknown[] = [];
  for (const node of nodes) {
    const results = await reduceNode(reducerContext, node);
    for (const result of results) {
      if (result !== undefined) {
        resultList.push(result);
      }
    }
  }

  const text = resultList
    .map((result) => reducerContext.convertToString(result))
    .join('');
  return text;
};
