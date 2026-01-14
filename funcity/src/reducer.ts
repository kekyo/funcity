// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  type FunCityVariables,
  type FunCityExpressionNode,
  type FunCityBlockNode,
  type FunCityVariableNode,
  type FunCityReducerContext,
  type FunCityReducerContextValueResult,
  type FunCityFunctionContext,
  type FunCityApplyNode,
  type FunCityRange,
  FunCityReducerError,
  FunCityWarningEntry,
} from './types';
import {
  fromError,
  asIterable,
  isConditionalTrue,
  isFunCityFunction,
  internalCreateFunctionIdGenerator,
  internalConvertToString,
} from './utils';

//////////////////////////////////////////////////////////////////////////////

interface ThrowErrorInfo {
  description: string;
  range: FunCityRange;
}

const throwError = (info: ThrowErrorInfo) => {
  throw new FunCityReducerError({
    type: 'error',
    ...info,
  });
};

interface DeconstructConditionalCombineResult {
  readonly name: string;
  readonly canIgnore: boolean;
}

// Deconstruct with conditional combine syntax.
// ex: `foo`   --> foo, explicit
// ex: `foo?`  --> foo, can ignore
const deconstructConditionalCombine = (
  name: string
): DeconstructConditionalCombineResult => {
  if (name.length >= 1) {
    const last = name[name.length - 1]!;
    if (last === '?') {
      return {
        name: name.substring(0, name.length - 1),
        canIgnore: true,
      };
    }
  }
  return {
    name,
    canIgnore: false,
  };
};

// Traverse variable with dot-notation.
// ex: `foo`             --> foo or cause error
// ex: `foo?`            --> foo or undefined
// ex: `foo.bar.baz`     --> traverse to baz or cause error
// ex: `foo?.bar?.baz`   --> traverse to baz may undefined incompletion or cause error (at the tail baz)
const traverseVariable = (
  context: FunCityReducerContext,
  name: FunCityVariableNode,
  signal: AbortSignal | undefined
) => {
  const names = name.name.split('.');
  const n0 = names[0]!;
  const n0r = deconstructConditionalCombine(n0);
  const result0 = context.getValue(n0r.name, signal);
  if (!result0.isFound) {
    if (!n0r.canIgnore) {
      throwError({
        description: `variable is not bound: ${names[0]}`,
        range: name.range,
      });
    }
    return undefined;
  }
  let value = result0.value;
  let parent: object | undefined;
  for (const n of names.slice(1)) {
    const nr = deconstructConditionalCombine(n);
    if (value !== null && typeof value === 'object') {
      const r = value as Record<string, unknown>;
      parent = value as object;
      value = r[nr.name];
    } else {
      if (!nr.canIgnore) {
        throwError({
          description: `variable is not bound: ${n}`,
          range: name.range,
        });
      }
      return undefined;
    }
  }
  if (parent && typeof value === 'function' && !isFunCityFunction(value)) {
    return context.getBoundFunction(parent, value);
  }
  return value;
};

const applyFunction = async (
  context: FunCityReducerContext,
  node: FunCityApplyNode,
  signal: AbortSignal | undefined
) => {
  signal?.throwIfAborted();
  const func = await reduceExpressionNode(context, node.func);
  if (typeof func !== 'function') {
    throwError({
      description: 'could not apply it for function',
      range: node.range,
    });
    return undefined;
  }
  const args = isFunCityFunction(func)
    ? node.args // Passing directly node objects
    : await Promise.all(
        node.args.map(async (argNode) => {
          const arg = await reduceExpressionNode(context, argNode);
          return arg;
        })
      );
  const thisProxy = context.createFunctionContext(node, signal);
  try {
    // Call the function
    const value = await func.call(thisProxy, ...args);
    return value;
  } catch (e: unknown) {
    if (e instanceof FunCityReducerError) {
      throw e;
    }
    // Will through abort signal
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    throw new FunCityReducerError({
      type: 'error',
      description: fromError(e),
      range: node.range,
    });
  }
};

/**
 * Reduce expression node.
 * @param context - Reducer context
 * @param node - Target expression node
 * @param signal - AbortSignal
 * @returns Reduced native value
 */
export const reduceExpressionNode = async (
  context: FunCityReducerContext,
  node: FunCityExpressionNode,
  signal?: AbortSignal
): Promise<unknown> => {
  switch (node.kind) {
    case 'number':
    case 'string': {
      return node.value;
    }
    case 'variable': {
      return traverseVariable(context, node, signal);
    }
    case 'apply': {
      return await applyFunction(context, node, signal);
    }
    case 'list': {
      const results = await Promise.all(
        node.items.map((item) => reduceExpressionNode(context, item, signal))
      );
      return results;
    }
    case 'scope': {
      if (node.nodes.length === 0) {
        return [];
      }
      let result: unknown = undefined;
      for (const childNode of node.nodes) {
        result = await reduceExpressionNode(context, childNode, signal);
      }
      return result;
    }
  }
};

/**
 * Reduce a node.
 * @param context - Reducer context
 * @param node - Target node
 * @param signal - AbortSignal
 * @returns Reduced native value list
 */
export const reduceNode = async (
  context: FunCityReducerContext,
  node: FunCityBlockNode,
  signal?: AbortSignal
): Promise<unknown[]> => {
  switch (node.kind) {
    case 'text': {
      return [node.text];
    }
    case 'for': {
      const result = await reduceExpressionNode(context, node.iterable, signal);
      const iterable = asIterable(result);
      if (!iterable) {
        throwError({
          description: 'could not apply it for function',
          range: node.range,
        });
        return [];
      }
      const resultList: unknown[] = [];
      for (const item of iterable) {
        context.setValue(node.bind.name, item, signal);
        for (const repeat of node.repeat) {
          const results = await reduceNode(context, repeat, signal);
          resultList.push(...results);
        }
      }
      return resultList;
    }
    case 'while': {
      const resultList: unknown[] = [];
      while (true) {
        const condition = await reduceExpressionNode(
          context,
          node.condition,
          signal
        );
        if (!isConditionalTrue(condition)) {
          break;
        }
        for (const repeat of node.repeat) {
          const results = await reduceNode(context, repeat, signal);
          resultList.push(...results);
        }
      }
      return resultList;
    }
    case 'if': {
      const resultList: unknown[] = [];
      const condition = await reduceExpressionNode(
        context,
        node.condition,
        signal
      );
      if (isConditionalTrue(condition)) {
        for (const then of node.then) {
          const results = await reduceNode(context, then, signal);
          resultList.push(...results);
        }
      } else {
        for (const els of node.else) {
          const results = await reduceNode(context, els, signal);
          resultList.push(...results);
        }
      }
      return resultList;
    }
    default: {
      const result = await reduceExpressionNode(context, node, signal);
      return [result];
    }
  }
};

//////////////////////////////////////////////////////////////////////////////

const createScopedReducerContext = (
  parent: FunCityReducerContext,
  signal: AbortSignal | undefined
): FunCityReducerContext => {
  signal?.throwIfAborted();

  let thisVars: Map<string, unknown> | undefined;
  let thisContext: FunCityReducerContext;

  const getValue = (
    name: string,
    signal: AbortSignal | undefined
  ): FunCityReducerContextValueResult => {
    signal?.throwIfAborted();
    if (thisVars?.has(name)) {
      return { value: thisVars.get(name), isFound: true };
    } else {
      return parent.getValue(name, signal);
    }
  };

  const setValue = (
    name: string,
    value: unknown,
    signal: AbortSignal | undefined
  ): void => {
    signal?.throwIfAborted();
    if (!thisVars) {
      thisVars = new Map();
    }
    thisVars.set(name, value);
  };

  const getBoundFunction = parent.getBoundFunction;

  const createFunctionContext = (
    thisNode: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ): FunCityFunctionContext => {
    return {
      thisNode,
      abortSignal: signal,
      getValue: (name: string) => getValue(name, signal),
      setValue: (name: string, value: unknown) => setValue(name, value, signal),
      appendWarning: parent.appendWarning,
      newScope: () => createScopedReducerContext(thisContext, signal),
      convertToString: parent.convertToString,
      reduce: (node: FunCityExpressionNode) =>
        reduceExpressionNode(thisContext, node, signal),
    };
  };

  thisContext = {
    getValue,
    setValue,
    getBoundFunction,
    appendWarning: parent.appendWarning,
    newScope: (signal: AbortSignal | undefined) =>
      createScopedReducerContext(thisContext, signal),
    convertToString: parent.convertToString,
    createFunctionContext,
  };
  return thisContext;
};

/**
 * Create reducer context.
 * @param variables - Predefined variables
 * @returns Reducer context
 */
export const createReducerContext = (
  variables: FunCityVariables,
  warningLogs: FunCityWarningEntry[]
): FunCityReducerContext => {
  let thisVars: Map<string, unknown> | undefined;
  let thisContext: FunCityReducerContext;

  const createBoundFunctionResolver = () => {
    const cache = new WeakMap<object, WeakMap<Function, Function>>();
    return (owner: object, fn: Function): Function => {
      let ownerCache = cache.get(owner);
      if (!ownerCache) {
        ownerCache = new WeakMap();
        cache.set(owner, ownerCache);
      }
      const cached = ownerCache.get(fn);
      if (cached) {
        return cached;
      }
      const bound = fn.bind(owner);
      ownerCache.set(fn, bound);
      return bound;
    };
  };
  const getBoundFunction = createBoundFunctionResolver();

  const getValue = (
    name: string,
    signal: AbortSignal | undefined
  ): FunCityReducerContextValueResult => {
    signal?.throwIfAborted();
    if (thisVars?.has(name)) {
      return { value: thisVars.get(name), isFound: true };
    } else if (variables.has(name)) {
      return { value: variables.get(name), isFound: true };
    } else {
      return { value: undefined, isFound: false };
    }
  };

  const setValue = (
    name: string,
    value: unknown,
    signal: AbortSignal | undefined
  ): void => {
    signal?.throwIfAborted();
    if (!thisVars) {
      thisVars = new Map();
    }
    thisVars.set(name, value);
  };

  const appendWarning = (warning: FunCityWarningEntry): void => {
    warningLogs.push(warning);
  };

  const getFuncId = internalCreateFunctionIdGenerator();
  const convertToString = (v: unknown): string => {
    return internalConvertToString(v, getFuncId);
  };

  const createFunctionContext = (
    thisNode: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ): FunCityFunctionContext => {
    return {
      thisNode,
      abortSignal: signal,
      getValue: (name: string) => getValue(name, signal),
      setValue: (name: string, value: unknown) => setValue(name, value, signal),
      appendWarning,
      newScope: () => createScopedReducerContext(thisContext, signal),
      convertToString,
      reduce: (node: FunCityExpressionNode) =>
        reduceExpressionNode(thisContext, node, signal),
    };
  };

  thisContext = {
    getValue,
    setValue,
    getBoundFunction,
    appendWarning,
    newScope: (signal: AbortSignal | undefined) =>
      createScopedReducerContext(thisContext, signal),
    convertToString,
    createFunctionContext,
  };
  return thisContext;
};

//////////////////////////////////////////////////////////////////////////////

/**
 * Run the reducer.
 * @param nodes - Target nodes
 * @param variables - Predefined variables
 * @param logs - Will be stored logs
 * @param signal - Abort signal
 * @returns Reduced native values
 */
export async function runReducer(
  nodes: readonly FunCityBlockNode[],
  variables: FunCityVariables,
  warningLogs: FunCityWarningEntry[],
  signal?: AbortSignal
): Promise<unknown[]> {
  const context = createReducerContext(variables, warningLogs);

  const resultList: unknown[] = [];
  for (const node of nodes) {
    const results = await reduceNode(context, node, signal);
    for (const result of results) {
      if (result !== undefined) {
        resultList.push(result);
      }
    }
  }
  return resultList;
}
