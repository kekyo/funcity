// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

//////////////////////////////////////////////////////////////////////////////

/**
 * Built-in object variables.
 */
export const objectVariables = Object.freeze({
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Function: Function,
  Math: Math,
  Date: Date,
} as const);
