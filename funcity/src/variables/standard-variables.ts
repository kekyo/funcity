// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  FunCityExpressionNode,
  FunCityVariables,
  FunCityFunctionContext,
  FunCityVariableNode,
  FunCityReducerError,
} from '../types';
import { reduceExpressionNode } from '../reducer';
import {
  asIterable,
  combineVariables,
  convertToString,
  isConditionalTrue,
  makeFunCityFunction,
} from '../utils';

//////////////////////////////////////////////////////////////////////////////

// `cond` function requires delayed execution both then/else expressions.
const _cond = makeFunCityFunction(async function (
  this: FunCityFunctionContext,
  arg0: FunCityExpressionNode | undefined,
  arg1: FunCityExpressionNode | undefined,
  arg2: FunCityExpressionNode | undefined
) {
  if (!arg0 || !arg1 || !arg2) {
    throw new FunCityReducerError({
      type: 'error',
      description: 'Required `cond` condition, true and false expressions',
      range: this.thisNode.range,
    });
    return undefined;
  }
  const cond = await this.reduce(arg0);
  if (isConditionalTrue(cond)) {
    return await this.reduce(arg1); // Delayed execution when condition is true.
  } else {
    return await this.reduce(arg2); // Delayed execution when condition is false.
  }
});

const _set = makeFunCityFunction(async function (
  this: FunCityFunctionContext,
  arg0: FunCityExpressionNode | undefined,
  arg1: FunCityExpressionNode | undefined,
  ...rest: FunCityExpressionNode[]
) {
  if (!arg0 || !arg1 || rest.length !== 0) {
    throw new FunCityReducerError({
      type: 'error',
      description: 'Required `set` bind identity and expression',
      range: this.thisNode.range,
    });
  }
  if (arg0.kind !== 'variable') {
    throw new FunCityReducerError({
      type: 'error',
      description: 'Required `set` bind identity',
      range: arg0.range,
    });
  }
  const value = await this.reduce(arg1);
  this.setValue(arg0.name, value);
  return undefined;
});

const extractParameterArguments = (
  namesNode: FunCityExpressionNode,
  _context: FunCityFunctionContext
): FunCityVariableNode[] | undefined => {
  switch (namesNode.kind) {
    case 'variable': {
      return [namesNode];
    }
    case 'list': {
      const nameNodes: FunCityVariableNode[] = [];
      let hasError = false;
      for (const nameNode of namesNode.items) {
        if (nameNode.kind !== 'variable') {
          throw new FunCityReducerError({
            type: 'error',
            description: 'Required `fun` parameter identity',
            range: nameNode.range,
          });
          hasError = true;
        } else {
          nameNodes.push(nameNode);
        }
      }
      return hasError ? undefined : nameNodes;
    }
    default: {
      throw new FunCityReducerError({
        type: 'error',
        description: 'Required `fun` parameter identity',
        range: namesNode.range,
      });
      return undefined;
    }
  }
};

const _fun = makeFunCityFunction(async function (
  this: FunCityFunctionContext,
  arg0: FunCityExpressionNode | undefined,
  arg1: FunCityExpressionNode | undefined,
  ...rest: FunCityExpressionNode[]
) {
  if (!arg0 || !arg1 || rest.length !== 0) {
    throw new FunCityReducerError({
      type: 'error',
      description: 'Required `fun` parameter identity and expression',
      range: this.thisNode.range,
    });
  }

  const nameNodes = extractParameterArguments(arg0, this);
  if (!nameNodes) {
    return undefined;
  }

  const bodyNode = arg1;
  const lambdaRange = this.thisNode.range;
  const createScope = this.newScope;

  return async (...args: readonly unknown[]) => {
    if (args.length < nameNodes.length) {
      throw new FunCityReducerError({
        type: 'error',
        description: `Arguments are not filled: ${args.length} < ${nameNodes.length}`,
        range: lambdaRange,
      });
    } else if (args.length > nameNodes.length) {
      this.appendWarning({
        type: 'warning',
        description: `Too many arguments: ${args.length} > ${nameNodes.length}`,
        range: lambdaRange,
      });
    }

    const newContext = createScope();
    for (let index = 0; index < nameNodes.length; index++) {
      newContext.setValue(
        nameNodes[index]!.name,
        args[index],
        this.abortSignal
      );
    }
    const result = await reduceExpressionNode(
      newContext,
      bodyNode,
      this.abortSignal
    );
    return result;
  };
});

const _typeof = async (arg0: unknown) => {
  if (arg0 === null) {
    return 'null';
  } else if (typeof arg0 === 'string') {
    return 'string';
  } else if (Array.isArray(arg0)) {
    return 'array';
  } else if (asIterable(arg0)) {
    return 'iterable';
  } else {
    return typeof arg0;
  }
};

const _toString = async (...args: unknown[]) => {
  const results = args.map((arg0) => convertToString(arg0));
  return results.join(',');
};

const _toBoolean = async (arg0: unknown) => {
  const r = isConditionalTrue(arg0);
  return r;
};

const _toNumber = async (arg0: unknown) => {
  const r = Number(arg0);
  return r;
};

const _toBigInt = async (arg0: unknown) => {
  switch (typeof arg0) {
    case 'number':
    case 'bigint':
    case 'string':
    case 'boolean': {
      const r = BigInt(arg0);
      return r;
    }
    default: {
      const r = BigInt(await _toString(arg0));
      return r;
    }
  }
};

const _add = async (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 + Number(v), Number(arg0));
  return r;
};

const _sub = async (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 - Number(v), Number(arg0));
  return r;
};

const _mul = async (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 * Number(v), Number(arg0));
  return r;
};

const _div = async (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 / Number(v), Number(arg0));
  return r;
};

const _mod = async (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 % Number(v), Number(arg0));
  return r;
};

const _eq = async (arg0: unknown, arg1: unknown) => {
  const r = arg0 === arg1;
  return r;
};

const _ne = async (arg0: unknown, arg1: unknown) => {
  const r = arg0 !== arg1;
  return r;
};

const _lt = async (arg0: unknown, arg1: unknown) => {
  const r = (arg0 as any) < (arg1 as any);
  return r;
};

const _gt = async (arg0: unknown, arg1: unknown) => {
  const r = (arg0 as any) > (arg1 as any);
  return r;
};

const _le = async (arg0: unknown, arg1: unknown) => {
  const r = (arg0 as any) <= (arg1 as any);
  return r;
};

const _ge = async (arg0: unknown, arg1: unknown) => {
  const r = (arg0 as any) >= (arg1 as any);
  return r;
};

const _now = async () => {
  return new Date();
};

const concatInner = (args: Iterable<unknown>) => {
  let v = '';
  for (const arg of args) {
    if (typeof arg === 'string') {
      v = v + arg;
    } else {
      const iterable = asIterable(arg);
      if (iterable) {
        v = v + concatInner(iterable);
      } else {
        v = v + String(arg);
      }
    }
  }
  return v;
};

const _concat = async (...args: unknown[]) => {
  const r = concatInner(args);
  return r;
};

const _join = async (arg0: unknown, ...args: unknown[]) => {
  const sep = String(arg0);
  const r = args.map((v) => String(v)).join(sep);
  return r;
};

const _trim = async (arg0: unknown) => {
  let v: any = arg0;
  if (v === undefined || v === null) {
    v = '';
  } else if (typeof v !== 'string') {
    v = v.toString() ?? '';
  }
  return v.trim();
};

const _toUpper = async (arg0: unknown) => {
  let v: any = arg0;
  if (typeof v !== 'string') {
    v = v.toString() ?? '';
  }
  return v.toUpperCase();
};

const _toLower = async (arg0: unknown) => {
  let v: any = arg0;
  if (typeof v !== 'string') {
    v = v.toString() ?? '';
  }
  return v.toLowerCase();
};

const _length = async (arg0: unknown) => {
  if (arg0) {
    if (typeof arg0 === 'string') {
      return arg0.length;
    } else if (Array.isArray(arg0)) {
      return arg0.length;
    } else {
      const iterable = asIterable(arg0);
      if (iterable) {
        let count = 0;
        for (const _item of arg0 as Iterable<unknown>) {
          count++;
        }
        return count;
      }
    }
  }
  return 0;
};

const _and = makeFunCityFunction(async function (
  this: FunCityFunctionContext,
  ...args: FunCityExpressionNode[]
) {
  if (args.length === 0) {
    throw new FunCityReducerError({
      type: 'error',
      description: 'empty arguments',
      range: this.thisNode.range,
    });
  }
  for (const arg of args) {
    const value = await this.reduce(arg);
    if (!isConditionalTrue(value)) {
      return false;
    }
  }
  return true;
});

const _or = makeFunCityFunction(async function (
  this: FunCityFunctionContext,
  ...args: FunCityExpressionNode[]
) {
  if (args.length === 0) {
    throw new FunCityReducerError({
      type: 'error',
      description: 'empty arguments',
      range: this.thisNode.range,
    });
  }
  for (const arg of args) {
    const value = await this.reduce(arg);
    if (isConditionalTrue(value)) {
      return true;
    }
  }
  return false;
});

const _not = async (arg0: unknown) => {
  return !isConditionalTrue(arg0);
};

const _at = async (arg0: unknown, arg1: unknown) => {
  const index = Number(arg0);
  if (arg1) {
    if (typeof arg1 === 'string') {
      return arg1[index];
    } else if (Array.isArray(arg1)) {
      return arg1[index];
    } else {
      const iterable = asIterable(arg1);
      if (iterable) {
        let current = 0;
        for (const item of iterable) {
          if (current >= index) {
            return item;
          }
          current++;
        }
      }
    }
  }
  return undefined;
};

const _first = async (arg0: unknown) => {
  if (arg0) {
    if (typeof arg0 === 'string') {
      return arg0[0];
    } else if (Array.isArray(arg0)) {
      return arg0[0];
    } else {
      const iterable = asIterable(arg0);
      if (iterable) {
        for (const item of iterable) {
          return item;
        }
      }
    }
  }
  return undefined;
};

const _last = async (arg0: unknown) => {
  if (arg0) {
    if (typeof arg0 === 'string') {
      return arg0[arg0.length - 1];
    } else if (Array.isArray(arg0)) {
      return arg0[arg0.length - 1];
    } else {
      const iterable = asIterable(arg0);
      if (iterable) {
        let lastItem: unknown = undefined;
        for (const item of iterable) {
          lastItem = item;
        }
        return lastItem;
      }
    }
  }
  return undefined;
};

const _range = async (arg0: unknown, arg1: unknown) => {
  let value = Number(arg0);
  const count = Number(arg1);
  const resultList: unknown[] = [];
  for (let index = 0; index < count; index++) {
    resultList.push(value++);
  }
  return resultList;
};

const _reverse = async (arg0: unknown) => {
  const iter = arg0 as Iterable<unknown>;
  let resultList: unknown[] = [];
  for (const item of iter) {
    resultList.push(item);
  }
  return resultList.reverse();
};

const _sort = async (arg0: unknown) => {
  const iter = arg0 as Iterable<unknown>;
  let resultList: unknown[] = [];
  for (const item of iter) {
    resultList.push(item);
  }
  return resultList.sort();
};

const _map = async (arg0: unknown, arg1: unknown) => {
  const predicate = arg0 as Function;
  const iter = arg1 as Iterable<unknown>;
  const resultList: unknown[] = [];
  for (const item of iter) {
    const result = await predicate(item);
    resultList.push(result);
  }
  return resultList;
};

const _flatMap = async (arg0: unknown, arg1: unknown) => {
  const predicate = arg0 as Function;
  const iter = arg1 as Iterable<unknown>;
  const resultList: unknown[] = [];
  for (const item of iter) {
    const results = await predicate(item);
    resultList.push(...results);
  }
  return resultList;
};

const _filter = async (arg0: unknown, arg1: unknown) => {
  const predicate = arg0 as Function;
  const iter = arg1 as Iterable<unknown>;
  const resultList: unknown[] = [];
  for (const item of iter) {
    const result = await predicate(item);
    if (isConditionalTrue(result)) {
      resultList.push(item);
    }
  }
  return resultList;
};

const _collect = async (arg0: unknown) => {
  const iter = arg0 as Iterable<unknown>;
  const resultList: unknown[] = [];
  for (const item of iter) {
    if (item !== undefined && item !== null) {
      resultList.push(item);
    }
  }
  return resultList;
};

const _reduce = async (arg0: unknown, arg1: unknown, arg2: unknown) => {
  let acc = arg0;
  const predicate = arg1 as Function;
  const iter = arg2 as Iterable<unknown>;
  for (const item of iter) {
    acc = await predicate(acc, item);
  }
  return acc;
};

const _match = async (arg0: unknown, arg1: unknown) => {
  const re = arg0 instanceof RegExp ? arg0 : new RegExp(String(arg0), 'g');
  const results = String(arg1).match(re);
  return results;
};

const _replace = async (arg0: unknown, arg1: unknown, arg2: unknown) => {
  const re = arg0 instanceof RegExp ? arg0 : new RegExp(String(arg0), 'g');
  const replace = String(arg1);
  const results = String(arg2).replace(re, replace);
  return results;
};

const _regex = async (arg0: unknown, arg1: unknown) => {
  if (arg1) {
    const re = new RegExp(String(arg0), String(arg1));
    return re;
  } else {
    const re = new RegExp(String(arg0));
    return re;
  }
};

const _bind = async (arg0: unknown, ...args: unknown[]) => {
  const predicate = arg0 as Function;
  return predicate.bind(undefined, ...args);
};

const _url = async (arg0: unknown, arg1: unknown) => {
  const url = new URL(
    convertToString(arg0),
    arg1 !== undefined ? convertToString(arg1) : undefined
  );
  return url;
};

const _delay = async function (
  this: FunCityFunctionContext,
  ms: unknown,
  value?: unknown
) {
  const delayMs = Number(ms);
  const signal = this.abortSignal;

  if (!signal) {
    return await new Promise((resolve) => {
      setTimeout(resolve, delayMs, value);
    });
  }

  signal.throwIfAborted();

  return await new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      try {
        signal.throwIfAborted();
      } catch (error) {
        reject(error);
        return;
      }
      const abortError = new Error('Aborted');
      (abortError as any).name = 'AbortError';
      reject(abortError);
    };

    timer = setTimeout(() => {
      if (signal.aborted) {
        onAbort();
        return;
      }
      cleanup();
      resolve(value);
    }, delayMs);

    signal.addEventListener('abort', onAbort, { once: true });
  });
};

//////////////////////////////////////////////////////////////////////////////

/**
 * Built-in standard variables and functions.
 */
export const standardVariables = Object.freeze({
  undefined: undefined,
  null: null,
  true: true,
  false: false,
  cond: _cond,
  set: _set,
  fun: _fun,
  toString: _toString,
  toBoolean: _toBoolean,
  toNumber: _toNumber,
  toBigInt: _toBigInt,
  typeof: _typeof,
  add: _add,
  sub: _sub,
  mul: _mul,
  div: _div,
  mod: _mod,
  eq: _eq,
  ne: _ne,
  lt: _lt,
  gt: _gt,
  le: _le,
  ge: _ge,
  now: _now,
  concat: _concat,
  join: _join,
  trim: _trim,
  toUpper: _toUpper,
  toLower: _toLower,
  length: _length,
  and: _and,
  or: _or,
  not: _not,
  at: _at,
  first: _first,
  last: _last,
  range: _range,
  sort: _sort,
  reverse: _reverse,
  map: _map,
  flatMap: _flatMap,
  filter: _filter,
  collect: _collect,
  reduce: _reduce,
  match: _match,
  replace: _replace,
  regex: _regex,
  bind: _bind,
  url: _url,
  delay: _delay,
  console: console,
} as const);

/**
 * Build a variable map that includes standard variables.
 * @param variablesList - Additional variable sources.
 * @returns Combined variable map.
 */
export const buildCandidateVariables = (
  ...variablesList: readonly (FunCityVariables | Record<string, unknown>)[]
): FunCityVariables => {
  return combineVariables(standardVariables, ...variablesList);
};
