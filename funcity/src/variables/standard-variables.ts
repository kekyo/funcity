// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  FunCityBlockNode,
  FunCityExpressionNode,
  FunCityFunctionContext,
  FunCityLogEntry,
  FunCityMaybePromise,
  FunCityRange,
  FunCityReducerContext,
  FunCityVariables,
  FunCityVariableNode,
  FunCityReducerError,
} from '../types';
import {
  asIterable,
  combineVariables,
  convertToString,
  isConditionalTrue,
  isPromiseLike,
  makeFunCityFunction,
} from '../utils';

//////////////////////////////////////////////////////////////////////////////

const resolveMaybePromise = <T, U>(
  value: FunCityMaybePromise<T>,
  onResolved: (value: T) => FunCityMaybePromise<U>
): FunCityMaybePromise<U> => {
  if (isPromiseLike(value)) {
    return value.then((resolved) => onResolved(resolved));
  }
  return onResolved(value);
};

// `cond` function requires delayed execution both then/else expressions.
const _cond = makeFunCityFunction(function (
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
  return resolveMaybePromise(
    this.reduceImmediate(arg0),
    (cond): FunCityMaybePromise<unknown> =>
      isConditionalTrue(cond)
        ? this.reduceImmediate(arg1) // Delayed execution when condition is true.
        : this.reduceImmediate(arg2) // Delayed execution when condition is false.
  );
});

const _defaults = makeFunCityFunction(function (
  this: FunCityFunctionContext,
  arg0: FunCityExpressionNode | undefined,
  arg1: FunCityExpressionNode | undefined,
  ...rest: FunCityExpressionNode[]
) {
  if (!arg0 || !arg1 || rest.length !== 0) {
    throw new FunCityReducerError({
      type: 'error',
      description: 'Required `defaults` value and default expression',
      range: this.thisNode.range,
    });
  }

  return resolveMaybePromise(
    this.reduceImmediate(arg0),
    (value): FunCityMaybePromise<unknown> => {
      if (value !== undefined && value !== null) {
        return value;
      }
      return this.reduceImmediate(arg1);
    }
  );
});

const _set = makeFunCityFunction(function (
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
  return resolveMaybePromise(this.reduceImmediate(arg1), (value) => {
    this.setValue(arg0.name, value);
    return undefined;
  });
});

const isConstructable = (fn: Function): boolean => {
  try {
    Reflect.construct(Object, [], fn);
    return true;
  } catch {
    return false;
  }
};

const _new = makeFunCityFunction(function (
  this: FunCityFunctionContext,
  arg0: FunCityExpressionNode | undefined,
  ...rest: FunCityExpressionNode[]
) {
  if (!arg0) {
    throw new FunCityReducerError({
      type: 'error',
      description: 'Required `new` constructor expression',
      range: this.thisNode.range,
    });
  }

  return resolveMaybePromise(
    this.reduceImmediate(arg0),
    (target): FunCityMaybePromise<unknown> => {
      if (typeof target !== 'function') {
        throw new FunCityReducerError({
          type: 'error',
          description: 'Required `new` constructor function',
          range: arg0.range,
        });
      }
      if (!isConstructable(target)) {
        throw new FunCityReducerError({
          type: 'error',
          description: 'Required `new` constructable function',
          range: arg0.range,
        });
      }
      return resolveMaybePromise(
        Promise.all(rest.map((arg) => this.reduce(arg))),
        (args) => Reflect.construct(target, args)
      );
    }
  );
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

const _fun = makeFunCityFunction(function (
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

  return (...args: readonly unknown[]) => {
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
    return newContext.reduceExpressionNodeImmediate(bodyNode, this.abortSignal);
  };
});

const _typeof = (arg0: unknown) => {
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

const _toString = (...args: unknown[]) => {
  const results = args.map((arg0) => convertToString(arg0));
  return results.join(',');
};

const _toBoolean = (arg0: unknown) => {
  const r = isConditionalTrue(arg0);
  return r;
};

const _toNumber = (arg0: unknown) => {
  const r = Number(arg0);
  return r;
};

const _toBigInt = (arg0: unknown) => {
  switch (typeof arg0) {
    case 'number':
    case 'bigint':
    case 'string':
    case 'boolean': {
      const r = BigInt(arg0);
      return r;
    }
    default: {
      const r = BigInt(_toString(arg0));
      return r;
    }
  }
};

const _add = (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 + Number(v), Number(arg0));
  return r;
};

const _sub = (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 - Number(v), Number(arg0));
  return r;
};

const _mul = (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 * Number(v), Number(arg0));
  return r;
};

const _div = (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 / Number(v), Number(arg0));
  return r;
};

const _mod = (arg0: unknown, ...args: unknown[]) => {
  const r = args.reduce((v0: number, v) => v0 % Number(v), Number(arg0));
  return r;
};

const _eq = (arg0: unknown, arg1: unknown) => {
  const r = arg0 === arg1;
  return r;
};

const _ne = (arg0: unknown, arg1: unknown) => {
  const r = arg0 !== arg1;
  return r;
};

const _lt = (arg0: unknown, arg1: unknown) => {
  const r = (arg0 as any) < (arg1 as any);
  return r;
};

const _gt = (arg0: unknown, arg1: unknown) => {
  const r = (arg0 as any) > (arg1 as any);
  return r;
};

const _le = (arg0: unknown, arg1: unknown) => {
  const r = (arg0 as any) <= (arg1 as any);
  return r;
};

const _ge = (arg0: unknown, arg1: unknown) => {
  const r = (arg0 as any) >= (arg1 as any);
  return r;
};

const _now = () => {
  return new Date();
};

const _random = makeFunCityFunction(function (
  this: FunCityFunctionContext,
  arg0?: FunCityExpressionNode,
  arg1?: FunCityExpressionNode,
  ...rest: FunCityExpressionNode[]
) {
  if (!arg0 || rest.length !== 0) {
    throw new FunCityReducerError({
      type: 'error',
      description: 'Required `random` range arguments',
      range: this.thisNode.range,
    });
  }
  return resolveMaybePromise(
    this.reduceImmediate(arg0),
    (baseValue): FunCityMaybePromise<number> => {
      const spanValue = arg1 ? this.reduceImmediate(arg1) : baseValue;
      return resolveMaybePromise(spanValue, (resolvedSpanValue) => {
        const base = arg1 ? Number(baseValue) : 0;
        const span = Number(resolvedSpanValue);
        return base + Math.floor(Math.random() * span);
      });
    }
  );
});

const _randomf = (arg0?: unknown, arg1?: unknown) => {
  if (arg0 === undefined) {
    return Math.random();
  }
  const base = arg1 === undefined ? 0 : Number(arg0);
  const span = Number(arg1 ?? arg0);
  const r = base + Math.random() * span;
  return r;
};

const concatInner = (sep: string, args: Iterable<unknown>) => {
  let v = '';
  let f = true;
  for (const arg of args) {
    let as: string;
    if (typeof arg === 'string') {
      as = arg;
    } else {
      const iterable = asIterable(arg);
      if (iterable) {
        as = concatInner(sep, iterable);
      } else {
        as = convertToString(arg);
      }
    }
    if (f) {
      v = v + as;
      f = false;
    } else {
      v = v + sep + as;
    }
  }
  return v;
};

const _concat = (...args: unknown[]) => {
  const r = concatInner('', args);
  return r;
};

const _join = (arg0: unknown, ...args: unknown[]) => {
  const sep = convertToString(arg0);
  const r = concatInner(sep, args);
  return r;
};

const _trim = (arg0: unknown) => {
  let v: any = arg0;
  if (v === undefined || v === null) {
    v = '';
  } else if (typeof v !== 'string') {
    v = v.toString() ?? '';
  }
  return v.trim();
};

const _toUpper = (arg0: unknown) => {
  let v: any = arg0;
  if (typeof v !== 'string') {
    v = v.toString() ?? '';
  }
  return v.toUpperCase();
};

const _toLower = (arg0: unknown) => {
  let v: any = arg0;
  if (typeof v !== 'string') {
    v = v.toString() ?? '';
  }
  return v.toLowerCase();
};

const _length = (arg0: unknown) => {
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

const _and = makeFunCityFunction(function (
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
  for (let index = 0; index < args.length; index++) {
    const value = this.reduceImmediate(args[index]!);
    if (isPromiseLike(value)) {
      return (async () => {
        if (!isConditionalTrue(await value)) {
          return false;
        }
        for (
          let continueIndex = index + 1;
          continueIndex < args.length;
          continueIndex++
        ) {
          if (
            !isConditionalTrue(await this.reduceImmediate(args[continueIndex]!))
          ) {
            return false;
          }
        }
        return true;
      })();
    }
    if (!isConditionalTrue(value)) {
      return false;
    }
  }
  return true;
});

const _or = makeFunCityFunction(function (
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
  for (let index = 0; index < args.length; index++) {
    const value = this.reduceImmediate(args[index]!);
    if (isPromiseLike(value)) {
      return (async () => {
        if (isConditionalTrue(await value)) {
          return true;
        }
        for (
          let continueIndex = index + 1;
          continueIndex < args.length;
          continueIndex++
        ) {
          if (
            isConditionalTrue(await this.reduceImmediate(args[continueIndex]!))
          ) {
            return true;
          }
        }
        return false;
      })();
    }
    if (isConditionalTrue(value)) {
      return true;
    }
  }
  return false;
});

const _not = (arg0: unknown) => {
  return !isConditionalTrue(arg0);
};

const _at = (arg0: unknown, arg1: unknown) => {
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

const _first = (arg0: unknown) => {
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

const _last = (arg0: unknown) => {
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

const _range = (arg0: unknown, arg1: unknown) => {
  let value = Number(arg0);
  const count = Number(arg1);
  const resultList: unknown[] = [];
  for (let index = 0; index < count; index++) {
    resultList.push(value++);
  }
  return resultList;
};

const sliceIterable = (
  iter: Iterable<unknown>,
  start: number | undefined,
  end: number | undefined
) => {
  const resultList: unknown[] = [];
  for (const item of iter) {
    resultList.push(item);
  }
  return resultList.slice(start, end);
};

const _slice = (arg0: unknown, arg1: unknown, arg2: unknown) => {
  const start = arg0 === undefined ? undefined : Number(arg0);
  if (arg2 === undefined) {
    if (typeof arg1 === 'string') {
      return arg1.slice(start);
    }
    return sliceIterable(arg1 as Iterable<unknown>, start, undefined);
  }
  const end = arg1 === undefined ? undefined : Number(arg1);
  if (typeof arg2 === 'string') {
    return arg2.slice(start, end);
  }
  return sliceIterable(arg2 as Iterable<unknown>, start, end);
};

const _reverse = (arg0: unknown) => {
  const iter = arg0 as Iterable<unknown>;
  let resultList: unknown[] = [];
  for (const item of iter) {
    resultList.push(item);
  }
  return resultList.reverse();
};

const _sort = (arg0: unknown) => {
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

const _flatten = (arg0: unknown) => {
  const iter = arg0 as Iterable<unknown>;
  const resultList: unknown[] = [];
  for (const item of iter) {
    const iterable = asIterable(item);
    if (!iterable) {
      throw new TypeError('flatten requires nested iterable items');
    }
    resultList.push(...iterable);
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

const _collect = (arg0: unknown) => {
  const iter = arg0 as Iterable<unknown>;
  const resultList: unknown[] = [];
  for (const item of iter) {
    if (item !== undefined && item !== null) {
      resultList.push(item);
    }
  }
  return resultList;
};

const _distinct = (arg0: unknown) => {
  const iter = arg0 as Iterable<unknown>;
  const seen = new Set<unknown>();
  const resultList: unknown[] = [];
  for (const item of iter) {
    if (!seen.has(item)) {
      seen.add(item);
      resultList.push(item);
    }
  }
  return resultList;
};

const _distinctBy = async (arg0: unknown, arg1: unknown) => {
  const selector = arg0 as Function;
  const iter = arg1 as Iterable<unknown>;
  const seen = new Set<unknown>();
  const resultList: unknown[] = [];
  for (const item of iter) {
    const key = await selector(item);
    if (!seen.has(key)) {
      seen.add(key);
      resultList.push(item);
    }
  }
  return resultList;
};

const _union = (arg0: unknown, arg1: unknown) => {
  if (arg0 instanceof Set && arg1 instanceof Set) {
    const union = (
      arg0 as Set<unknown> & { union?: (s: Set<unknown>) => Set<unknown> }
    ).union;
    if (typeof union === 'function') {
      return Array.from(union.call(arg0, arg1));
    }
  }
  const resultList: unknown[] = [];
  const seen = new Set<unknown>();
  for (const item of arg0 as Iterable<unknown>) {
    if (!seen.has(item)) {
      seen.add(item);
      resultList.push(item);
    }
  }
  for (const item of arg1 as Iterable<unknown>) {
    if (!seen.has(item)) {
      seen.add(item);
      resultList.push(item);
    }
  }
  return resultList;
};

const _unionBy = async (arg0: unknown, arg1: unknown, arg2: unknown) => {
  const selector = arg0 as Function;
  const iterA = arg1 as Iterable<unknown>;
  const iterB = arg2 as Iterable<unknown>;
  const resultList: unknown[] = [];
  const seen = new Set<unknown>();
  for (const item of iterA) {
    const key = await selector(item);
    if (!seen.has(key)) {
      seen.add(key);
      resultList.push(item);
    }
  }
  for (const item of iterB) {
    const key = await selector(item);
    if (!seen.has(key)) {
      seen.add(key);
      resultList.push(item);
    }
  }
  return resultList;
};

const _intersection = (arg0: unknown, arg1: unknown) => {
  if (arg0 instanceof Set && arg1 instanceof Set) {
    const intersection = (
      arg0 as Set<unknown> & {
        intersection?: (s: Set<unknown>) => Set<unknown>;
      }
    ).intersection;
    if (typeof intersection === 'function') {
      return Array.from(intersection.call(arg0, arg1));
    }
  }
  const iterA = arg0 as Iterable<unknown>;
  const setB = new Set<unknown>(arg1 as Iterable<unknown>);
  const seen = new Set<unknown>();
  const resultList: unknown[] = [];
  for (const item of iterA) {
    if (!seen.has(item) && setB.has(item)) {
      seen.add(item);
      resultList.push(item);
    }
  }
  return resultList;
};

const _intersectionBy = async (arg0: unknown, arg1: unknown, arg2: unknown) => {
  const selector = arg0 as Function;
  const iterA = arg1 as Iterable<unknown>;
  const iterB = arg2 as Iterable<unknown>;
  const keysB = new Set<unknown>();
  for (const item of iterB) {
    const key = await selector(item);
    keysB.add(key);
  }
  const seen = new Set<unknown>();
  const resultList: unknown[] = [];
  for (const item of iterA) {
    const key = await selector(item);
    if (!seen.has(key) && keysB.has(key)) {
      seen.add(key);
      resultList.push(item);
    }
  }
  return resultList;
};

const _difference = (arg0: unknown, arg1: unknown) => {
  if (arg0 instanceof Set && arg1 instanceof Set) {
    const difference = (
      arg0 as Set<unknown> & {
        difference?: (s: Set<unknown>) => Set<unknown>;
      }
    ).difference;
    if (typeof difference === 'function') {
      return Array.from(difference.call(arg0, arg1));
    }
  }
  const iterA = arg0 as Iterable<unknown>;
  const setB = new Set<unknown>(arg1 as Iterable<unknown>);
  const seen = new Set<unknown>();
  const resultList: unknown[] = [];
  for (const item of iterA) {
    if (!seen.has(item) && !setB.has(item)) {
      seen.add(item);
      resultList.push(item);
    }
  }
  return resultList;
};

const _differenceBy = async (arg0: unknown, arg1: unknown, arg2: unknown) => {
  const selector = arg0 as Function;
  const iterA = arg1 as Iterable<unknown>;
  const iterB = arg2 as Iterable<unknown>;
  const keysB = new Set<unknown>();
  for (const item of iterB) {
    const key = await selector(item);
    keysB.add(key);
  }
  const seen = new Set<unknown>();
  const resultList: unknown[] = [];
  for (const item of iterA) {
    const key = await selector(item);
    if (!seen.has(key) && !keysB.has(key)) {
      seen.add(key);
      resultList.push(item);
    }
  }
  return resultList;
};

const _symmetricDifference = (arg0: unknown, arg1: unknown) => {
  if (arg0 instanceof Set && arg1 instanceof Set) {
    const symmetricDifference = (
      arg0 as Set<unknown> & {
        symmetricDifference?: (s: Set<unknown>) => Set<unknown>;
      }
    ).symmetricDifference;
    if (typeof symmetricDifference === 'function') {
      return Array.from(symmetricDifference.call(arg0, arg1));
    }
  }
  const iterA = arg0 as Iterable<unknown>;
  const iterB = arg1 as Iterable<unknown>;
  const itemsA: unknown[] = [];
  const itemsB: unknown[] = [];
  const setA = new Set<unknown>();
  const setB = new Set<unknown>();
  for (const item of iterA) {
    if (!setA.has(item)) {
      setA.add(item);
      itemsA.push(item);
    }
  }
  for (const item of iterB) {
    if (!setB.has(item)) {
      setB.add(item);
      itemsB.push(item);
    }
  }
  const resultList: unknown[] = [];
  for (const item of itemsA) {
    if (!setB.has(item)) {
      resultList.push(item);
    }
  }
  for (const item of itemsB) {
    if (!setA.has(item)) {
      resultList.push(item);
    }
  }
  return resultList;
};

const _symmetricDifferenceBy = async (
  arg0: unknown,
  arg1: unknown,
  arg2: unknown
) => {
  const selector = arg0 as Function;
  const iterA = arg1 as Iterable<unknown>;
  const iterB = arg2 as Iterable<unknown>;
  const keysA = new Set<unknown>();
  const keysB = new Set<unknown>();
  const itemsA: { key: unknown; item: unknown }[] = [];
  const itemsB: { key: unknown; item: unknown }[] = [];
  for (const item of iterA) {
    const key = await selector(item);
    if (!keysA.has(key)) {
      keysA.add(key);
      itemsA.push({ key, item });
    }
  }
  for (const item of iterB) {
    const key = await selector(item);
    if (!keysB.has(key)) {
      keysB.add(key);
      itemsB.push({ key, item });
    }
  }
  const resultList: unknown[] = [];
  for (const entry of itemsA) {
    if (!keysB.has(entry.key)) {
      resultList.push(entry.item);
    }
  }
  for (const entry of itemsB) {
    if (!keysA.has(entry.key)) {
      resultList.push(entry.item);
    }
  }
  return resultList;
};

const _isSubsetOf = (arg0: unknown, arg1: unknown) => {
  if (arg0 instanceof Set && arg1 instanceof Set) {
    const isSubsetOf = (
      arg0 as Set<unknown> & {
        isSubsetOf?: (s: Set<unknown>) => boolean;
      }
    ).isSubsetOf;
    if (typeof isSubsetOf === 'function') {
      return isSubsetOf.call(arg0, arg1);
    }
  }
  const iterA = arg0 as Iterable<unknown>;
  const setB = new Set<unknown>(arg1 as Iterable<unknown>);
  const seen = new Set<unknown>();
  for (const item of iterA) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    if (!setB.has(item)) {
      return false;
    }
  }
  return true;
};

const _isSubsetOfBy = async (arg0: unknown, arg1: unknown, arg2: unknown) => {
  const selector = arg0 as Function;
  const iterA = arg1 as Iterable<unknown>;
  const iterB = arg2 as Iterable<unknown>;
  const keysB = new Set<unknown>();
  for (const item of iterB) {
    const key = await selector(item);
    keysB.add(key);
  }
  const seen = new Set<unknown>();
  for (const item of iterA) {
    const key = await selector(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (!keysB.has(key)) {
      return false;
    }
  }
  return true;
};

const _isSupersetOf = (arg0: unknown, arg1: unknown) => {
  if (arg0 instanceof Set && arg1 instanceof Set) {
    const isSupersetOf = (
      arg0 as Set<unknown> & {
        isSupersetOf?: (s: Set<unknown>) => boolean;
      }
    ).isSupersetOf;
    if (typeof isSupersetOf === 'function') {
      return isSupersetOf.call(arg0, arg1);
    }
  }
  const setA = new Set<unknown>(arg0 as Iterable<unknown>);
  for (const item of arg1 as Iterable<unknown>) {
    if (!setA.has(item)) {
      return false;
    }
  }
  return true;
};

const _isSupersetOfBy = async (arg0: unknown, arg1: unknown, arg2: unknown) => {
  const selector = arg0 as Function;
  const iterA = arg1 as Iterable<unknown>;
  const iterB = arg2 as Iterable<unknown>;
  const keysA = new Set<unknown>();
  for (const item of iterA) {
    const key = await selector(item);
    keysA.add(key);
  }
  const seen = new Set<unknown>();
  for (const item of iterB) {
    const key = await selector(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (!keysA.has(key)) {
      return false;
    }
  }
  return true;
};

const _isDisjointFrom = (arg0: unknown, arg1: unknown) => {
  if (arg0 instanceof Set && arg1 instanceof Set) {
    const isDisjointFrom = (
      arg0 as Set<unknown> & {
        isDisjointFrom?: (s: Set<unknown>) => boolean;
      }
    ).isDisjointFrom;
    if (typeof isDisjointFrom === 'function') {
      return isDisjointFrom.call(arg0, arg1);
    }
  }
  const setB = new Set<unknown>(arg1 as Iterable<unknown>);
  for (const item of arg0 as Iterable<unknown>) {
    if (setB.has(item)) {
      return false;
    }
  }
  return true;
};

const _isDisjointFromBy = async (
  arg0: unknown,
  arg1: unknown,
  arg2: unknown
) => {
  const selector = arg0 as Function;
  const iterA = arg1 as Iterable<unknown>;
  const iterB = arg2 as Iterable<unknown>;
  const keysB = new Set<unknown>();
  for (const item of iterB) {
    const key = await selector(item);
    keysB.add(key);
  }
  for (const item of iterA) {
    const key = await selector(item);
    if (keysB.has(key)) {
      return false;
    }
  }
  return true;
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

const _match = (arg0: unknown, arg1: unknown) => {
  const re =
    arg0 instanceof RegExp ? arg0 : new RegExp(convertToString(arg0), 'g');
  const results = convertToString(arg1).match(re);
  return results;
};

const _replace = (arg0: unknown, arg1: unknown, arg2: unknown) => {
  const re =
    arg0 instanceof RegExp ? arg0 : new RegExp(convertToString(arg0), 'g');
  const replace = convertToString(arg1);
  const results = convertToString(arg2).replace(re, replace);
  return results;
};

const _regex = (arg0: unknown, arg1: unknown) => {
  if (arg1) {
    const re = new RegExp(convertToString(arg0), convertToString(arg1));
    return re;
  } else {
    const re = new RegExp(convertToString(arg0));
    return re;
  }
};

const _bind = (arg0: unknown, ...args: unknown[]) => {
  const predicate = arg0 as Function;
  return predicate.bind(undefined, ...args);
};

const _url = (arg0: unknown, arg1: unknown) => {
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

export type IncludeParseMode = 'template' | 'code';

export type IncludeScope = 'same' | 'child';

export type IncludeMissingBehavior = 'error' | 'empty';

export interface IncludeSource {
  readonly sourceId: string;
  readonly script: string;
}

export interface IncludeResolverContext {
  readonly sourceId: string;
  readonly range: FunCityRange;
  readonly signal: AbortSignal | undefined;
}

export type IncludeResolver = (
  request: string,
  context: IncludeResolverContext
) => Promise<IncludeSource | string | undefined>;

export interface IncludeFunctionOptions {
  readonly resolve: IncludeResolver;
  readonly logs: FunCityLogEntry[];
  readonly mode?: IncludeParseMode;
  readonly scope?: IncludeScope;
  readonly includeMissing?: IncludeMissingBehavior;
  readonly tryIncludeMissing?: IncludeMissingBehavior;
}

export interface IncludeFunctions {
  readonly include: Function;
  readonly tryInclude: Function;
}

type CompileCacheModule = typeof import('../compile-cache');

export const createIncludeFunction = (
  options: IncludeFunctionOptions
): IncludeFunctions => {
  const {
    resolve,
    logs,
    mode = 'template',
    scope = 'child',
    includeMissing = 'error',
    tryIncludeMissing = 'empty',
  } = options;

  let compileCacheModulePromise: Promise<CompileCacheModule> | undefined;
  const getCompileCacheModule = async (): Promise<CompileCacheModule> => {
    compileCacheModulePromise ??= import('../compile-cache');
    return await compileCacheModulePromise;
  };

  const parseScript = async (script: string, sourceId: string) => {
    const { compileScriptCached } = await getCompileCacheModule();
    return compileScriptCached(script, sourceId, mode, 'reducer');
  };

  const resolveSource = async (
    request: string,
    context: IncludeResolverContext
  ): Promise<IncludeSource | undefined> => {
    const resolved = await resolve(request, context);
    if (resolved === undefined || resolved === null) {
      return undefined;
    }
    if (typeof resolved === 'string') {
      return { sourceId: request, script: resolved };
    }
    return resolved;
  };

  const normalizeIncludeStack = (
    includeStack: readonly string[],
    sourceId: string
  ): readonly string[] =>
    includeStack[includeStack.length - 1] === sourceId
      ? includeStack
      : [...includeStack, sourceId];

  const throwPrimaryParseError = (
    parseLogs: readonly FunCityLogEntry[]
  ): void => {
    let primaryError: FunCityLogEntry | undefined;
    for (const entry of parseLogs) {
      if (entry.type === 'error' && primaryError === undefined) {
        primaryError = entry;
      } else {
        logs.push(entry);
      }
    }
    if (primaryError?.type === 'error') {
      throw new FunCityReducerError(primaryError);
    }
  };

  const withSameScopeIncludeFunctions = async (
    context: FunCityFunctionContext,
    includeFunctions: IncludeFunctions,
    run: () => Promise<unknown[]>
  ): Promise<unknown[]> => {
    const previousInclude = context.getValue('include');
    const previousTryInclude = context.getValue('tryInclude');
    context.setValue('include', includeFunctions.include);
    context.setValue('tryInclude', includeFunctions.tryInclude);
    try {
      return await run();
    } finally {
      if (previousInclude.isFound) {
        context.setValue('include', previousInclude.value);
      }
      if (previousTryInclude.isFound) {
        context.setValue('tryInclude', previousTryInclude.value);
      }
    }
  };

  const installIncludeFunctions = (
    context: FunCityReducerContext,
    includeFunctions: IncludeFunctions,
    signal: AbortSignal | undefined
  ): void => {
    context.setValue('include', includeFunctions.include, signal);
    context.setValue('tryInclude', includeFunctions.tryInclude, signal);
  };

  const reduceWithScope = async (
    context: FunCityFunctionContext,
    nodes: readonly FunCityBlockNode[],
    includeFunctions: IncludeFunctions
  ): Promise<unknown[]> => {
    if (scope === 'same') {
      return await withSameScopeIncludeFunctions(
        context,
        includeFunctions,
        () => context.reduceBlock(nodes)
      );
    }
    const scopedContext = context.newScope();
    installIncludeFunctions(
      scopedContext,
      includeFunctions,
      context.abortSignal
    );
    const resultList: unknown[] = [];
    for (const node of nodes) {
      const results = await scopedContext.reduceNode(node, context.abortSignal);
      for (const result of results) {
        if (result !== undefined) {
          resultList.push(result);
        }
      }
    }
    return resultList;
  };

  const createIncludeFunctions = (
    includeStack: readonly string[]
  ): IncludeFunctions => {
    const renderIncluded = async (
      context: FunCityFunctionContext,
      arg0: FunCityExpressionNode | undefined,
      missingBehavior: IncludeMissingBehavior
    ): Promise<string> => {
      if (!arg0) {
        throw new FunCityReducerError({
          type: 'error',
          description: 'Required `include` target',
          range: context.thisNode.range,
        });
      }

      const resolvedArg = await context.reduce(arg0);
      if (resolvedArg === undefined || resolvedArg === null) {
        if (missingBehavior === 'empty') {
          return '';
        }
        throw new FunCityReducerError({
          type: 'error',
          description: 'Required `include` target',
          range: context.thisNode.range,
        });
      }

      const request = String(resolvedArg);
      const activeIncludeStack = normalizeIncludeStack(
        includeStack,
        context.thisNode.range.sourceId
      );
      const source = await resolveSource(request, {
        sourceId: context.thisNode.range.sourceId,
        range: context.thisNode.range,
        signal: context.abortSignal,
      });
      if (!source) {
        if (missingBehavior === 'empty') {
          return '';
        }
        throw new FunCityReducerError({
          type: 'error',
          description: `Include source not found: ${request}`,
          range: context.thisNode.range,
        });
      }

      if (activeIncludeStack.includes(source.sourceId)) {
        throw new FunCityReducerError({
          type: 'error',
          description: `circular include detected: ${source.sourceId}`,
          range: context.thisNode.range,
        });
      }

      const parsed = await parseScript(source.script, source.sourceId);
      if (parsed.logs.length > 0) {
        throwPrimaryParseError(parsed.logs);
      }

      const nestedIncludeFunctions = createIncludeFunctions([
        ...activeIncludeStack,
        source.sourceId,
      ]);
      const reducedValues = await reduceWithScope(
        context,
        parsed.nodes,
        nestedIncludeFunctions
      );
      return reducedValues
        .map((value) => context.convertToString(value))
        .join('');
    };

    const include = makeFunCityFunction(async function (
      this: FunCityFunctionContext,
      arg0?: FunCityExpressionNode
    ) {
      return await renderIncluded(this, arg0, includeMissing);
    });

    const tryInclude = makeFunCityFunction(async function (
      this: FunCityFunctionContext,
      arg0?: FunCityExpressionNode
    ) {
      return await renderIncluded(this, arg0, tryIncludeMissing);
    });

    return { include, tryInclude };
  };

  return createIncludeFunctions([]);
};

/**
 * Built-in standard variables and functions.
 */
export const standardVariables = Object.freeze({
  undefined: undefined,
  null: null,
  true: true,
  false: false,
  cond: _cond,
  defaults: _defaults,
  set: _set,
  new: _new,
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
  random: _random,
  randomf: _randomf,
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
  slice: _slice,
  sort: _sort,
  reverse: _reverse,
  map: _map,
  flatMap: _flatMap,
  flatten: _flatten,
  filter: _filter,
  collect: _collect,
  distinct: _distinct,
  distinctBy: _distinctBy,
  union: _union,
  unionBy: _unionBy,
  intersection: _intersection,
  intersectionBy: _intersectionBy,
  difference: _difference,
  differenceBy: _differenceBy,
  symmetricDifference: _symmetricDifference,
  symmetricDifferenceBy: _symmetricDifferenceBy,
  isSubsetOf: _isSubsetOf,
  isSubsetOfBy: _isSubsetOfBy,
  isSupersetOf: _isSupersetOf,
  isSupersetOfBy: _isSupersetOfBy,
  isDisjointFrom: _isDisjointFrom,
  isDisjointFromBy: _isDisjointFromBy,
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
