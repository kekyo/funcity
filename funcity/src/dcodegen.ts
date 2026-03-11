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
  name: string,
  range: FunCityRange,
  signal: AbortSignal | undefined
) => {
  const result = deconstructConditionalCombine(name);
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

  const resolveDotNode = (
    context: FunCityReducerContext,
    node: FunCityDotNode,
    signal: AbortSignal | undefined,
    compiledBase: FunCityGeneratedExpressionImmediate | undefined
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
    const handleApplyError = (error: unknown): never => {
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

    const invokeCallable = (args: readonly unknown[]) => {
      const shouldConstruct = !isSpecial && context.isConstructable(callable);
      try {
        if (shouldConstruct) {
          return Reflect.construct(callable, args);
        }
        const thisProxy = context.createFunctionContext(node, signal);
        return callable.call(thisProxy, ...args);
      } catch (error: unknown) {
        handleApplyError(error);
      }
    };

    const result = resolveMaybePromise(resolvedArgs, (args) =>
      invokeCallable(args as readonly unknown[])
    );
    if (isPromiseLike(result)) {
      return result.catch((error: unknown) => handleApplyError(error));
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
        const generatedBlocks = generateRawProgramImmediate(node.blocks);
        generator = (context, signal) =>
          resolveMaybePromise(generatedBlocks(context, signal), (results) =>
            filterUndefined(results)
              .map((result) => context.convertToString(result))
              .join('')
          );
        break;
      }
      case 'variable': {
        generator = (context, signal) =>
          resolveVariable(context, node.name, node.range, signal);
        break;
      }
      case 'dot': {
        const compiledBase =
          node.base.kind === 'variable'
            ? undefined
            : generateExpressionImmediate(node.base);
        generator = (context, signal) =>
          resolveDotNode(context, node, signal, compiledBase);
        break;
      }
      case 'apply': {
        const compiledFunc = generateExpressionImmediate(node.func);
        const compiledArgs = node.args.map(generateExpressionImmediate);
        generator = (context, signal) =>
          applyFunction(context, node, signal, compiledFunc, compiledArgs);
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
