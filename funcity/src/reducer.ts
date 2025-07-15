// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  fromError,
  asIterable,
  type MtrScriptErrorInfo,
  type MtrScriptVariables,
  isConditionalTrue,
  isSpecialFunction,
} from './scripting';
import type {
  MtrScriptExpressionNode,
  MtrScriptLambdaNode,
  MtrScriptBlockNode,
  MtrScriptVariableNode,
} from './parser';

//////////////////////////////////////////////////////////////////////////////

/**
 * Variable value result.
 */
export interface ValueResult {
  /**
   * Variable value.
   */
  readonly value: unknown;
  /**
   * Is this found?
   */
  readonly isFound: boolean;
}

/**
 * Native function context.
 */
export interface MtrScriptFunctionContext {
  /**
   * Current scope variables.
   */
  readonly variables: any;
  /**
   * Current function application node.
   */
  readonly thisNode: MtrScriptExpressionNode;
  /**
   * Reduce expression node with this context.
   * @param node - Target node
   * @returns Reduced value.
   */
  readonly reduce: (node: MtrScriptExpressionNode) => Promise<unknown>;
  /**
   * Append directly error information.
   * @param error - Error or warning information.
   */
  readonly appendError: (error: MtrScriptErrorInfo) => void;
}

/**
 * The reducer context.
 */
export interface MtrScriptReducerContext {
  /**
   * Get current context (scope) variable value.
   * @param name - Variable name
   * @returns Variable value information
   */
  readonly getValue: (name: string) => ValueResult;
  /**
   * Set current context (scope) variable value.
   * @param name - Variable name
   * @param value - New value
   */
  readonly setValue: (name: string, value: unknown) => void;
  /**
   * Append context error.
   * @param error - Error or warning information.
   */
  readonly appendError: (error: MtrScriptErrorInfo) => void;
  /**
   * Indicate error received.
   * @returns The context is received any errors.
   */
  readonly isFailed: () => boolean;
  /**
   * Create new scoped context.
   * @returns New reducer context.
   */
  readonly newScope: () => MtrScriptReducerContext;
  /**
   * Create native function context proxy.
   * @param thisNode Current node (Indicating the current application is expected)
   * @returns Native function context proxy instance.
   */
  readonly createFunctionContext: (
    thisNode: MtrScriptExpressionNode
  ) => MtrScriptFunctionContext;
}

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
  context: MtrScriptReducerContext,
  name: MtrScriptVariableNode
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

// Create native function object from lambda node.
const fromLambda = (
  context: MtrScriptReducerContext,
  lambda: MtrScriptLambdaNode
): Function => {
  return async (...args: readonly unknown[]) => {
    if (args.length < lambda.names.length) {
      context.appendError({
        type: 'error',
        description: `Arguments are not filled: ${args.length} < ${lambda.names.length}`,
        range: lambda.range,
      });
      return undefined;
    } else if (args.length > lambda.names.length) {
      context.appendError({
        type: 'warning',
        description: `Too many arguments: ${args.length} > ${lambda.names.length}`,
        range: lambda.range,
      });
    }
    const newContext = context.newScope();
    for (let index = 0; index < lambda.names.length; index++) {
      newContext.setValue(lambda.names[index]!.name, args[index]);
    }
    const result = await reduceExpressionNode(newContext, lambda.body);
    return result;
  };
};

//////////////////////////////////////////////////////////////////////////////

/**
 * Reduce expression node.
 * @param context - Reducer context
 * @param node - Target expression node
 * @returns Reduced native value
 */
export const reduceExpressionNode = async (
  context: MtrScriptReducerContext,
  node: MtrScriptExpressionNode
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
      const func = await reduceExpressionNode(context, node.func);
      if (typeof func !== 'function') {
        context.appendError({
          type: 'error',
          description: 'could not apply it for function',
          range: node.range,
        });
        return undefined;
      }
      const thisProxy = context.createFunctionContext(node);
      if (isSpecialFunction(func)) {
        const value = await func.call(thisProxy, ...node.args);
        return value;
      } else {
        const args = await Promise.all(
          node.args.map(async (argNode) => {
            try {
              const arg = await reduceExpressionNode(context, argNode);
              return arg;
            } catch (e: unknown) {
              context.appendError({
                type: 'error',
                description: fromError(e),
                range: argNode.range,
              });
              return undefined;
            }
          })
        );
        const value = await func.call(thisProxy, ...args);
        return value;
      }
    }
    case 'lambda': {
      return fromLambda(context, node);
    }
    case 'list': {
      const results = await Promise.all(
        node.items.map((item) => reduceExpressionNode(context, item))
      );
      return results;
    }
    case 'set': {
      const expr = await reduceExpressionNode(context, node.expr);
      context.setValue(node.name.name, expr);
      return undefined;
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
  context: MtrScriptReducerContext,
  node: MtrScriptBlockNode
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

/**
 * Create reducer context.
 * @param variables - Predefined variables
 * @param errors - Will be stored detected warnings/errors into it
 * @returns Reducer context
 */
export const createReducerContext = (
  variables: MtrScriptVariables,
  errors: MtrScriptErrorInfo[]
): MtrScriptReducerContext => {
  let vs = variables;
  let mvs: Map<string, unknown> | undefined;
  let variablesProxy: any;

  const getValue = (name: string): ValueResult => {
    if (vs.has(name)) {
      return { value: vs.get(name), isFound: true };
    } else {
      return { value: undefined, isFound: false };
    }
  };

  const setValue = (name: string, value: unknown) => {
    // Clone (makes scoped) and update it.
    if (!mvs) {
      mvs = new Map(vs);
      vs = mvs;
    }
    mvs.set(name, value);

    // Updates variable proxy when already created.
    if (variablesProxy !== undefined) {
      Object.defineProperty(variablesProxy, name, {
        get() {
          return vs.get(name);
        },
        configurable: true,
        enumerable: true,
      });
    }
  };

  const appendError = (error: MtrScriptErrorInfo) => {
    errors.push(error);
  };

  const isFailed = () => {
    return errors.some((error) => error.type === 'error');
  };

  const newScope = () => {
    const newContext = createReducerContext(vs, errors);
    return newContext;
  };

  let context: MtrScriptReducerContext;
  const reduceByProxy = (node: MtrScriptExpressionNode) =>
    reduceExpressionNode(context, node);
  const getVariablesFromProxy = () => {
    // Makes cached variable proxy.
    if (variablesProxy === undefined) {
      variablesProxy = {};
      for (const key of vs.keys()) {
        Object.defineProperty(variablesProxy, key, {
          get: () => vs.get(key),
          configurable: true,
          enumerable: true,
        });
      }
    }
    return variablesProxy;
  };

  const createFunctionContext = (
    thisNode: MtrScriptExpressionNode
  ): MtrScriptFunctionContext => {
    return {
      get variables() {
        return getVariablesFromProxy();
      },
      thisNode,
      appendError,
      reduce: reduceByProxy,
    } as const;
  };

  context = {
    getValue,
    setValue,
    appendError,
    isFailed,
    newScope,
    createFunctionContext,
  };
  return context;
};

// Unwrap nested results and will remove `undefined` results.
const unwrap = (results: unknown[]): unknown[] => {
  return results.flatMap<unknown>((result) => {
    if (result === undefined) {
      return [];
    } else {
      return [result];
    }
  });
};

/**
 * Run the reducer.
 * @param node - Target node
 * @param variables - Predefined variables
 * @param errors - Will be stored detected warnings/errors into it
 * @returns Reduced native value list
 */
export function runReducer(
  node: MtrScriptBlockNode,
  variables: MtrScriptVariables,
  errors: MtrScriptErrorInfo[]
): Promise<unknown[]>;

/**
 * Run the reducer.
 * @param node - Target node list
 * @param variables - Predefined variables
 * @param errors - Will be stored detected warnings/errors into it
 * @returns Reduced native value list
 */
export function runReducer(
  nodes: readonly MtrScriptBlockNode[],
  variables: MtrScriptVariables,
  errors: MtrScriptErrorInfo[]
): Promise<unknown[]>;

/**
 * Run the reducer.
 * @param node - Target nodes
 * @param variables - Predefined variables
 * @param errors - Will be stored detected warnings/errors into it
 * @returns Reduced native values
 */
export async function runReducer(
  nodes: readonly MtrScriptBlockNode[] | MtrScriptBlockNode,
  variables: MtrScriptVariables,
  errors: MtrScriptErrorInfo[]
): Promise<unknown[]> {
  const context = createReducerContext(variables, errors);
  if (Array.isArray(nodes)) {
    // Root list "ABC{{def ghi}}JKL" is reduced each expressions in sequential.
    const resultList: unknown[] = [];
    for (const node of nodes) {
      const results = await reduceNode(context, node);
      resultList.push(...results);
    }
    return unwrap(resultList);
  } else {
    const results = await reduceNode(context, nodes as MtrScriptExpressionNode);
    return unwrap(results);
  }
}
