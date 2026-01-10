// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { FunCityErrorInfo, FunCityVariables } from './scripting';
import { runTokenizer } from './tokenizer';
import { runParser } from './parser';
import { runReducer } from './reducer';

export * from './scripting';
export * from './tokenizer';
export * from './parser';
export * from './reducer';
export * from './standards';

//////////////////////////////////////////////////////////////////////////////

/**
 * Simply runs a script once.
 * @param script Input script text.
 * @param variables - Predefined variables
 * @param errors - Will be stored detected warnings/errors into it
 * @returns
 */
export const runScriptOnce = async (
  script: string,
  variables: FunCityVariables,
  errors: FunCityErrorInfo[] = []
): Promise<string> => {
  const blocks = runTokenizer(script, errors);
  const nodes = runParser(blocks, errors);
  const results = await runReducer(nodes, variables, errors);
  const text: string = results.join('');
  return text;
};
