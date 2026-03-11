// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  type FunCityApplyNode,
  type FunCityBlockNode,
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

/**
 * Create a dynamic code generator.
 * @returns Dynamic code generator instance.
 */
export const createDCodegen = (): FunCityDynamicCodeGenerator => {
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
        const specializedBuiltinName =
          node.func.kind === 'variable' ? node.func.name : undefined;
        const specializedBuiltin =
          specializedBuiltinName !== undefined
            ? toSpecializableStandardCallTarget(specializedBuiltinName)
            : undefined;
        generator =
          specializedBuiltin === undefined
            ? (context, signal) =>
                applyFunction(context, node, signal, compiledFunc, compiledArgs)
            : (context, signal) => {
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
