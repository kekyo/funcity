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
  type FunCityMaybePromise,
  type FunCityApplyNode,
  type FunCityDotNode,
  type FunCityRange,
  type FunCityReducerExecutor,
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
  isPromiseLike,
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

// Resolve variable with conditional combine syntax.
// ex: `foo`  --> foo or cause error
// ex: `foo?` --> foo or undefined
const resolveVariable = (
  context: FunCityReducerContext,
  name: FunCityVariableNode,
  signal: AbortSignal | undefined
) => {
  const result = deconstructConditionalCombine(name.name);
  const valueResult = context.getValue(result.name, signal);
  if (!valueResult.isFound) {
    if (!result.canIgnore) {
      throwError({
        description: `variable is not bound: ${result.name}`,
        range: name.range,
      });
    }
    return undefined;
  }
  return valueResult.value;
};

const resolveDotNode = async (
  context: FunCityReducerContext,
  node: FunCityDotNode,
  signal: AbortSignal | undefined
) => {
  signal?.throwIfAborted();
  const firstSegmentOptional = node.segments[0]?.optional ?? false;
  let value: unknown;
  if (node.base.kind === 'variable') {
    const baseResult = deconstructConditionalCombine(node.base.name);
    const valueResult = context.getValue(baseResult.name, signal);
    if (!valueResult.isFound) {
      if (!baseResult.canIgnore && !firstSegmentOptional) {
        throwError({
          description: `variable is not bound: ${baseResult.name}`,
          range: node.base.range,
        });
      }
      return undefined;
    }
    value = valueResult.value;
  } else {
    value = await reduceExpressionNode(context, node.base, signal);
  }
  let parent: object | undefined;
  for (const segment of node.segments) {
    const result = deconstructConditionalCombine(segment.name);
    const isOptional = segment.optional || result.canIgnore;
    if (
      value !== null &&
      (typeof value === 'object' || typeof value === 'function')
    ) {
      const record = value as Record<string, unknown>;
      parent = value as object;
      value = record[result.name];
    } else {
      if (!isOptional) {
        throwError({
          description: `variable is not bound: ${result.name}`,
          range: segment.range,
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
  const func = await reduceExpressionNode(context, node.func, signal);
  if (typeof func !== 'function') {
    throwError({
      description: 'could not apply it for function',
      range: node.range,
    });
    return undefined;
  }
  const isSpecial = isFunCityFunction(func);
  const args = isSpecial
    ? node.args // Passing directly node objects
    : await Promise.all(
        node.args.map(async (argNode) => {
          const arg = await reduceExpressionNode(context, argNode, signal);
          return arg;
        })
      );
  const shouldConstruct = !isSpecial && context.isConstructable(func);
  try {
    if (shouldConstruct) {
      return Reflect.construct(func, args);
    }
    const thisProxy = context.createFunctionContext(node, signal);
    return await func.call(thisProxy, ...args);
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
    case 'template': {
      const resultList: unknown[] = [];
      for (const block of node.blocks) {
        const results = await reduceNode(context, block, signal);
        for (const result of results) {
          if (result !== undefined) {
            resultList.push(result);
          }
        }
      }
      return resultList
        .map((result) => context.convertToString(result))
        .join('');
    }
    case 'variable': {
      return resolveVariable(context, node, signal);
    }
    case 'dot': {
      return await resolveDotNode(context, node, signal);
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

const defaultReducerExecutor: FunCityReducerExecutor = {
  reduceExpressionNodeImmediate: (
    context: FunCityReducerContext,
    node: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ) => reduceExpressionNode(context, node, signal),
  reduceExpressionNode: (
    context: FunCityReducerContext,
    node: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ) => Promise.resolve(reduceExpressionNode(context, node, signal)),
  reduceNodeImmediate: (
    context: FunCityReducerContext,
    node: FunCityBlockNode,
    signal: AbortSignal | undefined
  ) => reduceNode(context, node, signal),
  reduceNode: (
    context: FunCityReducerContext,
    node: FunCityBlockNode,
    signal: AbortSignal | undefined
  ) => Promise.resolve(reduceNode(context, node, signal)),
};

const reduceBlockImmediate = (
  context: FunCityReducerContext,
  nodeOrNodes: FunCityBlockNode | readonly FunCityBlockNode[],
  signal: AbortSignal | undefined
): FunCityMaybePromise<unknown[]> => {
  const nodes = Array.isArray(nodeOrNodes) ? nodeOrNodes : [nodeOrNodes];
  const resultList: unknown[] = [];
  for (let index = 0; index < nodes.length; index++) {
    const results = context.reduceNodeImmediate(nodes[index]!, signal);
    if (isPromiseLike(results)) {
      return (async () => {
        const firstResults = await results;
        for (const result of firstResults) {
          if (result !== undefined) {
            resultList.push(result);
          }
        }
        for (
          let continueIndex = index + 1;
          continueIndex < nodes.length;
          continueIndex++
        ) {
          const continueResults = await context.reduceNodeImmediate(
            nodes[continueIndex]!,
            signal
          );
          for (const result of continueResults) {
            if (result !== undefined) {
              resultList.push(result);
            }
          }
        }
        return resultList;
      })();
    }
    for (const result of results) {
      if (result !== undefined) {
        resultList.push(result);
      }
    }
  }
  return resultList;
};

const createScopedReducerContext = (
  parent: FunCityReducerContext,
  signal: AbortSignal | undefined,
  executor: FunCityReducerExecutor
): FunCityReducerContext => {
  signal?.throwIfAborted();

  let thisSlotIds: Map<string, number> | undefined;
  let thisSlotValues: unknown[] | undefined;
  let thisSlotVersion = 0;
  let thisContext: FunCityReducerContext;

  const getSlotVersion = () => thisSlotVersion;

  const resolveLocalSlot = (
    name: string,
    signal: AbortSignal | undefined
  ): number | undefined => {
    signal?.throwIfAborted();
    return thisSlotIds?.get(name);
  };

  const ensureLocalSlot = (
    name: string,
    signal: AbortSignal | undefined
  ): number => {
    signal?.throwIfAborted();
    let slot = thisSlotIds?.get(name);
    if (slot !== undefined) {
      return slot;
    }
    if (!thisSlotIds) {
      thisSlotIds = new Map();
    }
    if (!thisSlotValues) {
      thisSlotValues = [];
    }
    slot = thisSlotValues.length;
    thisSlotIds.set(name, slot);
    thisSlotValues.push(undefined);
    thisSlotVersion++;
    return slot;
  };

  const getSlotValue = (
    slot: number,
    signal: AbortSignal | undefined
  ): unknown => {
    signal?.throwIfAborted();
    return thisSlotValues?.[slot];
  };

  const setSlotValue = (
    slot: number,
    value: unknown,
    signal: AbortSignal | undefined
  ): void => {
    signal?.throwIfAborted();
    if (!thisSlotValues) {
      thisSlotValues = [];
    }
    thisSlotValues[slot] = value;
  };

  const getValue = (
    name: string,
    signal: AbortSignal | undefined
  ): FunCityReducerContextValueResult => {
    signal?.throwIfAborted();
    const slot = resolveLocalSlot(name, signal);
    if (slot !== undefined) {
      return { value: getSlotValue(slot, signal), isFound: true };
    }
    return parent.getValue(name, signal);
  };

  const setValue = (
    name: string,
    value: unknown,
    signal: AbortSignal | undefined
  ): void => {
    signal?.throwIfAborted();
    const slot = ensureLocalSlot(name, signal);
    setSlotValue(slot, value, signal);
  };

  const createFunctionContext = (
    thisNode: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ): FunCityFunctionContext => {
    const reduceBlock = (
      nodeOrNodes: FunCityBlockNode | readonly FunCityBlockNode[]
    ): Promise<unknown[]> =>
      Promise.resolve(reduceBlockImmediate(thisContext, nodeOrNodes, signal));
    return {
      thisNode,
      abortSignal: signal,
      getValue: (name: string) => getValue(name, signal),
      setValue: (name: string, value: unknown) => setValue(name, value, signal),
      appendWarning: parent.appendWarning,
      getBoundFunction: parent.getBoundFunction,
      newScope: () => createScopedReducerContext(thisContext, signal, executor),
      convertToString: parent.convertToString,
      reduceImmediate: (node: FunCityExpressionNode) =>
        thisContext.reduceExpressionNodeImmediate(node, signal),
      reduce: (node: FunCityExpressionNode) =>
        thisContext.reduceExpressionNode(node, signal),
      reduceBlockImmediate: (
        nodeOrNodes: FunCityBlockNode | readonly FunCityBlockNode[]
      ) => reduceBlockImmediate(thisContext, nodeOrNodes, signal),
      reduceBlock,
    };
  };

  thisContext = {
    getValue,
    setValue,
    getBoundFunction: parent.getBoundFunction,
    appendWarning: parent.appendWarning,
    newScope: (signal: AbortSignal | undefined) =>
      createScopedReducerContext(thisContext, signal, executor),
    getSlotVersion,
    resolveLocalSlot,
    ensureLocalSlot,
    getSlotValue,
    setSlotValue,
    convertToString: parent.convertToString,
    reduceExpressionNode: (
      node: FunCityExpressionNode,
      signal: AbortSignal | undefined
    ) => executor.reduceExpressionNode(thisContext, node, signal),
    reduceExpressionNodeImmediate: (
      node: FunCityExpressionNode,
      signal: AbortSignal | undefined
    ) => executor.reduceExpressionNodeImmediate(thisContext, node, signal),
    reduceNode: (node: FunCityBlockNode, signal: AbortSignal | undefined) =>
      executor.reduceNode(thisContext, node, signal),
    reduceNodeImmediate: (
      node: FunCityBlockNode,
      signal: AbortSignal | undefined
    ) => executor.reduceNodeImmediate(thisContext, node, signal),
    isConstructable: parent.isConstructable,
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
  warningLogs: FunCityWarningEntry[],
  executor: FunCityReducerExecutor = defaultReducerExecutor
): FunCityReducerContext => {
  let thisSlotIds: Map<string, number> | undefined;
  let thisSlotValues: unknown[] | undefined;
  let thisSlotVersion = 0;
  let thisContext: FunCityReducerContext;

  const boundFunctionCache = new WeakMap<object, WeakMap<Function, Function>>();
  const getBoundFunction = (owner: object, fn: Function): Function => {
    let ownerCache = boundFunctionCache.get(owner);
    if (!ownerCache) {
      ownerCache = new WeakMap();
      boundFunctionCache.set(owner, ownerCache);
    }
    const cached = ownerCache.get(fn);
    if (cached) {
      return cached;
    }
    const bound = fn.bind(owner);
    ownerCache.set(fn, bound);
    return bound;
  };

  const constructorCache = new WeakMap<Function, boolean>();

  const getSlotVersion = () => thisSlotVersion;

  const resolveLocalSlot = (
    name: string,
    signal: AbortSignal | undefined
  ): number | undefined => {
    signal?.throwIfAborted();
    return thisSlotIds?.get(name);
  };

  const ensureLocalSlot = (
    name: string,
    signal: AbortSignal | undefined
  ): number => {
    signal?.throwIfAborted();
    let slot = thisSlotIds?.get(name);
    if (slot !== undefined) {
      return slot;
    }
    if (!thisSlotIds) {
      thisSlotIds = new Map();
    }
    if (!thisSlotValues) {
      thisSlotValues = [];
    }
    slot = thisSlotValues.length;
    thisSlotIds.set(name, slot);
    thisSlotValues.push(undefined);
    thisSlotVersion++;
    return slot;
  };

  const getSlotValue = (
    slot: number,
    signal: AbortSignal | undefined
  ): unknown => {
    signal?.throwIfAborted();
    return thisSlotValues?.[slot];
  };

  const setSlotValue = (
    slot: number,
    value: unknown,
    signal: AbortSignal | undefined
  ): void => {
    signal?.throwIfAborted();
    if (!thisSlotValues) {
      thisSlotValues = [];
    }
    thisSlotValues[slot] = value;
  };

  const getValue = (
    name: string,
    signal: AbortSignal | undefined
  ): FunCityReducerContextValueResult => {
    signal?.throwIfAborted();
    const slot = resolveLocalSlot(name, signal);
    if (slot !== undefined) {
      return { value: getSlotValue(slot, signal), isFound: true };
    }
    if (variables.has(name)) {
      return { value: variables.get(name), isFound: true };
    }
    return { value: undefined, isFound: false };
  };

  const setValue = (
    name: string,
    value: unknown,
    signal: AbortSignal | undefined
  ): void => {
    signal?.throwIfAborted();
    const slot = ensureLocalSlot(name, signal);
    setSlotValue(slot, value, signal);
  };

  const appendWarning = (warning: FunCityWarningEntry): void => {
    warningLogs.push(warning);
  };

  const isConstructable = (fn: Function): boolean => {
    if (constructorCache.has(fn)) {
      return constructorCache.get(fn)!;
    }
    let result = false;
    try {
      Reflect.construct(Object, [], fn);
      result = true;
    } catch {
      result = false;
    }
    constructorCache.set(fn, result);
    return result;
  };

  const getFuncId = internalCreateFunctionIdGenerator();
  const convertToString = (v: unknown): string => {
    return internalConvertToString(v, getFuncId);
  };

  const createFunctionContext = (
    thisNode: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ): FunCityFunctionContext => {
    const reduceBlock = (
      nodeOrNodes: FunCityBlockNode | readonly FunCityBlockNode[]
    ): Promise<unknown[]> =>
      Promise.resolve(reduceBlockImmediate(thisContext, nodeOrNodes, signal));
    return {
      thisNode,
      abortSignal: signal,
      getValue: (name: string) => getValue(name, signal),
      setValue: (name: string, value: unknown) => setValue(name, value, signal),
      appendWarning,
      getBoundFunction,
      newScope: () => createScopedReducerContext(thisContext, signal, executor),
      convertToString,
      reduceImmediate: (node: FunCityExpressionNode) =>
        thisContext.reduceExpressionNodeImmediate(node, signal),
      reduce: (node: FunCityExpressionNode) =>
        thisContext.reduceExpressionNode(node, signal),
      reduceBlockImmediate: (
        nodeOrNodes: FunCityBlockNode | readonly FunCityBlockNode[]
      ) => reduceBlockImmediate(thisContext, nodeOrNodes, signal),
      reduceBlock,
    };
  };

  thisContext = {
    getValue,
    setValue,
    getBoundFunction,
    appendWarning,
    newScope: (signal: AbortSignal | undefined) =>
      createScopedReducerContext(thisContext, signal, executor),
    getSlotVersion,
    resolveLocalSlot,
    ensureLocalSlot,
    getSlotValue,
    setSlotValue,
    convertToString,
    reduceExpressionNode: (
      node: FunCityExpressionNode,
      signal: AbortSignal | undefined
    ) => executor.reduceExpressionNode(thisContext, node, signal),
    reduceExpressionNodeImmediate: (
      node: FunCityExpressionNode,
      signal: AbortSignal | undefined
    ) => executor.reduceExpressionNodeImmediate(thisContext, node, signal),
    reduceNode: (node: FunCityBlockNode, signal: AbortSignal | undefined) =>
      executor.reduceNode(thisContext, node, signal),
    reduceNodeImmediate: (
      node: FunCityBlockNode,
      signal: AbortSignal | undefined
    ) => executor.reduceNodeImmediate(thisContext, node, signal),
    isConstructable,
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
