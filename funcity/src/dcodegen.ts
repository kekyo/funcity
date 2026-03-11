// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  type FunCityApplyNode,
  type FunCityBlockNode,
  type FunCityDotNode,
  type FunCityExpressionNode,
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

const filterUndefined = (results: readonly unknown[]) =>
  results.filter((result) => result !== undefined);

const createRawBlockRunner = (
  generators: readonly FunCityGeneratedBlock[]
): FunCityGeneratedBlock => {
  return async (
    context: FunCityReducerContext,
    signal?: AbortSignal
  ): Promise<unknown[]> => {
    const resultList: unknown[] = [];
    for (const generator of generators) {
      const results = await generator(context, signal);
      resultList.push(...results);
    }
    return resultList;
  };
};

/**
 * Create a dynamic code generator.
 * @returns Dynamic code generator instance.
 */
export const createDCodegen = (): FunCityDynamicCodeGenerator => {
  const expressionCache = new WeakMap<
    FunCityExpressionNode,
    FunCityGeneratedExpression
  >();
  const blockCache = new WeakMap<FunCityBlockNode, FunCityGeneratedBlock>();
  const rawProgramCache = new WeakMap<object, FunCityGeneratedBlock>();
  const programCache = new WeakMap<object, FunCityGeneratedProgram>();

  const generateRawProgram = (
    nodes: readonly FunCityBlockNode[]
  ): FunCityGeneratedBlock => {
    const cached = rawProgramCache.get(nodes);
    if (cached) {
      return cached;
    }
    const generator = createRawBlockRunner(nodes.map(generateBlock));
    rawProgramCache.set(nodes, generator);
    return generator;
  };

  const resolveDotNode = async (
    context: FunCityReducerContext,
    node: FunCityDotNode,
    signal: AbortSignal | undefined,
    compiledBase: FunCityGeneratedExpression | undefined
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
    } else if (compiledBase) {
      value = await compiledBase(context, signal);
    } else {
      value = undefined;
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
    signal: AbortSignal | undefined,
    compiledFunc: FunCityGeneratedExpression,
    compiledArgs: readonly FunCityGeneratedExpression[]
  ) => {
    signal?.throwIfAborted();
    const func = await compiledFunc(context, signal);
    if (typeof func !== 'function') {
      throwError({
        description: 'could not apply it for function',
        range: node.range,
      });
    }
    const callable = func as Function;

    const isSpecial = isFunCityFunction(callable);
    const args = isSpecial
      ? node.args
      : await Promise.all(compiledArgs.map((arg) => arg(context, signal)));
    const shouldConstruct = !isSpecial && context.isConstructable(callable);

    try {
      if (shouldConstruct) {
        return Reflect.construct(callable, args);
      }
      const thisProxy = context.createFunctionContext(node, signal);
      return await callable.call(thisProxy, ...args);
    } catch (error: unknown) {
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
    }
  };

  const generateExpression = (
    node: FunCityExpressionNode
  ): FunCityGeneratedExpression => {
    const cached = expressionCache.get(node);
    if (cached) {
      return cached;
    }

    let generator: FunCityGeneratedExpression;
    switch (node.kind) {
      case 'number':
      case 'string': {
        generator = async () => node.value;
        break;
      }
      case 'template': {
        const generatedBlocks = generateRawProgram(node.blocks);
        generator = async (context, signal) => {
          const results = await generatedBlocks(context, signal);
          return filterUndefined(results)
            .map((result) => context.convertToString(result))
            .join('');
        };
        break;
      }
      case 'variable': {
        generator = async (context, signal) =>
          resolveVariable(context, node.name, node.range, signal);
        break;
      }
      case 'dot': {
        const compiledBase =
          node.base.kind === 'variable'
            ? undefined
            : generateExpression(node.base);
        generator = async (context, signal) =>
          resolveDotNode(context, node, signal, compiledBase);
        break;
      }
      case 'apply': {
        const compiledFunc = generateExpression(node.func);
        const compiledArgs = node.args.map(generateExpression);
        generator = async (context, signal) =>
          await applyFunction(
            context,
            node,
            signal,
            compiledFunc,
            compiledArgs
          );
        break;
      }
      case 'list': {
        const compiledItems = node.items.map(generateExpression);
        generator = async (context, signal) =>
          await Promise.all(compiledItems.map((item) => item(context, signal)));
        break;
      }
      case 'scope': {
        const compiledNodes = node.nodes.map(generateExpression);
        generator = async (context, signal) => {
          if (compiledNodes.length === 0) {
            return [];
          }
          let result: unknown = undefined;
          for (const compiledNode of compiledNodes) {
            result = await compiledNode(context, signal);
          }
          return result;
        };
        break;
      }
    }

    expressionCache.set(node, generator);
    return generator;
  };

  const generateBlock = (node: FunCityBlockNode): FunCityGeneratedBlock => {
    const cached = blockCache.get(node);
    if (cached) {
      return cached;
    }

    let generator: FunCityGeneratedBlock;
    switch (node.kind) {
      case 'text': {
        generator = async () => [node.text];
        break;
      }
      case 'for': {
        const iterableGenerator = generateExpression(node.iterable);
        const repeatGenerator = generateRawProgram(node.repeat);
        generator = async (context, signal) => {
          const result = await iterableGenerator(context, signal);
          const iterable = asIterable(result);
          if (!iterable) {
            throwError({
              description: 'could not apply it for function',
              range: node.range,
            });
          }
          const resolvedIterable = iterable as Iterable<unknown>;

          const resultList: unknown[] = [];
          for (const item of resolvedIterable) {
            context.setValue(node.bind.name, item, signal);
            const results = await repeatGenerator(context, signal);
            resultList.push(...results);
          }
          return resultList;
        };
        break;
      }
      case 'while': {
        const conditionGenerator = generateExpression(node.condition);
        const repeatGenerator = generateRawProgram(node.repeat);
        generator = async (context, signal) => {
          const resultList: unknown[] = [];
          while (true) {
            const condition = await conditionGenerator(context, signal);
            if (!isConditionalTrue(condition)) {
              break;
            }
            const results = await repeatGenerator(context, signal);
            resultList.push(...results);
          }
          return resultList;
        };
        break;
      }
      case 'if': {
        const conditionGenerator = generateExpression(node.condition);
        const thenGenerator = generateRawProgram(node.then);
        const elseGenerator = generateRawProgram(node.else);
        generator = async (context, signal) => {
          const condition = await conditionGenerator(context, signal);
          if (isConditionalTrue(condition)) {
            return await thenGenerator(context, signal);
          }
          return await elseGenerator(context, signal);
        };
        break;
      }
      default: {
        const expressionGenerator = generateExpression(node);
        generator = async (context, signal) => [
          await expressionGenerator(context, signal),
        ];
        break;
      }
    }

    blockCache.set(node, generator);
    return generator;
  };

  const generateProgram = (
    nodes: readonly FunCityBlockNode[]
  ): FunCityGeneratedProgram => {
    const cached = programCache.get(nodes);
    if (cached) {
      return cached;
    }

    const generatedBlocks = generateRawProgram(nodes);
    const generator: FunCityGeneratedProgram = async (context, signal) =>
      filterUndefined(await generatedBlocks(context, signal));
    programCache.set(nodes, generator);
    return generator;
  };

  const createExecutor = (): FunCityReducerExecutor => ({
    reduceExpressionNode: (
      context: FunCityReducerContext,
      node: FunCityExpressionNode,
      signal: AbortSignal | undefined
    ) => generateExpression(node)(context, signal),
    reduceNode: (
      context: FunCityReducerContext,
      node: FunCityBlockNode,
      signal: AbortSignal | undefined
    ) => generateBlock(node)(context, signal),
  });

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
