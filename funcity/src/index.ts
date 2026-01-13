// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

export * from './types';
export * from './tokenizer';
export * from './parser';
export * from './reducer';
export * from './scripting';
export * from './standard-variables';
export * from './nodejs-variables';

export {
  emptyLocation,
  emptyRange,
  outputErrors,
  makeFunCityFunction,
  isFunCityFunction,
  isConditionalTrue,
  combineVariables,
  convertToString,
} from './utils';
