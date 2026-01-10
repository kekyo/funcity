// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  FunCityErrorInfo,
  FunCityVariables,
  convertToString,
} from './utils';
import { runTokenizer } from './tokenizer';
import { runParser } from './parser';
import { runReducer } from './reducer';

//////////////////////////////////////////////////////////////////////////////

/**
 * Simply runs a script once.
 * @param script Input script text.
 * @param variables - Predefined variables
 * @param errors - Will be stored detected warnings/errors into it
 * @param signal - Abort signal
 * @returns Result text
 */
export const runScriptOnce = async (
  script: string,
  variables: FunCityVariables,
  errors: FunCityErrorInfo[] = [],
  signal?: AbortSignal
): Promise<string> => {
  const blocks = runTokenizer(script, errors);
  const nodes = runParser(blocks, errors);
  const results = await runReducer(nodes, variables, errors, signal);
  const text = results.map((result) => convertToString(result)).join('');
  return text;
};
