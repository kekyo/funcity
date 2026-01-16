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
  Function: Function,
  Array: Array,
  String: String,
  Number: Number,
  BigInt: BigInt,
  Boolean: Boolean,
  Symbol: Symbol,
  Math: Math,
  ArrayBuffer: ArrayBuffer,
  Date: Date,
  Intl: Intl,
  JSON: JSON,
  Map: Map,
  Set: Set,
  Promise: Promise,
  RegExp: RegExp,
  WeakMap: WeakMap,
  WeakSet: WeakSet,
  Reflect: Reflect,
  Error: Error,
} as const);
