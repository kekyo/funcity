// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  type FunCityErrorInfo,
  type FunCityVariables,
  type FunCityExpressionNode,
  type FunCityBlockNode,
  type FunCityVariableNode,
  type FunCityReducerContext,
  type FunCityReducerContextValueResult,
  type FunCityFunctionContext,
  type FunCityApplyNode,
  FunCityReducerError,
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
  name: FunCityVariableNode
) => {
  const names = name.name.split('.');
  const n0 = names[0]!;
  const n0r = deconstructConditionalCombine(n0);
  const result0 = context.getValue(n0r.name);
  if (!result0.isFound) {
    if (!n0r.canIgnore) {
      context.appendError({
        type: 'error',
        description: `variable is not bound: ${names[0]}`,
        range: name.range,
      });
    }
    return undefined;
  }
  let value = result0.value;
  for (const n of names.slice(1)) {
    const nr = deconstructConditionalCombine(n);
    if (typeof value === 'object') {
      const r = value as Record<string, unknown>;
      const v = r[nr.name];
      value = v;
    } else {
      if (!nr.canIgnore) {
        context.appendError({
          type: 'error',
          description: `variable is not bound: ${n}`,
          range: name.range,
        });
      }
      return undefined;
    }
  }
  return value;
};

const applyFunction = async (
  context: FunCityReducerContext,
  node: FunCityApplyNode
) => {
  context.abortSignal?.throwIfAborted();
  const func = await reduceExpressionNode(context, node.func);
  if (typeof func !== 'function') {
    context.appendError({
      type: 'error',
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
  const thisProxy = context.createFunctionContext(node);
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
 * @returns Reduced native value
 */
export const reduceExpressionNode = async (
  context: FunCityReducerContext,
  node: FunCityExpressionNode
): Promise<unknown> => {
  switch (node.kind) {
    case 'number':
    case 'string': {
      return node.value;
    }
    case 'variable': {
      return traverseVariable(context, node);
    }
    case 'apply': {
      return await applyFunction(context, node);
    }
    case 'list': {
      const results = await Promise.all(
        node.items.map((item) => reduceExpressionNode(context, item))
      );
      return results;
    }
    case 'scope': {
      if (node.nodes.length === 0) {
        return [];
      }
      let index = 0;
      while (!context.isFailed()) {
        const result = await reduceExpressionNode(context, node.nodes[index]!);
        index++;
        if (index >= node.nodes.length) {
          return result;
        }
      }
      return undefined;
    }
  }
};

/**
 * Reduce a node.
 * @param context - Reducer context
 * @param node - Target node
 * @returns Reduced native value list
 */
export const reduceNode = async (
  context: FunCityReducerContext,
  node: FunCityBlockNode
): Promise<unknown[]> => {
  switch (node.kind) {
    case 'text': {
      return [node.text];
    }
    case 'for': {
      const result = await reduceExpressionNode(context, node.iterable);
      const iterable = asIterable(result);
      if (!iterable) {
        context.appendError({
          type: 'error',
          description: 'could not apply it for function',
          range: node.range,
        });
        return [];
      }
      const resultList: unknown[] = [];
      for (const item of iterable) {
        if (context.isFailed()) {
          break;
        }
        context.setValue(node.bind.name, item);
        for (const repeat of node.repeat) {
          const results = await reduceNode(context, repeat);
          resultList.push(...results);
        }
      }
      return resultList;
    }
    case 'while': {
      const resultList: unknown[] = [];
      while (!context.isFailed()) {
        const condition = await reduceExpressionNode(context, node.condition);
        if (!isConditionalTrue(condition)) {
          break;
        }
        for (const repeat of node.repeat) {
          const results = await reduceNode(context, repeat);
          resultList.push(...results);
        }
      }
      return resultList;
    }
    case 'if': {
      const resultList: unknown[] = [];
      const condition = await reduceExpressionNode(context, node.condition);
      if (isConditionalTrue(condition)) {
        for (const then of node.then) {
          const results = await reduceNode(context, then);
          resultList.push(...results);
        }
      } else {
        for (const els of node.else) {
          const results = await reduceNode(context, els);
          resultList.push(...results);
        }
      }
      return resultList;
    }
    default: {
      const result = await reduceExpressionNode(context, node);
      return [result];
    }
  }
};

//////////////////////////////////////////////////////////////////////////////

const createScopedReducerContext = (
  parent: FunCityReducerContext
): FunCityReducerContext => {
  let thisVars: Map<string, unknown> | undefined;
  let thisContext: FunCityReducerContext;

  const getValue = (name: string): FunCityReducerContextValueResult => {
    parent.abortSignal?.throwIfAborted();
    if (thisVars?.has(name)) {
      return { value: thisVars.get(name), isFound: true };
    } else {
      return parent.getValue(name);
    }
  };

  const setValue = (name: string, value: unknown): void => {
    parent.abortSignal?.throwIfAborted();
    if (!thisVars) {
      thisVars = new Map();
    }
    thisVars.set(name, value);
  };

  const createFunctionContext = (
    thisNode: FunCityExpressionNode
  ): FunCityFunctionContext => {
    return {
      thisNode,
      abortSignal: parent.abortSignal,
      getValue,
      setValue,
      isFailed: parent.isFailed,
      appendError: parent.appendError,
      newScope: () => createScopedReducerContext(thisContext),
      convertToString: parent.convertToString,
      reduce: (node: FunCityExpressionNode) => {
        parent.abortSignal?.throwIfAborted();
        return reduceExpressionNode(thisContext, node);
      },
    };
  };

  thisContext = {
    abortSignal: parent.abortSignal,
    getValue,
    setValue,
    isFailed: parent.isFailed,
    appendError: parent.appendError,
    newScope: () => {
      parent.abortSignal?.throwIfAborted();
      return createScopedReducerContext(thisContext);
    },
    convertToString: parent.convertToString,
    createFunctionContext,
  };
  return thisContext;
};

/**
 * Create reducer context.
 * @param variables - Predefined variables
 * @param signal - Abort signal
 * @returns Reducer context
 */
export const createReducerContext = (
  variables: FunCityVariables,
  signal?: AbortSignal
): FunCityReducerContext => {
  let thisVars: Map<string, unknown> | undefined;
  let thisContext: FunCityReducerContext;

  const getValue = (name: string): FunCityReducerContextValueResult => {
    signal?.throwIfAborted();
    if (thisVars?.has(name)) {
      return { value: thisVars.get(name), isFound: true };
    } else if (variables.has(name)) {
      return { value: variables.get(name), isFound: true };
    } else {
      return { value: undefined, isFound: false };
    }
  };

  const setValue = (name: string, value: unknown): void => {
    signal?.throwIfAborted();
    if (!thisVars) {
      thisVars = new Map();
    }
    thisVars.set(name, value);
  };

  const appendError = (error: FunCityErrorInfo): void => {
    if (error.type === 'warning') {
      return;
    }
    throw new FunCityReducerError(error);
  };

  const isFailed = (): boolean => {
    return false;
  };

  const getFuncId = internalCreateFunctionIdGenerator();
  const convertToString = (v: unknown): string => {
    return internalConvertToString(v, getFuncId);
  };

  const createFunctionContext = (
    thisNode: FunCityExpressionNode
  ): FunCityFunctionContext => {
    return {
      thisNode,
      abortSignal: signal,
      getValue,
      setValue,
      isFailed,
      appendError,
      newScope: () => createScopedReducerContext(thisContext),
      convertToString,
      reduce: (node: FunCityExpressionNode) => {
        signal?.throwIfAborted();
        return reduceExpressionNode(thisContext, node);
      },
    };
  };

  thisContext = {
    abortSignal: signal,
    getValue,
    setValue,
    appendError,
    isFailed,
    newScope: () => {
      signal?.throwIfAborted();
      return createScopedReducerContext(thisContext);
    },
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
 * @param signal - Abort signal
 * @returns Reduced native values
 */
export async function runReducer(
  nodes: readonly FunCityBlockNode[],
  variables: FunCityVariables,
  signal?: AbortSignal
): Promise<unknown[]> {
  const context = createReducerContext(variables, signal);

  const resultList: unknown[] = [];
  for (const node of nodes) {
    const results = await reduceNode(context, node);
    for (const result of results) {
      if (result !== undefined) {
        resultList.push(result);
      }
    }
  }
  return resultList;
}
