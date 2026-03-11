// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  type FunCityApplyNode,
  type FunCityBlockNode,
  type FunCityExecutionBackend,
  type FunCityDotNode,
  type FunCityExpressionNode,
  type FunCityMaybePromise,
  type FunCityRange,
  type FunCityReducerContext,
  type FunCityReducerExecutor,
  type FunCityVariables,
  FunCityReducerError,
  FunCityWarningEntry,
} from './types';
import { createReducerContext } from './reducer';
import {
  asIterable,
  fromError,
  isConditionalTrue,
  isFunCityFunction,
  isPromiseLike,
} from './utils';
import { standardVariables } from './variables/standard-variables';

//////////////////////////////////////////////////////////////////////////////

interface ThrowErrorInfo {
  readonly description: string;
  readonly range: FunCityRange;
}

const throwError = (info: ThrowErrorInfo): never => {
  throw new FunCityReducerError({
    type: 'error',
    ...info,
  });
};

interface DeconstructConditionalCombineResult {
  readonly name: string;
  readonly canIgnore: boolean;
}

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

const extractLambdaParameterNames = (
  node: FunCityExpressionNode
): string[] | undefined => {
  switch (node.kind) {
    case 'variable': {
      return [node.name];
    }
    case 'list': {
      const names: string[] = [];
      for (const item of node.items) {
        if (item.kind !== 'variable') {
          return undefined;
        }
        names.push(item.name);
      }
      return names;
    }
    default: {
      return undefined;
    }
  }
};

const resolveVariable = (
  context: FunCityReducerContext,
  result: DeconstructConditionalCombineResult,
  range: FunCityRange,
  signal: AbortSignal | undefined
) => {
  const valueResult = context.getValue(result.name, signal);
  if (!valueResult.isFound) {
    if (!result.canIgnore) {
      throwError({
        description: `variable is not bound: ${result.name}`,
        range,
      });
    }
    return undefined;
  }
  return valueResult.value;
};

/**
 * Generated expression runner.
 */
export interface FunCityGeneratedExpression {
  /**
   * Run the generated expression.
   * @param context - Reducer context
   * @param signal - AbortSignal when available.
   * @returns Reduced native value.
   */
  (context: FunCityReducerContext, signal?: AbortSignal): Promise<unknown>;
}

/**
 * Generated block runner.
 */
export interface FunCityGeneratedBlock {
  /**
   * Run the generated block.
   * @param context - Reducer context
   * @param signal - AbortSignal when available.
   * @returns Reduced native values.
   */
  (context: FunCityReducerContext, signal?: AbortSignal): Promise<unknown[]>;
}

/**
 * Generated program runner.
 */
export interface FunCityGeneratedProgram {
  /**
   * Run the generated program.
   * @param context - Reducer context
   * @param signal - AbortSignal when available.
   * @returns Reduced native values.
   */
  (context: FunCityReducerContext, signal?: AbortSignal): Promise<unknown[]>;
}

/**
 * Generated text program runner.
 */
export interface FunCityGeneratedTextProgram {
  /**
   * Run the generated text program.
   * @param context - Reducer context
   * @param signal - AbortSignal when available.
   * @returns Reduced text.
   */
  (context: FunCityReducerContext, signal?: AbortSignal): Promise<string>;
}

/**
 * Dynamic code generator for AST nodes.
 */
export interface FunCityDynamicCodeGenerator {
  /**
   * Generate a function object for an expression node.
   * @param node - Target expression node.
   * @returns Generated expression runner.
   */
  readonly generateExpression: (
    node: FunCityExpressionNode
  ) => FunCityGeneratedExpression;
  /**
   * Generate a function object for a block node.
   * @param node - Target block node.
   * @returns Generated block runner.
   */
  readonly generateBlock: (node: FunCityBlockNode) => FunCityGeneratedBlock;
  /**
   * Generate a function object for a node list.
   * @param nodes - Target node list.
   * @returns Generated program runner.
   */
  readonly generateProgram: (
    nodes: readonly FunCityBlockNode[]
  ) => FunCityGeneratedProgram;
  /**
   * Generate a function object for a text-rendering node list.
   * @param nodes - Target node list.
   * @returns Generated text program runner.
   */
  readonly generateTextProgram: (
    nodes: readonly FunCityBlockNode[]
  ) => FunCityGeneratedTextProgram;
  /**
   * Create a reducer executor backed by this generator.
   * @returns Reducer executor.
   */
  readonly createExecutor: () => FunCityReducerExecutor;
}

/**
 * Dynamic code generator backend.
 */
export type FunCityDynamicCodeGeneratorBackend = Exclude<
  FunCityExecutionBackend,
  'reducer'
>;

/**
 * Dynamic code generator options.
 */
export interface FunCityDynamicCodeGeneratorOptions {
  /**
   * Target backend.
   * @remarks `closure` preserves the original closure-based JIT and `source`
   *   uses source-generated async runners while keeping the immediate executor
   *   on the closure fast path.
   */
  readonly backend?: FunCityDynamicCodeGeneratorBackend;
}

type FunCityGeneratedExpressionImmediate = (
  context: FunCityReducerContext,
  signal?: AbortSignal
) => FunCityMaybePromise<unknown>;

type FunCityGeneratedBlockImmediate = (
  context: FunCityReducerContext,
  signal?: AbortSignal
) => FunCityMaybePromise<unknown[]>;

type FunCityGeneratedProgramImmediate = (
  context: FunCityReducerContext,
  signal?: AbortSignal
) => FunCityMaybePromise<unknown[]>;

type FunCityGeneratedTextBlockImmediate = (
  context: FunCityReducerContext,
  signal?: AbortSignal
) => FunCityMaybePromise<string>;

type FunCityGeneratedTextProgramImmediate = (
  context: FunCityReducerContext,
  signal?: AbortSignal
) => FunCityMaybePromise<string>;

const filterUndefined = (results: readonly unknown[]) =>
  results.filter((result) => result !== undefined);

const resolveMaybePromise = <T, U>(
  value: FunCityMaybePromise<T>,
  onResolved: (value: T) => FunCityMaybePromise<U>
): FunCityMaybePromise<U> => {
  if (isPromiseLike(value)) {
    return value.then((resolved) => onResolved(resolved));
  }
  return onResolved(value);
};

const specializableStandardCallTargets = Object.freeze({
  toString: standardVariables.toString as Function,
  toBoolean: standardVariables.toBoolean as Function,
  toNumber: standardVariables.toNumber as Function,
  toBigInt: standardVariables.toBigInt as Function,
  typeof: standardVariables.typeof as Function,
  add: standardVariables.add as Function,
  sub: standardVariables.sub as Function,
  mul: standardVariables.mul as Function,
  div: standardVariables.div as Function,
  mod: standardVariables.mod as Function,
  eq: standardVariables.eq as Function,
  ne: standardVariables.ne as Function,
  lt: standardVariables.lt as Function,
  gt: standardVariables.gt as Function,
  le: standardVariables.le as Function,
  ge: standardVariables.ge as Function,
  now: standardVariables.now as Function,
  randomf: standardVariables.randomf as Function,
  concat: standardVariables.concat as Function,
  join: standardVariables.join as Function,
  trim: standardVariables.trim as Function,
  toUpper: standardVariables.toUpper as Function,
  toLower: standardVariables.toLower as Function,
  length: standardVariables.length as Function,
  not: standardVariables.not as Function,
  at: standardVariables.at as Function,
  first: standardVariables.first as Function,
  last: standardVariables.last as Function,
  range: standardVariables.range as Function,
  slice: standardVariables.slice as Function,
  sort: standardVariables.sort as Function,
  reverse: standardVariables.reverse as Function,
  map: standardVariables.map as Function,
  flatMap: standardVariables.flatMap as Function,
  flatten: standardVariables.flatten as Function,
  filter: standardVariables.filter as Function,
  collect: standardVariables.collect as Function,
  distinct: standardVariables.distinct as Function,
  distinctBy: standardVariables.distinctBy as Function,
  union: standardVariables.union as Function,
  unionBy: standardVariables.unionBy as Function,
  intersection: standardVariables.intersection as Function,
  intersectionBy: standardVariables.intersectionBy as Function,
  difference: standardVariables.difference as Function,
  differenceBy: standardVariables.differenceBy as Function,
  symmetricDifference: standardVariables.symmetricDifference as Function,
  symmetricDifferenceBy: standardVariables.symmetricDifferenceBy as Function,
  isSubsetOf: standardVariables.isSubsetOf as Function,
  isSubsetOfBy: standardVariables.isSubsetOfBy as Function,
  isSupersetOf: standardVariables.isSupersetOf as Function,
  isSupersetOfBy: standardVariables.isSupersetOfBy as Function,
  isDisjointFrom: standardVariables.isDisjointFrom as Function,
  isDisjointFromBy: standardVariables.isDisjointFromBy as Function,
  reduce: standardVariables.reduce as Function,
  match: standardVariables.match as Function,
  replace: standardVariables.replace as Function,
  regex: standardVariables.regex as Function,
  bind: standardVariables.bind as Function,
  url: standardVariables.url as Function,
} as const);

const toSpecializableStandardCallTarget = (
  name: string
): Function | undefined => {
  return specializableStandardCallTargets[
    name as keyof typeof specializableStandardCallTargets
  ];
};

interface FunCitySourceDotSegmentInfo {
  readonly name: string;
  readonly canIgnore: boolean;
  readonly range: FunCityRange;
}

interface FunCitySourceRuntime {
  readonly constants: readonly unknown[];
  readonly standardBuiltins: typeof specializableStandardCallTargets;
  readonly standardIntrinsics: {
    readonly cond: Function;
    readonly defaults: Function;
    readonly fun: Function;
    readonly and: Function;
    readonly or: Function;
    readonly set: Function;
  };
  readonly asIterable: typeof asIterable;
  readonly isConditionalTrue: typeof isConditionalTrue;
  readonly isFunCityFunction: typeof isFunCityFunction;
  readonly throwError: typeof throwError;
  readonly handleApplyError: typeof handleApplyError;
  readonly resolveVariable: typeof resolveSourceVariable;
  readonly resolveDotSegments: typeof resolveSourceDotSegments;
  readonly invokeCallable: typeof invokeSourceCallable;
  readonly invokeBuiltin: typeof invokeSourceBuiltin;
  readonly awaitSync: <T>(value: FunCityMaybePromise<T>) => T;
  readonly requestAsyncFallback: () => never;
}

type FunCitySourceGeneratedRunner<T> = (
  context: FunCityReducerContext,
  signal: AbortSignal | undefined,
  runtime: FunCitySourceRuntime
) => FunCityMaybePromise<T>;

interface FunCityAsyncFunctionConstructor {
  new (...args: string[]): (...args: unknown[]) => Promise<unknown>;
}

interface FunCitySyncFunctionConstructor {
  new (...args: string[]): (...args: unknown[]) => unknown;
}

const AsyncFunction = Object.getPrototypeOf(async () => {})
  .constructor as FunCityAsyncFunctionConstructor;
const SyncFunction = Function as unknown as FunCitySyncFunctionConstructor;
const sourceSyncFallback = Object.freeze({
  kind: 'funcity-source-sync-fallback',
});

const isSourceSyncFallback = (error: unknown): boolean => {
  return error === sourceSyncFallback;
};

const createRawBlockRunnerImmediate = (
  generators: readonly FunCityGeneratedBlockImmediate[]
): FunCityGeneratedBlockImmediate => {
  return (
    context: FunCityReducerContext,
    signal?: AbortSignal
  ): FunCityMaybePromise<unknown[]> => {
    const resultList: unknown[] = [];
    for (let index = 0; index < generators.length; index++) {
      const results = generators[index]!(context, signal);
      if (isPromiseLike(results)) {
        return (async () => {
          resultList.push(...(await results));
          for (
            let continueIndex = index + 1;
            continueIndex < generators.length;
            continueIndex++
          ) {
            resultList.push(
              ...(await generators[continueIndex]!(context, signal))
            );
          }
          return resultList;
        })();
      }
      resultList.push(...results);
    }
    return resultList;
  };
};

const createTextBlockRunnerImmediate = (
  generators: readonly FunCityGeneratedTextBlockImmediate[]
): FunCityGeneratedTextBlockImmediate => {
  return (
    context: FunCityReducerContext,
    signal?: AbortSignal
  ): FunCityMaybePromise<string> => {
    let result = '';
    for (let index = 0; index < generators.length; index++) {
      const text = generators[index]!(context, signal);
      if (isPromiseLike(text)) {
        return (async () => {
          result += await text;
          for (
            let continueIndex = index + 1;
            continueIndex < generators.length;
            continueIndex++
          ) {
            result += await generators[continueIndex]!(context, signal);
          }
          return result;
        })();
      }
      result += text;
    }
    return result;
  };
};

const collectExpressionValues = (
  generators: readonly FunCityGeneratedExpressionImmediate[],
  context: FunCityReducerContext,
  signal: AbortSignal | undefined
): FunCityMaybePromise<unknown[]> => {
  const resultList: unknown[] = [];
  for (let index = 0; index < generators.length; index++) {
    const result = generators[index]!(context, signal);
    if (isPromiseLike(result)) {
      return (async () => {
        resultList.push(await result);
        for (
          let continueIndex = index + 1;
          continueIndex < generators.length;
          continueIndex++
        ) {
          resultList.push(await generators[continueIndex]!(context, signal));
        }
        return resultList;
      })();
    }
    resultList.push(result);
  }
  return resultList;
};

const handleApplyError = (node: FunCityApplyNode, error: unknown): never => {
  if (error instanceof FunCityReducerError) {
    throw error;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    throw error;
  }
  throw new FunCityReducerError({
    type: 'error',
    description: fromError(error),
    range: node.range,
  });
};

const resolveSourceVariable = (
  context: FunCityReducerContext,
  name: string,
  canIgnore: boolean,
  range: FunCityRange,
  signal: AbortSignal | undefined
): unknown => {
  const valueResult = context.getValue(name, signal);
  if (!valueResult.isFound) {
    if (!canIgnore) {
      throwError({
        description: `variable is not bound: ${name}`,
        range,
      });
    }
    return undefined;
  }
  return valueResult.value;
};

const resolveSourceDotSegments = (
  context: FunCityReducerContext,
  baseValue: unknown,
  segments: readonly FunCitySourceDotSegmentInfo[]
): unknown => {
  let value = baseValue;
  let parent: object | undefined;
  for (const segment of segments) {
    if (
      value !== null &&
      (typeof value === 'object' || typeof value === 'function')
    ) {
      const record = value as Record<string, unknown>;
      parent = value as object;
      value = record[segment.name];
      continue;
    }
    if (!segment.canIgnore) {
      throwError({
        description: `variable is not bound: ${segment.name}`,
        range: segment.range,
      });
    }
    return undefined;
  }
  if (parent && typeof value === 'function' && !isFunCityFunction(value)) {
    return context.getBoundFunction(parent, value);
  }
  return value;
};

const invokeSourceCallable = async (
  context: FunCityReducerContext,
  node: FunCityApplyNode,
  signal: AbortSignal | undefined,
  callable: Function,
  args: readonly unknown[],
  isSpecial: boolean
): Promise<unknown> => {
  const shouldConstruct = !isSpecial && context.isConstructable(callable);
  try {
    if (shouldConstruct) {
      return Reflect.construct(callable, args);
    }
    const thisProxy = context.createFunctionContext(node, signal);
    return await callable.call(thisProxy, ...args);
  } catch (error: unknown) {
    return handleApplyError(node, error);
  }
};

const invokeSourceBuiltin = async (
  node: FunCityApplyNode,
  builtin: Function,
  args: readonly unknown[]
): Promise<unknown> => {
  try {
    return await builtin(...args);
  } catch (error: unknown) {
    return handleApplyError(node, error);
  }
};

const awaitSourceSync = <T>(value: FunCityMaybePromise<T>): T => {
  if (isPromiseLike(value)) {
    throw sourceSyncFallback;
  }
  return value;
};

const requestSourceAsyncFallback = (): never => {
  throw sourceSyncFallback;
};

/**
 * Create a dynamic code generator.
 * @returns Dynamic code generator instance.
 */
const createClosureDCodegen = (): FunCityDynamicCodeGenerator => {
  const expressionImmediateCache = new WeakMap<
    FunCityExpressionNode,
    FunCityGeneratedExpressionImmediate
  >();
  const expressionCache = new WeakMap<
    FunCityExpressionNode,
    FunCityGeneratedExpression
  >();
  const blockImmediateCache = new WeakMap<
    FunCityBlockNode,
    FunCityGeneratedBlockImmediate
  >();
  const blockCache = new WeakMap<FunCityBlockNode, FunCityGeneratedBlock>();
  const rawProgramImmediateCache = new WeakMap<
    object,
    FunCityGeneratedBlockImmediate
  >();
  const textBlockImmediateCache = new WeakMap<
    FunCityBlockNode,
    FunCityGeneratedTextBlockImmediate
  >();
  const textProgramImmediateCache = new WeakMap<
    object,
    FunCityGeneratedTextProgramImmediate
  >();
  const textProgramCache = new WeakMap<object, FunCityGeneratedTextProgram>();
  const programImmediateCache = new WeakMap<
    object,
    FunCityGeneratedProgramImmediate
  >();
  const programCache = new WeakMap<object, FunCityGeneratedProgram>();

  const generateRawProgramImmediate = (
    nodes: readonly FunCityBlockNode[]
  ): FunCityGeneratedBlockImmediate => {
    const cached = rawProgramImmediateCache.get(nodes);
    if (cached) {
      return cached;
    }
    const generator = createRawBlockRunnerImmediate(
      nodes.map(generateBlockImmediate)
    );
    rawProgramImmediateCache.set(nodes, generator);
    return generator;
  };

  const generateTextProgramImmediate = (
    nodes: readonly FunCityBlockNode[]
  ): FunCityGeneratedTextProgramImmediate => {
    const cached = textProgramImmediateCache.get(nodes);
    if (cached) {
      return cached;
    }
    const generator = createTextBlockRunnerImmediate(
      nodes.map(generateTextBlockImmediate)
    );
    textProgramImmediateCache.set(nodes, generator);
    return generator;
  };

  const resolveDotNode = (
    context: FunCityReducerContext,
    node: FunCityDotNode,
    signal: AbortSignal | undefined,
    compiledBase: FunCityGeneratedExpressionImmediate | undefined,
    baseResult: DeconstructConditionalCombineResult | undefined
  ): FunCityMaybePromise<unknown> => {
    signal?.throwIfAborted();
    const firstSegmentOptional = node.segments[0]?.optional ?? false;

    const resolveSegments = (baseValue: unknown) => {
      let value = baseValue;
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

    if (baseResult) {
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
      return resolveSegments(valueResult.value);
    }

    if (!compiledBase) {
      return undefined;
    }
    return resolveMaybePromise(compiledBase(context, signal), resolveSegments);
  };

  const applyResolvedFunction = (
    context: FunCityReducerContext,
    node: FunCityApplyNode,
    signal: AbortSignal | undefined,
    callable: Function,
    compiledArgs: readonly FunCityGeneratedExpressionImmediate[]
  ): FunCityMaybePromise<unknown> => {
    const isSpecial = isFunCityFunction(callable);
    const resolvedArgs = isSpecial
      ? node.args
      : collectExpressionValues(compiledArgs, context, signal);

    const invokeCallable = (args: readonly unknown[]) => {
      const shouldConstruct = !isSpecial && context.isConstructable(callable);
      try {
        if (shouldConstruct) {
          return Reflect.construct(callable, args);
        }
        const thisProxy = context.createFunctionContext(node, signal);
        return callable.call(thisProxy, ...args);
      } catch (error: unknown) {
        handleApplyError(node, error);
      }
    };

    const result = resolveMaybePromise(resolvedArgs, (args) =>
      invokeCallable(args as readonly unknown[])
    );
    if (isPromiseLike(result)) {
      return result.catch((error: unknown) => handleApplyError(node, error));
    }
    return result;
  };

  const applySpecializedStandardFunction = (
    context: FunCityReducerContext,
    node: FunCityApplyNode,
    signal: AbortSignal | undefined,
    builtin: Function,
    compiledArgs: readonly FunCityGeneratedExpressionImmediate[]
  ): FunCityMaybePromise<unknown> => {
    const invokeBuiltin = (args: readonly unknown[]) => {
      try {
        return builtin(...args);
      } catch (error: unknown) {
        handleApplyError(node, error);
      }
    };
    const result = resolveMaybePromise(
      collectExpressionValues(compiledArgs, context, signal),
      (args) => invokeBuiltin(args as readonly unknown[])
    );
    if (isPromiseLike(result)) {
      return result.catch((error: unknown) => handleApplyError(node, error));
    }
    return result;
  };

  const applyFunction = (
    context: FunCityReducerContext,
    node: FunCityApplyNode,
    signal: AbortSignal | undefined,
    compiledFunc: FunCityGeneratedExpressionImmediate,
    compiledArgs: readonly FunCityGeneratedExpressionImmediate[]
  ): FunCityMaybePromise<unknown> => {
    signal?.throwIfAborted();
    return resolveMaybePromise(
      compiledFunc(context, signal),
      (func): FunCityMaybePromise<unknown> => {
        if (typeof func !== 'function') {
          throwError({
            description: 'could not apply it for function',
            range: node.range,
          });
        }
        return applyResolvedFunction(
          context,
          node,
          signal,
          func as Function,
          compiledArgs
        );
      }
    );
  };

  const applyLogicalIntrinsic = (
    node: FunCityApplyNode,
    context: FunCityReducerContext,
    signal: AbortSignal | undefined,
    compiledArgs: readonly FunCityGeneratedExpressionImmediate[],
    mode: 'and' | 'or'
  ): FunCityMaybePromise<boolean> => {
    if (compiledArgs.length === 0) {
      throwError({
        description: 'empty arguments',
        range: node.range,
      });
    }
    for (let index = 0; index < compiledArgs.length; index++) {
      const value = compiledArgs[index]!(context, signal);
      if (isPromiseLike(value)) {
        return (async () => {
          if (
            mode === 'and'
              ? !isConditionalTrue(await value)
              : isConditionalTrue(await value)
          ) {
            return mode === 'or';
          }
          for (
            let continueIndex = index + 1;
            continueIndex < compiledArgs.length;
            continueIndex++
          ) {
            const continued = await compiledArgs[continueIndex]!(
              context,
              signal
            );
            if (
              mode === 'and'
                ? !isConditionalTrue(continued)
                : isConditionalTrue(continued)
            ) {
              return mode === 'or';
            }
          }
          return mode === 'and';
        })();
      }
      if (
        mode === 'and' ? !isConditionalTrue(value) : isConditionalTrue(value)
      ) {
        return mode === 'or';
      }
    }
    return mode === 'and';
  };

  const generateExpressionImmediate = (
    node: FunCityExpressionNode
  ): FunCityGeneratedExpressionImmediate => {
    const cached = expressionImmediateCache.get(node);
    if (cached) {
      return cached;
    }

    let generator: FunCityGeneratedExpressionImmediate;
    switch (node.kind) {
      case 'number':
      case 'string': {
        generator = () => node.value;
        break;
      }
      case 'template': {
        const generatedText = generateTextProgramImmediate(node.blocks);
        generator = (context, signal) => generatedText(context, signal);
        break;
      }
      case 'variable': {
        const variableResult = deconstructConditionalCombine(node.name);
        generator = (context, signal) =>
          resolveVariable(context, variableResult, node.range, signal);
        break;
      }
      case 'dot': {
        const compiledBase =
          node.base.kind === 'variable'
            ? undefined
            : generateExpressionImmediate(node.base);
        const baseResult =
          node.base.kind === 'variable'
            ? deconstructConditionalCombine(node.base.name)
            : undefined;
        generator = (context, signal) =>
          resolveDotNode(context, node, signal, compiledBase, baseResult);
        break;
      }
      case 'apply': {
        const compiledFunc = generateExpressionImmediate(node.func);
        const compiledArgs = node.args.map(generateExpressionImmediate);
        const isIntrinsicCond =
          node.func.kind === 'variable' &&
          node.func.name === 'cond' &&
          node.args.length === 3;
        const isIntrinsicDefaults =
          node.func.kind === 'variable' &&
          node.func.name === 'defaults' &&
          node.args.length === 2;
        const intrinsicSetName =
          node.func.kind === 'variable' &&
          node.func.name === 'set' &&
          node.args.length === 2 &&
          node.args[0]!.kind === 'variable'
            ? node.args[0]!.name
            : undefined;
        const intrinsicLogicalMode =
          node.func.kind === 'variable' &&
          (node.func.name === 'and' || node.func.name === 'or')
            ? node.func.name
            : undefined;
        const intrinsicFunParameters =
          node.func.kind === 'variable' &&
          node.func.name === 'fun' &&
          node.args.length === 2
            ? extractLambdaParameterNames(node.args[0]!)
            : undefined;
        const intrinsicFunBody =
          intrinsicFunParameters !== undefined ? node.args[1]! : undefined;
        const compiledIntrinsicFunBody =
          intrinsicFunBody !== undefined
            ? generateExpressionImmediate(intrinsicFunBody)
            : undefined;
        const specializedBuiltinName =
          node.func.kind === 'variable' ? node.func.name : undefined;
        const specializedBuiltin =
          specializedBuiltinName !== undefined
            ? toSpecializableStandardCallTarget(specializedBuiltinName)
            : undefined;
        if (isIntrinsicCond) {
          generator = (context, signal) => {
            const boundFunction = context.getValue('cond', signal);
            if (
              boundFunction.isFound &&
              boundFunction.value === standardVariables.cond
            ) {
              return resolveMaybePromise(
                compiledArgs[0]!(context, signal),
                (condition): FunCityMaybePromise<unknown> =>
                  isConditionalTrue(condition)
                    ? compiledArgs[1]!(context, signal)
                    : compiledArgs[2]!(context, signal)
              );
            }
            return applyFunction(
              context,
              node,
              signal,
              compiledFunc,
              compiledArgs
            );
          };
          break;
        }
        if (isIntrinsicDefaults) {
          generator = (context, signal) => {
            const boundFunction = context.getValue('defaults', signal);
            if (
              boundFunction.isFound &&
              boundFunction.value === standardVariables.defaults
            ) {
              return resolveMaybePromise(
                compiledArgs[0]!(context, signal),
                (value): FunCityMaybePromise<unknown> =>
                  value !== undefined && value !== null
                    ? value
                    : compiledArgs[1]!(context, signal)
              );
            }
            return applyFunction(
              context,
              node,
              signal,
              compiledFunc,
              compiledArgs
            );
          };
          break;
        }
        if (intrinsicSetName !== undefined) {
          generator = (context, signal) => {
            const boundFunction = context.getValue('set', signal);
            if (
              boundFunction.isFound &&
              boundFunction.value === standardVariables.set
            ) {
              return resolveMaybePromise(
                compiledArgs[1]!(context, signal),
                (value): FunCityMaybePromise<unknown> => {
                  context.setValue(intrinsicSetName, value, signal);
                  return undefined;
                }
              );
            }
            return applyFunction(
              context,
              node,
              signal,
              compiledFunc,
              compiledArgs
            );
          };
          break;
        }
        if (intrinsicLogicalMode !== undefined) {
          generator = (context, signal) => {
            const boundFunction = context.getValue(
              intrinsicLogicalMode,
              signal
            );
            const target =
              intrinsicLogicalMode === 'and'
                ? standardVariables.and
                : standardVariables.or;
            if (boundFunction.isFound && boundFunction.value === target) {
              return applyLogicalIntrinsic(
                node,
                context,
                signal,
                compiledArgs,
                intrinsicLogicalMode
              );
            }
            return applyFunction(
              context,
              node,
              signal,
              compiledFunc,
              compiledArgs
            );
          };
          break;
        }
        if (
          compiledIntrinsicFunBody !== undefined &&
          intrinsicFunParameters !== undefined
        ) {
          generator = (context, signal) => {
            const boundFunction = context.getValue('fun', signal);
            if (
              boundFunction.isFound &&
              boundFunction.value === standardVariables.fun
            ) {
              return (...args: readonly unknown[]) => {
                if (args.length < intrinsicFunParameters.length) {
                  throwError({
                    description: `Arguments are not filled: ${args.length} < ${intrinsicFunParameters.length}`,
                    range: node.range,
                  });
                }
                if (args.length > intrinsicFunParameters.length) {
                  context.appendWarning({
                    type: 'warning',
                    description: `Too many arguments: ${args.length} > ${intrinsicFunParameters.length}`,
                    range: node.range,
                  });
                }
                const newContext = context.newCallScope(
                  intrinsicFunParameters,
                  args,
                  signal
                );
                return compiledIntrinsicFunBody(newContext, signal);
              };
            }
            if (specializedBuiltin === undefined) {
              return applyFunction(
                context,
                node,
                signal,
                compiledFunc,
                compiledArgs
              );
            }
            const specializedFunction = context.getValue(
              specializedBuiltinName!,
              signal
            );
            if (
              specializedFunction.isFound &&
              specializedFunction.value === specializedBuiltin
            ) {
              return applySpecializedStandardFunction(
                context,
                node,
                signal,
                specializedBuiltin,
                compiledArgs
              );
            }
            return applyFunction(
              context,
              node,
              signal,
              compiledFunc,
              compiledArgs
            );
          };
          break;
        }
        if (specializedBuiltin === undefined) {
          generator = (context, signal) =>
            applyFunction(context, node, signal, compiledFunc, compiledArgs);
          break;
        }
        generator = (context, signal) => {
          const boundFunction = context.getValue(
            specializedBuiltinName!,
            signal
          );
          if (
            boundFunction.isFound &&
            boundFunction.value === specializedBuiltin
          ) {
            return applySpecializedStandardFunction(
              context,
              node,
              signal,
              specializedBuiltin,
              compiledArgs
            );
          }
          return applyFunction(
            context,
            node,
            signal,
            compiledFunc,
            compiledArgs
          );
        };
        break;
      }
      case 'list': {
        const compiledItems = node.items.map(generateExpressionImmediate);
        generator = (context, signal) =>
          collectExpressionValues(compiledItems, context, signal);
        break;
      }
      case 'scope': {
        const compiledNodes = node.nodes.map(generateExpressionImmediate);
        generator = (
          context: FunCityReducerContext,
          signal?: AbortSignal
        ): FunCityMaybePromise<unknown> => {
          if (compiledNodes.length === 0) {
            return [];
          }
          let result: unknown = undefined;
          for (let index = 0; index < compiledNodes.length; index++) {
            const current = compiledNodes[index]!(context, signal);
            if (isPromiseLike(current)) {
              return (async () => {
                result = await current;
                for (
                  let continueIndex = index + 1;
                  continueIndex < compiledNodes.length;
                  continueIndex++
                ) {
                  result = await compiledNodes[continueIndex]!(context, signal);
                }
                return result;
              })();
            }
            result = current;
          }
          return result;
        };
        break;
      }
    }

    expressionImmediateCache.set(node, generator);
    return generator;
  };

  const generateExpression = (
    node: FunCityExpressionNode
  ): FunCityGeneratedExpression => {
    const cached = expressionCache.get(node);
    if (cached) {
      return cached;
    }
    const immediate = generateExpressionImmediate(node);
    const generator: FunCityGeneratedExpression = (context, signal) =>
      Promise.resolve(immediate(context, signal));
    expressionCache.set(node, generator);
    return generator;
  };

  const generateBlockImmediate = (
    node: FunCityBlockNode
  ): FunCityGeneratedBlockImmediate => {
    const cached = blockImmediateCache.get(node);
    if (cached) {
      return cached;
    }

    let generator: FunCityGeneratedBlockImmediate;
    switch (node.kind) {
      case 'text': {
        generator = () => [node.text];
        break;
      }
      case 'for': {
        const iterableGenerator = generateExpressionImmediate(node.iterable);
        const repeatGenerator = generateRawProgramImmediate(node.repeat);
        generator = (context, signal) =>
          resolveMaybePromise(
            iterableGenerator(context, signal),
            (result): FunCityMaybePromise<unknown[]> => {
              const iterable = asIterable(result);
              if (!iterable) {
                throwError({
                  description: 'could not apply it for function',
                  range: node.range,
                });
              }
              const resolvedIterable = iterable as Iterable<unknown>;
              const resultList: unknown[] = [];
              const iterator = resolvedIterable[Symbol.iterator]();
              for (
                let current = iterator.next();
                !current.done;
                current = iterator.next()
              ) {
                context.setValue(node.bind.name, current.value, signal);
                const repeated = repeatGenerator(context, signal);
                if (isPromiseLike(repeated)) {
                  return (async () => {
                    resultList.push(...(await repeated));
                    for (
                      let next = iterator.next();
                      !next.done;
                      next = iterator.next()
                    ) {
                      context.setValue(node.bind.name, next.value, signal);
                      resultList.push(
                        ...(await repeatGenerator(context, signal))
                      );
                    }
                    return resultList;
                  })();
                }
                resultList.push(...repeated);
              }
              return resultList;
            }
          );
        break;
      }
      case 'while': {
        const conditionGenerator = generateExpressionImmediate(node.condition);
        const repeatGenerator = generateRawProgramImmediate(node.repeat);
        generator = (
          context: FunCityReducerContext,
          signal?: AbortSignal
        ): FunCityMaybePromise<unknown[]> => {
          const resultList: unknown[] = [];
          while (true) {
            const condition = conditionGenerator(context, signal);
            if (isPromiseLike(condition)) {
              return (async () => {
                let currentCondition = await condition;
                while (isConditionalTrue(currentCondition)) {
                  resultList.push(...(await repeatGenerator(context, signal)));
                  currentCondition = await conditionGenerator(context, signal);
                }
                return resultList;
              })();
            }
            if (!isConditionalTrue(condition)) {
              return resultList;
            }
            const repeated = repeatGenerator(context, signal);
            if (isPromiseLike(repeated)) {
              return (async () => {
                resultList.push(...(await repeated));
                while (true) {
                  const currentCondition = await conditionGenerator(
                    context,
                    signal
                  );
                  if (!isConditionalTrue(currentCondition)) {
                    break;
                  }
                  resultList.push(...(await repeatGenerator(context, signal)));
                }
                return resultList;
              })();
            }
            resultList.push(...repeated);
          }
        };
        break;
      }
      case 'if': {
        const conditionGenerator = generateExpressionImmediate(node.condition);
        const thenGenerator = generateRawProgramImmediate(node.then);
        const elseGenerator = generateRawProgramImmediate(node.else);
        generator = (context, signal) =>
          resolveMaybePromise(
            conditionGenerator(context, signal),
            (condition): FunCityMaybePromise<unknown[]> =>
              isConditionalTrue(condition)
                ? thenGenerator(context, signal)
                : elseGenerator(context, signal)
          );
        break;
      }
      default: {
        const expressionGenerator = generateExpressionImmediate(node);
        generator = (context, signal) =>
          resolveMaybePromise(
            expressionGenerator(context, signal),
            (result) => [result]
          );
        break;
      }
    }

    blockImmediateCache.set(node, generator);
    return generator;
  };

  const generateBlock = (node: FunCityBlockNode): FunCityGeneratedBlock => {
    const cached = blockCache.get(node);
    if (cached) {
      return cached;
    }
    const immediate = generateBlockImmediate(node);
    const generator: FunCityGeneratedBlock = (context, signal) =>
      Promise.resolve(immediate(context, signal));
    blockCache.set(node, generator);
    return generator;
  };

  const generateTextBlockImmediate = (
    node: FunCityBlockNode
  ): FunCityGeneratedTextBlockImmediate => {
    const cached = textBlockImmediateCache.get(node);
    if (cached) {
      return cached;
    }

    let generator: FunCityGeneratedTextBlockImmediate;
    switch (node.kind) {
      case 'text': {
        generator = () => node.text;
        break;
      }
      case 'for': {
        const iterableGenerator = generateExpressionImmediate(node.iterable);
        const repeatGenerator = generateTextProgramImmediate(node.repeat);
        generator = (context, signal) =>
          resolveMaybePromise(
            iterableGenerator(context, signal),
            (result): FunCityMaybePromise<string> => {
              const iterable = asIterable(result);
              if (!iterable) {
                throwError({
                  description: 'could not apply it for function',
                  range: node.range,
                });
              }
              const resolvedIterable = iterable as Iterable<unknown>;
              const iterator = resolvedIterable[Symbol.iterator]();
              let text = '';
              for (
                let current = iterator.next();
                !current.done;
                current = iterator.next()
              ) {
                context.setValue(node.bind.name, current.value, signal);
                const repeated = repeatGenerator(context, signal);
                if (isPromiseLike(repeated)) {
                  return (async () => {
                    text += await repeated;
                    for (
                      let next = iterator.next();
                      !next.done;
                      next = iterator.next()
                    ) {
                      context.setValue(node.bind.name, next.value, signal);
                      text += await repeatGenerator(context, signal);
                    }
                    return text;
                  })();
                }
                text += repeated;
              }
              return text;
            }
          );
        break;
      }
      case 'while': {
        const conditionGenerator = generateExpressionImmediate(node.condition);
        const repeatGenerator = generateTextProgramImmediate(node.repeat);
        generator = (
          context: FunCityReducerContext,
          signal?: AbortSignal
        ): FunCityMaybePromise<string> => {
          let text = '';
          while (true) {
            const condition = conditionGenerator(context, signal);
            if (isPromiseLike(condition)) {
              return (async () => {
                let currentCondition = await condition;
                while (isConditionalTrue(currentCondition)) {
                  text += await repeatGenerator(context, signal);
                  currentCondition = await conditionGenerator(context, signal);
                }
                return text;
              })();
            }
            if (!isConditionalTrue(condition)) {
              return text;
            }
            const repeated = repeatGenerator(context, signal);
            if (isPromiseLike(repeated)) {
              return (async () => {
                text += await repeated;
                while (true) {
                  const currentCondition = await conditionGenerator(
                    context,
                    signal
                  );
                  if (!isConditionalTrue(currentCondition)) {
                    break;
                  }
                  text += await repeatGenerator(context, signal);
                }
                return text;
              })();
            }
            text += repeated;
          }
        };
        break;
      }
      case 'if': {
        const conditionGenerator = generateExpressionImmediate(node.condition);
        const thenGenerator = generateTextProgramImmediate(node.then);
        const elseGenerator = generateTextProgramImmediate(node.else);
        generator = (context, signal) =>
          resolveMaybePromise(
            conditionGenerator(context, signal),
            (condition): FunCityMaybePromise<string> =>
              isConditionalTrue(condition)
                ? thenGenerator(context, signal)
                : elseGenerator(context, signal)
          );
        break;
      }
      default: {
        const expressionGenerator = generateExpressionImmediate(node);
        generator = (context, signal) =>
          resolveMaybePromise(expressionGenerator(context, signal), (result) =>
            result === undefined ? '' : context.convertToString(result)
          );
        break;
      }
    }

    textBlockImmediateCache.set(node, generator);
    return generator;
  };

  const generateProgramImmediate = (
    nodes: readonly FunCityBlockNode[]
  ): FunCityGeneratedProgramImmediate => {
    const cached = programImmediateCache.get(nodes);
    if (cached) {
      return cached;
    }
    const generatedBlocks = generateRawProgramImmediate(nodes);
    const generator: FunCityGeneratedProgramImmediate = (context, signal) =>
      resolveMaybePromise(generatedBlocks(context, signal), (results) =>
        filterUndefined(results)
      );
    programImmediateCache.set(nodes, generator);
    return generator;
  };

  const generateProgram = (
    nodes: readonly FunCityBlockNode[]
  ): FunCityGeneratedProgram => {
    const cached = programCache.get(nodes);
    if (cached) {
      return cached;
    }
    const immediate = generateProgramImmediate(nodes);
    const generator: FunCityGeneratedProgram = (context, signal) =>
      Promise.resolve(immediate(context, signal));
    programCache.set(nodes, generator);
    return generator;
  };

  const generateTextProgram = (
    nodes: readonly FunCityBlockNode[]
  ): FunCityGeneratedTextProgram => {
    const cached = textProgramCache.get(nodes);
    if (cached) {
      return cached;
    }
    const immediate = generateTextProgramImmediate(nodes);
    const generator: FunCityGeneratedTextProgram = (context, signal) =>
      Promise.resolve(immediate(context, signal));
    textProgramCache.set(nodes, generator);
    return generator;
  };

  const createExecutor = (): FunCityReducerExecutor => {
    const reduceExpressionNodeImmediate = (
      context: FunCityReducerContext,
      node: FunCityExpressionNode,
      signal: AbortSignal | undefined
    ) => generateExpressionImmediate(node)(context, signal);
    const reduceNodeImmediate = (
      context: FunCityReducerContext,
      node: FunCityBlockNode,
      signal: AbortSignal | undefined
    ) => generateBlockImmediate(node)(context, signal);
    return {
      reduceExpressionNode: (
        context: FunCityReducerContext,
        node: FunCityExpressionNode,
        signal: AbortSignal | undefined
      ) =>
        Promise.resolve(reduceExpressionNodeImmediate(context, node, signal)),
      reduceExpressionNodeImmediate,
      reduceNode: (
        context: FunCityReducerContext,
        node: FunCityBlockNode,
        signal: AbortSignal | undefined
      ) => Promise.resolve(reduceNodeImmediate(context, node, signal)),
      reduceNodeImmediate,
    };
  };

  return {
    generateExpression,
    generateBlock,
    generateProgram,
    generateTextProgram,
    createExecutor,
  };
};

const createSourceRunner = <T>(
  body: string
): FunCitySourceGeneratedRunner<T> => {
  return new AsyncFunction(
    'context',
    'signal',
    'runtime',
    `'use strict';\n${body}`
  ) as FunCitySourceGeneratedRunner<T>;
};

const createSyncSourceRunner = <T>(
  body: string
): FunCitySourceGeneratedRunner<T> => {
  return new SyncFunction(
    'context',
    'signal',
    'runtime',
    `'use strict';\n${body}`
  ) as FunCitySourceGeneratedRunner<T>;
};

const stripAbortChecksFromSource = (body: string): string => {
  return body.replace(/(^|\n)signal\?\.throwIfAborted\(\);\n?/g, '$1');
};

const createAdaptiveSourceRunner = <T>(
  body: string
): FunCitySourceGeneratedRunner<T> => {
  const runnerWithSignal = createSourceRunner<T>(body);
  const runnerWithoutSignal = createSourceRunner<T>(
    stripAbortChecksFromSource(body)
  );
  return (context, signal, runtime) =>
    signal === undefined
      ? runnerWithoutSignal(context, undefined, runtime)
      : runnerWithSignal(context, signal, runtime);
};

const createSyncPreferredSourceRunner = <T>(options: {
  readonly asyncBody: string;
  readonly asyncRuntime: FunCitySourceRuntime;
  readonly syncBody: string | undefined;
  readonly syncRuntime: FunCitySourceRuntime | undefined;
}) => {
  const asyncRunner = createAdaptiveSourceRunner<T>(options.asyncBody);
  if (options.syncBody === undefined || options.syncRuntime === undefined) {
    return (context: FunCityReducerContext, signal?: AbortSignal) =>
      Promise.resolve(asyncRunner(context, signal, options.asyncRuntime));
  }
  const syncRunnerWithSignal = createSyncSourceRunner<T>(options.syncBody);
  const syncRunnerWithoutSignal = createSyncSourceRunner<T>(
    stripAbortChecksFromSource(options.syncBody)
  );
  return (context: FunCityReducerContext, signal?: AbortSignal) => {
    try {
      return signal === undefined
        ? Promise.resolve(
            syncRunnerWithoutSignal(
              context,
              undefined,
              options.syncRuntime as FunCitySourceRuntime
            )
          )
        : Promise.resolve(
            syncRunnerWithSignal(
              context,
              signal,
              options.syncRuntime as FunCitySourceRuntime
            )
          );
    } catch (error) {
      if (!isSourceSyncFallback(error)) {
        throw error;
      }
    }
    return Promise.resolve(asyncRunner(context, signal, options.asyncRuntime));
  };
};

const createSourceDCodegen = (): FunCityDynamicCodeGenerator => {
  const closureGenerator = createClosureDCodegen();
  const closureExecutor = closureGenerator.createExecutor();

  const expressionCache = new WeakMap<
    FunCityExpressionNode,
    FunCityGeneratedExpression
  >();
  const blockCache = new WeakMap<FunCityBlockNode, FunCityGeneratedBlock>();
  const programCache = new WeakMap<object, FunCityGeneratedProgram>();
  const textProgramCache = new WeakMap<object, FunCityGeneratedTextProgram>();

  interface SourceCompileState {
    nextTempId: number;
    constants: unknown[];
    mode: 'async' | 'sync';
  }

  interface SourceCompileScope {
    readonly localSlots: ReadonlyMap<string, string>;
    readonly directLocals: ReadonlyMap<string, string>;
    readonly selfBindings: ReadonlyMap<string, string>;
  }

  const addConstant = (state: SourceCompileState, value: unknown): number => {
    const index = state.constants.length;
    state.constants.push(value);
    return index;
  };

  const allocateTemp = (state: SourceCompileState, prefix: string): string => {
    return `__${prefix}${state.nextTempId++}`;
  };

  const emptyCompileScope: SourceCompileScope = {
    localSlots: new Map(),
    directLocals: new Map(),
    selfBindings: new Map(),
  };

  const extendCompileScope = (
    scope: SourceCompileScope,
    name: string,
    slotVar: string
  ): SourceCompileScope => {
    return {
      localSlots: new Map(scope.localSlots).set(name, slotVar),
      directLocals: scope.directLocals,
      selfBindings: scope.selfBindings,
    };
  };

  const extendDirectLocalCompileScope = (
    scope: SourceCompileScope,
    name: string,
    localRef: string
  ): SourceCompileScope => {
    return {
      localSlots: scope.localSlots,
      directLocals: new Map(scope.directLocals).set(name, localRef),
      selfBindings: scope.selfBindings,
    };
  };

  const extendSelfBindingCompileScope = (
    scope: SourceCompileScope,
    name: string,
    bindingRef: string
  ): SourceCompileScope => {
    return {
      localSlots: scope.localSlots,
      directLocals: scope.directLocals,
      selfBindings: new Map(scope.selfBindings).set(name, bindingRef),
    };
  };

  const resolveLocalSlotRef = (
    scope: SourceCompileScope,
    name: string
  ): string | undefined => {
    return scope.localSlots.get(name);
  };

  const resolveDirectLocalRef = (
    scope: SourceCompileScope,
    name: string
  ): string | undefined => {
    return scope.directLocals.get(name);
  };

  const resolveSelfBindingRef = (
    scope: SourceCompileScope,
    name: string
  ): string | undefined => {
    return scope.selfBindings.get(name);
  };

  const createLookupResultSource = (
    scope: SourceCompileScope,
    name: string
  ): string => {
    const directLocalRef = resolveDirectLocalRef(scope, name);
    const localSlotRef = resolveLocalSlotRef(scope, name);
    if (directLocalRef !== undefined) {
      return `{ isFound: true, value: ${directLocalRef} }`;
    }
    return localSlotRef !== undefined
      ? `{ isFound: true, value: context.getSlotValue(${localSlotRef}, signal) }`
      : `context.getValue(${JSON.stringify(name)}, signal)`;
  };

  const canElideLambdaFrame = (node: FunCityExpressionNode): boolean => {
    switch (node.kind) {
      case 'number':
      case 'string':
      case 'variable': {
        return true;
      }
      case 'template': {
        return false;
      }
      case 'dot': {
        return canElideLambdaFrame(node.base);
      }
      case 'apply': {
        if (node.func.kind === 'variable') {
          if (node.func.name === 'set' || node.func.name === 'fun') {
            return false;
          }
        }
        return (
          canElideLambdaFrame(node.func) &&
          node.args.every((arg) => canElideLambdaFrame(arg))
        );
      }
      case 'list': {
        return node.items.every((item) => canElideLambdaFrame(item));
      }
      case 'scope': {
        return node.nodes.every((childNode) => canElideLambdaFrame(childNode));
      }
    }
  };

  const canExpressionSuspend = (node: FunCityExpressionNode): boolean => {
    switch (node.kind) {
      case 'number':
      case 'string':
      case 'variable': {
        return false;
      }
      case 'template': {
        return canBlockListSuspend(node.blocks);
      }
      case 'dot': {
        return canExpressionSuspend(node.base);
      }
      case 'apply': {
        return true;
      }
      case 'list': {
        return node.items.some((item) => canExpressionSuspend(item));
      }
      case 'scope': {
        return node.nodes.some((childNode) => canExpressionSuspend(childNode));
      }
    }
  };

  const hasSyncInlineStandardBuiltin = (name: string): boolean => {
    return (
      compileInlineStandardBuiltinSource(name, [
        '__arg0',
        '__arg1',
        '__arg2',
      ]) !== undefined
    );
  };

  const canCompileSyncExpressionSource = (
    node: FunCityExpressionNode,
    scope: SourceCompileScope
  ): boolean => {
    switch (node.kind) {
      case 'number':
      case 'string':
      case 'variable': {
        return true;
      }
      case 'template': {
        return canCompileSyncBlockListSource(node.blocks, scope);
      }
      case 'dot': {
        return canCompileSyncExpressionSource(node.base, scope);
      }
      case 'list': {
        return node.items.every((item) =>
          canCompileSyncExpressionSource(item, scope)
        );
      }
      case 'scope': {
        return node.nodes.every((childNode) =>
          canCompileSyncExpressionSource(childNode, scope)
        );
      }
      case 'apply': {
        if (node.func.kind !== 'variable') {
          return false;
        }
        if (resolveSelfBindingRef(scope, node.func.name) !== undefined) {
          return node.args.every((arg) =>
            canCompileSyncExpressionSource(arg, scope)
          );
        }
        if (
          resolveDirectLocalRef(scope, node.func.name) !== undefined ||
          resolveLocalSlotRef(scope, node.func.name) !== undefined
        ) {
          return false;
        }
        switch (node.func.name) {
          case 'cond': {
            return (
              node.args.length === 3 &&
              node.args.every((arg) =>
                canCompileSyncExpressionSource(arg, scope)
              )
            );
          }
          case 'defaults': {
            return (
              node.args.length === 2 &&
              node.args.every((arg) =>
                canCompileSyncExpressionSource(arg, scope)
              )
            );
          }
          case 'and':
          case 'or': {
            return node.args.every((arg) =>
              canCompileSyncExpressionSource(arg, scope)
            );
          }
          case 'set': {
            if (node.args.length !== 2 || node.args[0]!.kind !== 'variable') {
              return false;
            }
            if (
              node.args[1]!.kind === 'apply' &&
              node.args[1]!.func.kind === 'variable' &&
              node.args[1]!.func.name === 'fun' &&
              node.args[1]!.args.length === 2
            ) {
              const parameterNames = extractLambdaParameterNames(
                node.args[1]!.args[0]!
              );
              if (parameterNames === undefined) {
                return false;
              }
              let lambdaScope = parameterNames.reduce(
                (currentScope, parameterName, index) =>
                  extendDirectLocalCompileScope(
                    currentScope,
                    parameterName,
                    `__syncParam${index}`
                  ),
                scope
              );
              lambdaScope = extendSelfBindingCompileScope(
                lambdaScope,
                node.args[0]!.name,
                '__syncSelf'
              );
              return canCompileSyncExpressionSource(
                node.args[1]!.args[1]!,
                lambdaScope
              );
            }
            return canCompileSyncExpressionSource(node.args[1]!, scope);
          }
          case 'fun': {
            if (node.args.length !== 2) {
              return false;
            }
            const parameterNames = extractLambdaParameterNames(node.args[0]!);
            if (parameterNames === undefined) {
              return false;
            }
            const lambdaScope = parameterNames.reduce(
              (currentScope, parameterName, index) =>
                extendDirectLocalCompileScope(
                  currentScope,
                  parameterName,
                  `__syncParam${index}`
                ),
              scope
            );
            return canCompileSyncExpressionSource(node.args[1]!, lambdaScope);
          }
          default: {
            return (
              toSpecializableStandardCallTarget(node.func.name) !== undefined &&
              hasSyncInlineStandardBuiltin(node.func.name) &&
              node.args.every((arg) =>
                canCompileSyncExpressionSource(arg, scope)
              )
            );
          }
        }
      }
    }
  };

  const canCompileSyncBlockSource = (
    node: FunCityBlockNode,
    scope: SourceCompileScope
  ): boolean => {
    switch (node.kind) {
      case 'text': {
        return true;
      }
      case 'for': {
        const repeatScope = extendDirectLocalCompileScope(
          scope,
          node.bind.name,
          '__syncItem'
        );
        return (
          canCompileSyncExpressionSource(node.iterable, scope) &&
          canCompileSyncBlockListSource(node.repeat, repeatScope)
        );
      }
      case 'while': {
        return (
          canCompileSyncExpressionSource(node.condition, scope) &&
          canCompileSyncBlockListSource(node.repeat, scope)
        );
      }
      case 'if': {
        return (
          canCompileSyncExpressionSource(node.condition, scope) &&
          canCompileSyncBlockListSource(node.then, scope) &&
          canCompileSyncBlockListSource(node.else, scope)
        );
      }
      default: {
        return canCompileSyncExpressionSource(node, scope);
      }
    }
  };

  const canCompileSyncBlockListSource = (
    nodes: readonly FunCityBlockNode[],
    scope: SourceCompileScope
  ): boolean => {
    return nodes.every((node) => canCompileSyncBlockSource(node, scope));
  };

  const canBlockSuspend = (node: FunCityBlockNode): boolean => {
    switch (node.kind) {
      case 'text': {
        return false;
      }
      case 'for': {
        return (
          canExpressionSuspend(node.iterable) ||
          canBlockListSuspend(node.repeat)
        );
      }
      case 'while': {
        return (
          canExpressionSuspend(node.condition) ||
          canBlockListSuspend(node.repeat)
        );
      }
      case 'if': {
        return (
          canExpressionSuspend(node.condition) ||
          canBlockListSuspend(node.then) ||
          canBlockListSuspend(node.else)
        );
      }
      default: {
        return canExpressionSuspend(node);
      }
    }
  };

  const canBlockListSuspend = (nodes: readonly FunCityBlockNode[]): boolean => {
    return nodes.some((node) => canBlockSuspend(node));
  };

  const wrapAwaitedSource = (
    state: SourceCompileState,
    source: string,
    canSuspend: boolean
  ): string => {
    if (state.mode === 'sync') {
      return canSuspend ? `runtime.awaitSync(${source})` : `(${source})`;
    }
    return canSuspend ? `await (${source})` : `(${source})`;
  };

  const wrapSourceClosure = (
    state: SourceCompileState,
    body: string,
    canSuspend: boolean
  ): string => {
    if (state.mode === 'sync') {
      return `(() => {\n${body}\n})()`;
    }
    return canSuspend
      ? `(async () => {\n${body}\n})()`
      : `(() => {\n${body}\n})()`;
  };

  const getBuiltinArgSource = (
    argVars: readonly string[],
    index: number
  ): string => {
    return argVars[index] ?? 'undefined';
  };

  const compileNumericFoldSource = (
    argVars: readonly string[],
    operator: '+' | '-' | '*' | '/' | '%'
  ): string => {
    const initial = `Number(${getBuiltinArgSource(argVars, 0)})`;
    return argVars
      .slice(1)
      .reduce(
        (expression, argVar) => `(${expression} ${operator} Number(${argVar}))`,
        initial
      );
  };

  const compileInlineStandardBuiltinSource = (
    name: string,
    argVars: readonly string[]
  ): string | undefined => {
    switch (name) {
      case 'toString': {
        return `[${argVars.map((argVar) => `context.convertToString(${argVar})`).join(', ')}].join(',')`;
      }
      case 'toBoolean': {
        return `runtime.isConditionalTrue(${getBuiltinArgSource(argVars, 0)})`;
      }
      case 'toNumber': {
        return `Number(${getBuiltinArgSource(argVars, 0)})`;
      }
      case 'toBigInt': {
        const argSource = getBuiltinArgSource(argVars, 0);
        return `(() => {
const __value = ${argSource};
switch (typeof __value) {
case 'number':
case 'bigint':
case 'string':
case 'boolean':
return BigInt(__value);
default:
return BigInt(context.convertToString(__value));
}
})()`;
      }
      case 'typeof': {
        const argSource = getBuiltinArgSource(argVars, 0);
        return `(() => {
const __value = ${argSource};
if (__value === null) {
return 'null';
}
if (typeof __value === 'string') {
return 'string';
}
if (Array.isArray(__value)) {
return 'array';
}
if (runtime.asIterable(__value)) {
return 'iterable';
}
return typeof __value;
})()`;
      }
      case 'add': {
        return compileNumericFoldSource(argVars, '+');
      }
      case 'sub': {
        return compileNumericFoldSource(argVars, '-');
      }
      case 'mul': {
        return compileNumericFoldSource(argVars, '*');
      }
      case 'div': {
        return compileNumericFoldSource(argVars, '/');
      }
      case 'mod': {
        return compileNumericFoldSource(argVars, '%');
      }
      case 'eq': {
        return `(${getBuiltinArgSource(argVars, 0)} === ${getBuiltinArgSource(argVars, 1)})`;
      }
      case 'ne': {
        return `(${getBuiltinArgSource(argVars, 0)} !== ${getBuiltinArgSource(argVars, 1)})`;
      }
      case 'lt': {
        return `(${getBuiltinArgSource(argVars, 0)} < ${getBuiltinArgSource(argVars, 1)})`;
      }
      case 'gt': {
        return `(${getBuiltinArgSource(argVars, 0)} > ${getBuiltinArgSource(argVars, 1)})`;
      }
      case 'le': {
        return `(${getBuiltinArgSource(argVars, 0)} <= ${getBuiltinArgSource(argVars, 1)})`;
      }
      case 'ge': {
        return `(${getBuiltinArgSource(argVars, 0)} >= ${getBuiltinArgSource(argVars, 1)})`;
      }
      case 'not': {
        return `(!runtime.isConditionalTrue(${getBuiltinArgSource(argVars, 0)}))`;
      }
      case 'trim': {
        const argSource = getBuiltinArgSource(argVars, 0);
        return `(() => {
let __value = ${argSource};
if (__value === undefined || __value === null) {
__value = '';
} else if (typeof __value !== 'string') {
__value = __value.toString() ?? '';
}
return __value.trim();
})()`;
      }
      case 'toUpper': {
        const argSource = getBuiltinArgSource(argVars, 0);
        return `(() => {
let __value = ${argSource};
if (typeof __value !== 'string') {
__value = __value.toString() ?? '';
}
return __value.toUpperCase();
})()`;
      }
      case 'toLower': {
        const argSource = getBuiltinArgSource(argVars, 0);
        return `(() => {
let __value = ${argSource};
if (typeof __value !== 'string') {
__value = __value.toString() ?? '';
}
return __value.toLowerCase();
})()`;
      }
      case 'length': {
        const argSource = getBuiltinArgSource(argVars, 0);
        return `(() => {
const __value = ${argSource};
if (!__value) {
return 0;
}
if (typeof __value === 'string' || Array.isArray(__value)) {
return __value.length;
}
const __iterable = runtime.asIterable(__value);
if (!__iterable) {
return 0;
}
let __count = 0;
for (const __item of __iterable) {
__count++;
}
return __count;
})()`;
      }
      case 'at': {
        const indexSource = getBuiltinArgSource(argVars, 0);
        const valueSource = getBuiltinArgSource(argVars, 1);
        return `(() => {
const __index = Number(${indexSource});
const __value = ${valueSource};
if (!__value) {
return undefined;
}
if (typeof __value === 'string' || Array.isArray(__value)) {
return __value[__index];
}
const __iterable = runtime.asIterable(__value);
if (!__iterable) {
return undefined;
}
let __current = 0;
for (const __item of __iterable) {
if (__current >= __index) {
return __item;
}
__current++;
}
return undefined;
})()`;
      }
      case 'first': {
        const argSource = getBuiltinArgSource(argVars, 0);
        return `(() => {
const __value = ${argSource};
if (!__value) {
return undefined;
}
if (typeof __value === 'string' || Array.isArray(__value)) {
return __value[0];
}
const __iterable = runtime.asIterable(__value);
if (!__iterable) {
return undefined;
}
for (const __item of __iterable) {
return __item;
}
return undefined;
})()`;
      }
      case 'last': {
        const argSource = getBuiltinArgSource(argVars, 0);
        return `(() => {
const __value = ${argSource};
if (!__value) {
return undefined;
}
if (typeof __value === 'string' || Array.isArray(__value)) {
return __value[__value.length - 1];
}
const __iterable = runtime.asIterable(__value);
if (!__iterable) {
return undefined;
}
let __lastItem = undefined;
for (const __item of __iterable) {
__lastItem = __item;
}
return __lastItem;
})()`;
      }
      case 'slice': {
        const startSource = getBuiltinArgSource(argVars, 0);
        const middleSource = getBuiltinArgSource(argVars, 1);
        const tailSource = getBuiltinArgSource(argVars, 2);
        return `(() => {
const __start = ${startSource} === undefined ? undefined : Number(${startSource});
if (${tailSource} === undefined) {
const __value = ${middleSource};
if (typeof __value === 'string') {
return __value.slice(__start);
}
return Array.from(__value).slice(__start, undefined);
}
const __end = ${middleSource} === undefined ? undefined : Number(${middleSource});
const __value = ${tailSource};
if (typeof __value === 'string') {
return __value.slice(__start, __end);
}
return Array.from(__value).slice(__start, __end);
})()`;
      }
      default: {
        return undefined;
      }
    }
  };

  const toNumberLiteral = (
    state: SourceCompileState,
    value: number
  ): string => {
    if (Object.is(value, -0)) {
      return '-0';
    }
    if (Number.isFinite(value)) {
      return String(value);
    }
    return `runtime.constants[${addConstant(state, value)}]`;
  };

  const createRuntime = (
    constants: readonly unknown[]
  ): FunCitySourceRuntime => {
    return {
      constants,
      standardBuiltins: specializableStandardCallTargets,
      standardIntrinsics: {
        cond: standardVariables.cond as Function,
        defaults: standardVariables.defaults as Function,
        fun: standardVariables.fun as Function,
        and: standardVariables.and as Function,
        or: standardVariables.or as Function,
        set: standardVariables.set as Function,
      },
      asIterable,
      isConditionalTrue,
      isFunCityFunction,
      throwError,
      handleApplyError,
      resolveVariable: resolveSourceVariable,
      resolveDotSegments: resolveSourceDotSegments,
      invokeCallable: invokeSourceCallable,
      invokeBuiltin: invokeSourceBuiltin,
      awaitSync: awaitSourceSync,
      requestAsyncFallback: requestSourceAsyncFallback,
    };
  };

  const compileBlockStatements = (
    state: SourceCompileState,
    node: FunCityBlockNode,
    targetVar: string,
    filterUndefinedValues: boolean,
    scope: SourceCompileScope
  ): string => {
    switch (node.kind) {
      case 'text': {
        return `${targetVar}.push(${JSON.stringify(node.text)});\n`;
      }
      case 'for': {
        const iterableVar = allocateTemp(state, 'iterable');
        const slotVar = allocateTemp(state, 'slot');
        const itemVar = allocateTemp(state, 'item');
        const rangeIndex = addConstant(state, node.range);
        const iterableSource = compileExpressionSource(
          state,
          node.iterable,
          scope
        );
        return `{
const ${iterableVar} = runtime.asIterable(${wrapAwaitedSource(
          state,
          iterableSource,
          canExpressionSuspend(node.iterable)
        )});
if (!${iterableVar}) {
runtime.throwError({ description: 'could not apply it for function', range: runtime.constants[${rangeIndex}] });
}
const ${slotVar} = context.ensureLocalSlot(${JSON.stringify(
          node.bind.name
        )}, signal);
for (const ${itemVar} of ${iterableVar}) {
context.setSlotValue(${slotVar}, ${itemVar}, signal);
${compileBlockListStatements(
  state,
  node.repeat,
  targetVar,
  filterUndefinedValues,
  extendCompileScope(scope, node.bind.name, slotVar)
)}
}
}\n`;
      }
      case 'while': {
        const conditionSource = compileExpressionSource(
          state,
          node.condition,
          scope
        );
        return `while (runtime.isConditionalTrue(${wrapAwaitedSource(
          state,
          conditionSource,
          canExpressionSuspend(node.condition)
        )})) {
${compileBlockListStatements(
  state,
  node.repeat,
  targetVar,
  filterUndefinedValues,
  scope
)}
}\n`;
      }
      case 'if': {
        const conditionSource = compileExpressionSource(
          state,
          node.condition,
          scope
        );
        return `if (runtime.isConditionalTrue(${wrapAwaitedSource(
          state,
          conditionSource,
          canExpressionSuspend(node.condition)
        )})) {
${compileBlockListStatements(
  state,
  node.then,
  targetVar,
  filterUndefinedValues,
  scope
)}
} else {
${compileBlockListStatements(
  state,
  node.else,
  targetVar,
  filterUndefinedValues,
  scope
)}
}\n`;
      }
      default: {
        const valueVar = allocateTemp(state, 'value');
        const valueSource = compileExpressionSource(state, node, scope);
        return `{
const ${valueVar} = ${wrapAwaitedSource(
          state,
          valueSource,
          canExpressionSuspend(node)
        )};
${
  filterUndefinedValues
    ? `if (${valueVar} !== undefined) { ${targetVar}.push(${valueVar}); }`
    : `${targetVar}.push(${valueVar});`
}
}\n`;
      }
    }
  };

  const compileBlockListStatements = (
    state: SourceCompileState,
    nodes: readonly FunCityBlockNode[],
    targetVar: string,
    filterUndefinedValues: boolean,
    scope: SourceCompileScope
  ): string => {
    return nodes
      .map((node) =>
        compileBlockStatements(
          state,
          node,
          targetVar,
          filterUndefinedValues,
          scope
        )
      )
      .join('');
  };

  const compileTextBlockStatements = (
    state: SourceCompileState,
    node: FunCityBlockNode,
    targetVar: string,
    scope: SourceCompileScope
  ): string => {
    switch (node.kind) {
      case 'text': {
        return `${targetVar} += ${JSON.stringify(node.text)};\n`;
      }
      case 'for': {
        const iterableVar = allocateTemp(state, 'iterable');
        const slotVar = allocateTemp(state, 'slot');
        const itemVar = allocateTemp(state, 'item');
        const rangeIndex = addConstant(state, node.range);
        const iterableSource = compileExpressionSource(
          state,
          node.iterable,
          scope
        );
        return `{
const ${iterableVar} = runtime.asIterable(${wrapAwaitedSource(
          state,
          iterableSource,
          canExpressionSuspend(node.iterable)
        )});
if (!${iterableVar}) {
runtime.throwError({ description: 'could not apply it for function', range: runtime.constants[${rangeIndex}] });
}
const ${slotVar} = context.ensureLocalSlot(${JSON.stringify(
          node.bind.name
        )}, signal);
for (const ${itemVar} of ${iterableVar}) {
context.setSlotValue(${slotVar}, ${itemVar}, signal);
${compileTextBlockListStatements(
  state,
  node.repeat,
  targetVar,
  extendCompileScope(scope, node.bind.name, slotVar)
)}
}
}\n`;
      }
      case 'while': {
        const conditionSource = compileExpressionSource(
          state,
          node.condition,
          scope
        );
        return `while (runtime.isConditionalTrue(${wrapAwaitedSource(
          state,
          conditionSource,
          canExpressionSuspend(node.condition)
        )})) {
${compileTextBlockListStatements(state, node.repeat, targetVar, scope)}
}\n`;
      }
      case 'if': {
        const conditionSource = compileExpressionSource(
          state,
          node.condition,
          scope
        );
        return `if (runtime.isConditionalTrue(${wrapAwaitedSource(
          state,
          conditionSource,
          canExpressionSuspend(node.condition)
        )})) {
${compileTextBlockListStatements(state, node.then, targetVar, scope)}
} else {
${compileTextBlockListStatements(state, node.else, targetVar, scope)}
}\n`;
      }
      default: {
        const valueVar = allocateTemp(state, 'value');
        const valueSource = compileExpressionSource(state, node, scope);
        return `{
const ${valueVar} = ${wrapAwaitedSource(
          state,
          valueSource,
          canExpressionSuspend(node)
        )};
if (${valueVar} !== undefined) {
${targetVar} += context.convertToString(${valueVar});
}
}\n`;
      }
    }
  };

  const compileTextBlockListStatements = (
    state: SourceCompileState,
    nodes: readonly FunCityBlockNode[],
    targetVar: string,
    scope: SourceCompileScope
  ): string => {
    return nodes
      .map((node) => compileTextBlockStatements(state, node, targetVar, scope))
      .join('');
  };

  const compileIntrinsicLambdaSource = (
    state: SourceCompileState,
    lambdaRange: FunCityRange,
    parameterNames: readonly string[],
    bodyNode: FunCityExpressionNode,
    scope: SourceCompileScope,
    selfBinding:
      | {
          readonly name: string;
          readonly bindingRef: string;
        }
      | undefined
  ): string => {
    const lambdaArgsVar = allocateTemp(state, 'args');
    const rangeIndex = addConstant(state, lambdaRange);
    const canElideFrame = canElideLambdaFrame(bodyNode);
    const scopedBase =
      selfBinding === undefined
        ? scope
        : extendSelfBindingCompileScope(
            scope,
            selfBinding.name,
            selfBinding.bindingRef
          );
    if (canElideFrame) {
      const directParameterRefs = new Map<string, string>();
      for (let index = 0; index < parameterNames.length; index++) {
        directParameterRefs.set(
          parameterNames[index]!,
          `${lambdaArgsVar}[${index}]`
        );
      }
      const lambdaScope = Array.from(directParameterRefs.entries()).reduce(
        (currentScope, [parameterName, localRef]) =>
          extendDirectLocalCompileScope(currentScope, parameterName, localRef),
        scopedBase
      );
      const bodySource = compileExpressionSource(state, bodyNode, lambdaScope);
      return `(...${lambdaArgsVar}) => {
if (${lambdaArgsVar}.length < ${parameterNames.length}) {
runtime.throwError({ description: 'Arguments are not filled: ' + ${lambdaArgsVar}.length + ' < ${parameterNames.length}', range: runtime.constants[${rangeIndex}] });
}
if (${lambdaArgsVar}.length > ${parameterNames.length}) {
context.appendWarning({ type: 'warning', description: 'Too many arguments: ' + ${lambdaArgsVar}.length + ' > ${parameterNames.length}', range: runtime.constants[${rangeIndex}] });
}
return ${bodySource};
}`;
    }
    const lambdaContextVar = allocateTemp(state, 'context');
    const parameterNamesIndex = addConstant(state, [...parameterNames]);
    const parameterSlotRefs = new Map<string, string>();
    for (const parameterName of parameterNames) {
      if (!parameterSlotRefs.has(parameterName)) {
        parameterSlotRefs.set(parameterName, String(parameterSlotRefs.size));
      }
    }
    const lambdaScope = Array.from(parameterSlotRefs.entries()).reduce(
      (currentScope, [parameterName, slotRef]) =>
        extendCompileScope(currentScope, parameterName, slotRef),
      scopedBase
    );
    const bodySource = compileExpressionSource(state, bodyNode, lambdaScope);
    return `(...${lambdaArgsVar}) => {
if (${lambdaArgsVar}.length < ${parameterNames.length}) {
runtime.throwError({ description: 'Arguments are not filled: ' + ${lambdaArgsVar}.length + ' < ${parameterNames.length}', range: runtime.constants[${rangeIndex}] });
}
if (${lambdaArgsVar}.length > ${parameterNames.length}) {
context.appendWarning({ type: 'warning', description: 'Too many arguments: ' + ${lambdaArgsVar}.length + ' > ${parameterNames.length}', range: runtime.constants[${rangeIndex}] });
}
const ${lambdaContextVar} = context.newCallScope(runtime.constants[${parameterNamesIndex}], ${lambdaArgsVar}, signal);
return ((context) => {
return ${bodySource};
})(${lambdaContextVar});
}`;
  };

  const compileLogicalIntrinsicSource = (
    state: SourceCompileState,
    node: FunCityApplyNode,
    scope: SourceCompileScope,
    mode: 'and' | 'or'
  ): string => {
    const bindingVar = allocateTemp(state, 'binding');
    if (node.args.length === 0) {
      return wrapSourceClosure(
        state,
        `signal?.throwIfAborted();
const ${bindingVar} = ${createLookupResultSource(scope, JSON.stringify(mode))};
if (${bindingVar}.isFound && ${bindingVar}.value === runtime.standardIntrinsics.${mode}) {
runtime.throwError({ description: 'empty arguments', range: runtime.constants[${addConstant(
          state,
          node.range
        )}] });
}
return ${compileGenericApplySource(state, node, scope)};`,
        true
      );
    }

    const bodyStatements = node.args
      .map((arg) => {
        const valueVar = allocateTemp(state, 'value');
        const argSource = compileExpressionSource(state, arg, scope);
        const awaitedSource = wrapAwaitedSource(
          state,
          argSource,
          canExpressionSuspend(arg)
        );
        if (mode === 'and') {
          return `const ${valueVar} = ${awaitedSource};
if (!runtime.isConditionalTrue(${valueVar})) {
return false;
}`;
        }
        return `const ${valueVar} = ${awaitedSource};
if (runtime.isConditionalTrue(${valueVar})) {
return true;
}`;
      })
      .join('\n');
    return wrapSourceClosure(
      state,
      `signal?.throwIfAborted();
const ${bindingVar} = ${createLookupResultSource(scope, JSON.stringify(mode))};
if (${bindingVar}.isFound && ${bindingVar}.value === runtime.standardIntrinsics.${mode}) {
${bodyStatements}
return ${mode === 'and' ? 'true' : 'false'};
}
return ${compileGenericApplySource(state, node, scope)};`,
      true
    );
  };

  const compileGenericApplySource = (
    state: SourceCompileState,
    node: FunCityApplyNode,
    scope: SourceCompileScope
  ): string => {
    const applyNodeIndex = addConstant(state, node);
    const rangeIndex = addConstant(state, node.range);
    const argsNodeIndex = addConstant(state, node.args);
    const argArraySource = `[${node.args
      .map((arg) =>
        wrapAwaitedSource(
          state,
          compileExpressionSource(state, arg, scope),
          canExpressionSuspend(arg)
        )
      )
      .join(', ')}]`;
    if (node.func.kind === 'variable') {
      const specializedBuiltin = toSpecializableStandardCallTarget(
        node.func.name
      );
      if (specializedBuiltin !== undefined) {
        const bindingVar = allocateTemp(state, 'binding');
        const builtinArgVars = node.args.map(() => allocateTemp(state, 'arg'));
        const inlineBuiltinSource = compileInlineStandardBuiltinSource(
          node.func.name,
          builtinArgVars
        );
        if (state.mode === 'sync') {
          if (inlineBuiltinSource === undefined) {
            return 'runtime.requestAsyncFallback()';
          }
          const builtinArgStatements = node.args
            .map((arg, index) => {
              const argSource = compileExpressionSource(state, arg, scope);
              return `const ${builtinArgVars[index]} = ${wrapAwaitedSource(
                state,
                argSource,
                canExpressionSuspend(arg)
              )};`;
            })
            .join('\n');
          return wrapSourceClosure(
            state,
            `signal?.throwIfAborted();
const ${bindingVar} = ${createLookupResultSource(scope, node.func.name)};
if (${bindingVar}.isFound && ${bindingVar}.value === runtime.standardBuiltins.${node.func.name}) {
${builtinArgStatements}
try {
return ${inlineBuiltinSource};
} catch (error) {
return runtime.handleApplyError(runtime.constants[${applyNodeIndex}], error);
}
}
return runtime.requestAsyncFallback();`,
            node.args.some((arg) => canExpressionSuspend(arg))
          );
        }
        const funcVar = allocateTemp(state, 'func');
        const callArgsVar = allocateTemp(state, 'args');
        const builtinArgStatements = node.args
          .map((arg, index) => {
            const argSource = compileExpressionSource(state, arg, scope);
            return `const ${builtinArgVars[index]} = ${wrapAwaitedSource(
              state,
              argSource,
              canExpressionSuspend(arg)
            )};`;
          })
          .join('\n');
        return `(async () => {
signal?.throwIfAborted();
const ${bindingVar} = ${createLookupResultSource(scope, node.func.name)};
if (${bindingVar}.isFound && ${bindingVar}.value === runtime.standardBuiltins.${node.func.name}) {
${builtinArgStatements}
try {
return ${
          inlineBuiltinSource ??
          `await runtime.standardBuiltins.${node.func.name}(${builtinArgVars.join(', ')})`
        };
} catch (error) {
return runtime.handleApplyError(runtime.constants[${applyNodeIndex}], error);
}
}
const ${funcVar} = ${bindingVar}.isFound
? ${bindingVar}.value
: runtime.resolveVariable(context, ${JSON.stringify(
          node.func.name
        )}, false, runtime.constants[${addConstant(
          state,
          node.func.range
        )}], signal);
if (typeof ${funcVar} !== 'function') {
runtime.throwError({ description: 'could not apply it for function', range: runtime.constants[${rangeIndex}] });
}
if (runtime.isFunCityFunction(${funcVar})) {
return runtime.invokeCallable(context, runtime.constants[${applyNodeIndex}], signal, ${funcVar}, runtime.constants[${argsNodeIndex}], true);
}
const ${callArgsVar} = ${argArraySource};
return runtime.invokeCallable(context, runtime.constants[${applyNodeIndex}], signal, ${funcVar}, ${callArgsVar}, false);
})()`;
      }
    }
    if (state.mode === 'sync') {
      return 'runtime.requestAsyncFallback()';
    }
    const funcVar = allocateTemp(state, 'func');
    const argsVar = allocateTemp(state, 'args');
    const funcSource = compileExpressionSource(state, node.func, scope);
    return `(async () => {
signal?.throwIfAborted();
const ${funcVar} = ${wrapAwaitedSource(
      state,
      funcSource,
      canExpressionSuspend(node.func)
    )};
if (typeof ${funcVar} !== 'function') {
runtime.throwError({ description: 'could not apply it for function', range: runtime.constants[${rangeIndex}] });
}
if (runtime.isFunCityFunction(${funcVar})) {
return runtime.invokeCallable(context, runtime.constants[${applyNodeIndex}], signal, ${funcVar}, runtime.constants[${argsNodeIndex}], true);
}
const ${argsVar} = ${argArraySource};
return runtime.invokeCallable(context, runtime.constants[${applyNodeIndex}], signal, ${funcVar}, ${argsVar}, false);
})()`;
  };

  const compileExpressionSource = (
    state: SourceCompileState,
    node: FunCityExpressionNode,
    scope: SourceCompileScope
  ): string => {
    switch (node.kind) {
      case 'number': {
        return toNumberLiteral(state, node.value);
      }
      case 'string': {
        return JSON.stringify(node.value);
      }
      case 'template': {
        const textVar = allocateTemp(state, 'text');
        return wrapSourceClosure(
          state,
          `let ${textVar} = '';
${compileTextBlockListStatements(state, node.blocks, textVar, scope)}
return ${textVar};`,
          canBlockListSuspend(node.blocks)
        );
      }
      case 'variable': {
        const variableResult = deconstructConditionalCombine(node.name);
        const directLocalRef = resolveDirectLocalRef(
          scope,
          variableResult.name
        );
        if (directLocalRef !== undefined) {
          return directLocalRef;
        }
        const localSlotRef = resolveLocalSlotRef(scope, variableResult.name);
        if (localSlotRef !== undefined) {
          return `context.getSlotValue(${localSlotRef}, signal)`;
        }
        const selfBindingRef = resolveSelfBindingRef(
          scope,
          variableResult.name
        );
        if (selfBindingRef !== undefined) {
          return selfBindingRef;
        }
        const rangeIndex = addConstant(state, node.range);
        return `runtime.resolveVariable(context, ${JSON.stringify(
          variableResult.name
        )}, ${variableResult.canIgnore ? 'true' : 'false'}, runtime.constants[${rangeIndex}], signal)`;
      }
      case 'dot': {
        const segments = node.segments.map((segment) => {
          const result = deconstructConditionalCombine(segment.name);
          return {
            name: result.name,
            canIgnore: segment.optional || result.canIgnore,
            range: segment.range,
          } satisfies FunCitySourceDotSegmentInfo;
        });
        const segmentsIndex = addConstant(state, segments);
        if (node.base.kind === 'variable') {
          const baseResult = deconstructConditionalCombine(node.base.name);
          const directLocalRef = resolveDirectLocalRef(scope, baseResult.name);
          const localSlotRef = resolveLocalSlotRef(scope, baseResult.name);
          const baseRangeIndex = addConstant(state, node.base.range);
          const baseValueVar = allocateTemp(state, 'base');
          return wrapSourceClosure(
            state,
            `signal?.throwIfAborted();
const ${baseValueVar} = ${
              directLocalRef !== undefined
                ? `{ isFound: true, value: ${directLocalRef} }`
                : localSlotRef !== undefined
                  ? `{ isFound: true, value: context.getSlotValue(${localSlotRef}, signal) }`
                  : createLookupResultSource(scope, baseResult.name)
            };
if (!${baseValueVar}.isFound) {
${
  baseResult.canIgnore || (node.segments[0]?.optional ?? false)
    ? 'return undefined;'
    : `runtime.throwError({ description: ${JSON.stringify(
        `variable is not bound: ${baseResult.name}`
      )}, range: runtime.constants[${baseRangeIndex}] });`
}
}
return runtime.resolveDotSegments(context, ${baseValueVar}.value, runtime.constants[${segmentsIndex}]);`,
            false
          );
        }
        const baseSource = compileExpressionSource(state, node.base, scope);
        return wrapSourceClosure(
          state,
          `signal?.throwIfAborted();
return runtime.resolveDotSegments(
context,
${wrapAwaitedSource(state, baseSource, canExpressionSuspend(node.base))},
runtime.constants[${segmentsIndex}]
);`,
          canExpressionSuspend(node.base)
        );
      }
      case 'apply': {
        if (
          node.func.kind === 'variable' &&
          resolveDirectLocalRef(scope, node.func.name) === undefined &&
          resolveLocalSlotRef(scope, node.func.name) === undefined
        ) {
          const selfBindingRef = resolveSelfBindingRef(scope, node.func.name);
          if (selfBindingRef !== undefined) {
            const selfArgSources = node.args.map((arg) =>
              wrapAwaitedSource(
                state,
                compileExpressionSource(state, arg, scope),
                canExpressionSuspend(arg)
              )
            );
            return wrapSourceClosure(
              state,
              `signal?.throwIfAborted();
return ${selfBindingRef}(${selfArgSources.join(', ')});`,
              node.args.some((arg) => canExpressionSuspend(arg))
            );
          }
        }
        if (
          node.func.kind === 'variable' &&
          node.func.name === 'set' &&
          node.args.length === 2 &&
          node.args[0]!.kind === 'variable' &&
          node.args[1]!.kind === 'apply' &&
          node.args[1]!.func.kind === 'variable' &&
          node.args[1]!.func.name === 'fun' &&
          node.args[1]!.args.length === 2
        ) {
          const parameterNames = extractLambdaParameterNames(
            node.args[1]!.args[0]!
          );
          if (parameterNames !== undefined) {
            const boundName = node.args[0]!.name;
            const setBindingVar = allocateTemp(state, 'binding');
            const funBindingVar = allocateTemp(state, 'binding');
            const lambdaVar = allocateTemp(state, 'lambda');
            const lambdaSource = compileIntrinsicLambdaSource(
              state,
              node.args[1]!.range,
              parameterNames,
              node.args[1]!.args[1]!,
              scope,
              {
                name: boundName,
                bindingRef: lambdaVar,
              }
            );
            return wrapSourceClosure(
              state,
              `signal?.throwIfAborted();
const ${setBindingVar} = ${createLookupResultSource(scope, 'set')};
const ${funBindingVar} = ${createLookupResultSource(scope, 'fun')};
if (${setBindingVar}.isFound && ${setBindingVar}.value === runtime.standardIntrinsics.set && ${funBindingVar}.isFound && ${funBindingVar}.value === runtime.standardIntrinsics.fun) {
const ${lambdaVar} = ${lambdaSource};
context.setValue(${JSON.stringify(boundName)}, ${lambdaVar}, signal);
return undefined;
}
return ${compileGenericApplySource(state, node, scope)};`,
              true
            );
          }
        }
        if (
          node.func.kind === 'variable' &&
          node.func.name === 'set' &&
          node.args.length === 2 &&
          node.args[0]!.kind === 'variable'
        ) {
          const bindingVar = allocateTemp(state, 'binding');
          const valueSource = compileExpressionSource(
            state,
            node.args[1]!,
            scope
          );
          return wrapSourceClosure(
            state,
            `signal?.throwIfAborted();
const ${bindingVar} = ${createLookupResultSource(scope, 'set')};
if (${bindingVar}.isFound && ${bindingVar}.value === runtime.standardIntrinsics.set) {
context.setValue(${JSON.stringify(node.args[0]!.name)}, ${wrapAwaitedSource(
              state,
              valueSource,
              canExpressionSuspend(node.args[1]!)
            )}, signal);
return undefined;
}
return ${compileGenericApplySource(state, node, scope)};`,
            true
          );
        }
        if (
          node.func.kind === 'variable' &&
          node.func.name === 'cond' &&
          node.args.length === 3
        ) {
          const conditionNode = node.args[0]!;
          const thenNode = node.args[1]!;
          const elseNode = node.args[2]!;
          const bindingVar = allocateTemp(state, 'binding');
          const conditionVar = allocateTemp(state, 'condition');
          const conditionSource = compileExpressionSource(
            state,
            conditionNode,
            scope
          );
          const thenSource = compileExpressionSource(state, thenNode, scope);
          const elseSource = compileExpressionSource(state, elseNode, scope);
          return wrapSourceClosure(
            state,
            `signal?.throwIfAborted();
const ${bindingVar} = ${createLookupResultSource(scope, 'cond')};
if (${bindingVar}.isFound && ${bindingVar}.value === runtime.standardIntrinsics.cond) {
const ${conditionVar} = ${wrapAwaitedSource(
              state,
              conditionSource,
              canExpressionSuspend(conditionNode)
            )};
if (runtime.isConditionalTrue(${conditionVar})) {
return ${wrapAwaitedSource(state, thenSource, canExpressionSuspend(thenNode))};
}
return ${wrapAwaitedSource(state, elseSource, canExpressionSuspend(elseNode))};
}
return ${compileGenericApplySource(state, node, scope)};`,
            true
          );
        }
        if (
          node.func.kind === 'variable' &&
          node.func.name === 'defaults' &&
          node.args.length === 2
        ) {
          const bindingVar = allocateTemp(state, 'binding');
          const valueVar = allocateTemp(state, 'value');
          const primarySource = compileExpressionSource(
            state,
            node.args[0]!,
            scope
          );
          const fallbackSource = compileExpressionSource(
            state,
            node.args[1]!,
            scope
          );
          return wrapSourceClosure(
            state,
            `signal?.throwIfAborted();
const ${bindingVar} = ${createLookupResultSource(scope, 'defaults')};
if (${bindingVar}.isFound && ${bindingVar}.value === runtime.standardIntrinsics.defaults) {
const ${valueVar} = ${wrapAwaitedSource(
              state,
              primarySource,
              canExpressionSuspend(node.args[0]!)
            )};
if (${valueVar} !== undefined && ${valueVar} !== null) {
return ${valueVar};
}
return ${wrapAwaitedSource(
              state,
              fallbackSource,
              canExpressionSuspend(node.args[1]!)
            )};
}
return ${compileGenericApplySource(state, node, scope)};`,
            true
          );
        }
        if (
          node.func.kind === 'variable' &&
          (node.func.name === 'and' || node.func.name === 'or')
        ) {
          return compileLogicalIntrinsicSource(
            state,
            node,
            scope,
            node.func.name
          );
        }
        if (
          node.func.kind === 'variable' &&
          node.func.name === 'fun' &&
          node.args.length === 2
        ) {
          const parameterNames = extractLambdaParameterNames(node.args[0]!);
          if (parameterNames !== undefined) {
            const bindingVar = allocateTemp(state, 'binding');
            const lambdaSource = compileIntrinsicLambdaSource(
              state,
              node.range,
              parameterNames,
              node.args[1]!,
              scope,
              undefined
            );
            return wrapSourceClosure(
              state,
              `signal?.throwIfAborted();
const ${bindingVar} = ${createLookupResultSource(scope, 'fun')};
if (${bindingVar}.isFound && ${bindingVar}.value === runtime.standardIntrinsics.fun) {
return ${lambdaSource};
}
return ${compileGenericApplySource(state, node, scope)};`,
              true
            );
          }
        }
        return compileGenericApplySource(state, node, scope);
      }
      case 'list': {
        return `[${node.items
          .map((item) =>
            wrapAwaitedSource(
              state,
              compileExpressionSource(state, item, scope),
              canExpressionSuspend(item)
            )
          )
          .join(', ')}]`;
      }
      case 'scope': {
        if (node.nodes.length === 0) {
          return '[]';
        }
        const resultVar = allocateTemp(state, 'result');
        return wrapSourceClosure(
          state,
          `let ${resultVar} = undefined;
${node.nodes
  .map((childNode) => {
    const childSource = compileExpressionSource(state, childNode, scope);
    return `${resultVar} = ${wrapAwaitedSource(
      state,
      childSource,
      canExpressionSuspend(childNode)
    )};`;
  })
  .join('\n')}
return ${resultVar};`,
          node.nodes.some((childNode) => canExpressionSuspend(childNode))
        );
      }
    }
  };

  const createExpressionRunner = (
    node: FunCityExpressionNode
  ): FunCityGeneratedExpression => {
    const cached = expressionCache.get(node);
    if (cached) {
      return cached;
    }
    const asyncState: SourceCompileState = {
      nextTempId: 0,
      constants: [],
      mode: 'async',
    };
    const asyncBody = `const {
constants,
standardBuiltins,
asIterable,
isConditionalTrue,
isFunCityFunction,
throwError,
resolveVariable,
resolveDotSegments,
invokeCallable,
invokeBuiltin
} = runtime;
return ${compileExpressionSource(asyncState, node, emptyCompileScope)};`;
    const syncState = canCompileSyncExpressionSource(node, emptyCompileScope)
      ? ({
          nextTempId: 0,
          constants: [],
          mode: 'sync',
        } satisfies SourceCompileState)
      : undefined;
    const syncBody =
      syncState === undefined
        ? undefined
        : `const {
constants,
standardBuiltins,
asIterable,
isConditionalTrue,
isFunCityFunction,
throwError,
resolveVariable,
resolveDotSegments,
invokeCallable,
invokeBuiltin
} = runtime;
return ${compileExpressionSource(syncState, node, emptyCompileScope)};`;
    const generated = createSyncPreferredSourceRunner<unknown>({
      asyncBody,
      asyncRuntime: createRuntime(asyncState.constants),
      syncBody,
      syncRuntime:
        syncState === undefined
          ? undefined
          : createRuntime(syncState.constants),
    });
    expressionCache.set(node, generated);
    return generated;
  };

  const createBlockRunner = (node: FunCityBlockNode): FunCityGeneratedBlock => {
    const cached = blockCache.get(node);
    if (cached) {
      return cached;
    }
    const asyncState: SourceCompileState = {
      nextTempId: 0,
      constants: [],
      mode: 'async',
    };
    const asyncResultVar = allocateTemp(asyncState, 'result');
    const asyncBody = `const {
constants,
standardBuiltins,
asIterable,
isConditionalTrue,
isFunCityFunction,
throwError,
resolveVariable,
resolveDotSegments,
invokeCallable,
invokeBuiltin
} = runtime;
const ${asyncResultVar} = [];
${compileBlockStatements(asyncState, node, asyncResultVar, false, emptyCompileScope)}
return ${asyncResultVar};`;
    const syncState = canCompileSyncBlockSource(node, emptyCompileScope)
      ? ({
          nextTempId: 0,
          constants: [],
          mode: 'sync',
        } satisfies SourceCompileState)
      : undefined;
    const syncBody =
      syncState === undefined
        ? undefined
        : (() => {
            const syncResultVar = allocateTemp(syncState, 'result');
            return `const {
constants,
standardBuiltins,
asIterable,
isConditionalTrue,
isFunCityFunction,
throwError,
resolveVariable,
resolveDotSegments,
invokeCallable,
invokeBuiltin
} = runtime;
const ${syncResultVar} = [];
${compileBlockStatements(syncState, node, syncResultVar, false, emptyCompileScope)}
return ${syncResultVar};`;
          })();
    const generated = createSyncPreferredSourceRunner<unknown[]>({
      asyncBody,
      asyncRuntime: createRuntime(asyncState.constants),
      syncBody,
      syncRuntime:
        syncState === undefined
          ? undefined
          : createRuntime(syncState.constants),
    });
    blockCache.set(node, generated);
    return generated;
  };

  const createProgramRunner = (
    nodes: readonly FunCityBlockNode[]
  ): FunCityGeneratedProgram => {
    const cached = programCache.get(nodes);
    if (cached) {
      return cached;
    }
    const asyncState: SourceCompileState = {
      nextTempId: 0,
      constants: [],
      mode: 'async',
    };
    const asyncResultVar = allocateTemp(asyncState, 'result');
    const asyncBody = `const {
constants,
standardBuiltins,
asIterable,
isConditionalTrue,
isFunCityFunction,
throwError,
resolveVariable,
resolveDotSegments,
invokeCallable,
invokeBuiltin
} = runtime;
const ${asyncResultVar} = [];
${compileBlockListStatements(asyncState, nodes, asyncResultVar, true, emptyCompileScope)}
return ${asyncResultVar};`;
    const syncState = canCompileSyncBlockListSource(nodes, emptyCompileScope)
      ? ({
          nextTempId: 0,
          constants: [],
          mode: 'sync',
        } satisfies SourceCompileState)
      : undefined;
    const syncBody =
      syncState === undefined
        ? undefined
        : (() => {
            const syncResultVar = allocateTemp(syncState, 'result');
            return `const {
constants,
standardBuiltins,
asIterable,
isConditionalTrue,
isFunCityFunction,
throwError,
resolveVariable,
resolveDotSegments,
invokeCallable,
invokeBuiltin
} = runtime;
const ${syncResultVar} = [];
${compileBlockListStatements(syncState, nodes, syncResultVar, true, emptyCompileScope)}
return ${syncResultVar};`;
          })();
    const generated = createSyncPreferredSourceRunner<unknown[]>({
      asyncBody,
      asyncRuntime: createRuntime(asyncState.constants),
      syncBody,
      syncRuntime:
        syncState === undefined
          ? undefined
          : createRuntime(syncState.constants),
    });
    programCache.set(nodes, generated);
    return generated;
  };

  const createTextProgramRunner = (
    nodes: readonly FunCityBlockNode[]
  ): FunCityGeneratedTextProgram => {
    const cached = textProgramCache.get(nodes);
    if (cached) {
      return cached;
    }
    const asyncState: SourceCompileState = {
      nextTempId: 0,
      constants: [],
      mode: 'async',
    };
    const asyncTextVar = allocateTemp(asyncState, 'text');
    const asyncBody = `const {
constants,
standardBuiltins,
asIterable,
isConditionalTrue,
isFunCityFunction,
throwError,
resolveVariable,
resolveDotSegments,
invokeCallable,
invokeBuiltin
} = runtime;
let ${asyncTextVar} = '';
${compileTextBlockListStatements(asyncState, nodes, asyncTextVar, emptyCompileScope)}
return ${asyncTextVar};`;
    const syncState = canCompileSyncBlockListSource(nodes, emptyCompileScope)
      ? ({
          nextTempId: 0,
          constants: [],
          mode: 'sync',
        } satisfies SourceCompileState)
      : undefined;
    const syncBody =
      syncState === undefined
        ? undefined
        : (() => {
            const syncTextVar = allocateTemp(syncState, 'text');
            return `const {
constants,
standardBuiltins,
asIterable,
isConditionalTrue,
isFunCityFunction,
throwError,
resolveVariable,
resolveDotSegments,
invokeCallable,
invokeBuiltin
} = runtime;
let ${syncTextVar} = '';
${compileTextBlockListStatements(syncState, nodes, syncTextVar, emptyCompileScope)}
return ${syncTextVar};`;
          })();
    const generated = createSyncPreferredSourceRunner<string>({
      asyncBody,
      asyncRuntime: createRuntime(asyncState.constants),
      syncBody,
      syncRuntime:
        syncState === undefined
          ? undefined
          : createRuntime(syncState.constants),
    });
    textProgramCache.set(nodes, generated);
    return generated;
  };

  const createExecutor = (): FunCityReducerExecutor => {
    return {
      reduceExpressionNode: (context, node, signal) =>
        createExpressionRunner(node)(context, signal),
      reduceExpressionNodeImmediate:
        closureExecutor.reduceExpressionNodeImmediate,
      reduceNode: (context, node, signal) =>
        createBlockRunner(node)(context, signal),
      reduceNodeImmediate: closureExecutor.reduceNodeImmediate,
    };
  };

  return {
    generateExpression: createExpressionRunner,
    generateBlock: createBlockRunner,
    generateProgram: createProgramRunner,
    generateTextProgram: createTextProgramRunner,
    createExecutor,
  };
};

/**
 * Create a dynamic code generator.
 * @param options - Generator options.
 * @returns Dynamic code generator instance.
 */
export const createDCodegen = (
  options?: FunCityDynamicCodeGeneratorOptions
): FunCityDynamicCodeGenerator => {
  switch (options?.backend) {
    case 'source':
      return createSourceDCodegen();
    case 'closure':
    case undefined:
      return createClosureDCodegen();
  }
};

/**
 * Run a node list with the dynamic code generator.
 * @param nodes - Target nodes.
 * @param variables - Predefined variables.
 * @param warningLogs - Warning sink.
 * @param signal - AbortSignal when available.
 * @returns Reduced native values.
 */
export const runDCodegen = async (
  nodes: readonly FunCityBlockNode[],
  variables: FunCityVariables,
  warningLogs: FunCityWarningEntry[],
  signal?: AbortSignal
): Promise<unknown[]> => {
  const dcodegen = createDCodegen();
  const context = createReducerContext(
    variables,
    warningLogs,
    dcodegen.createExecutor()
  );
  const generator = dcodegen.generateProgram(nodes);
  return await generator(context, signal);
};
