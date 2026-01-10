// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

//////////////////////////////////////////////////////////////////////////////

/**
 * Location in source text.
 */
export interface FunCityLocation {
  /**
   * Line number (1-based).
   */
  readonly line: number;
  /**
   * Column number (1-based).
   */
  readonly column: number;
}

/**
 * Range in source text.
 */
export interface FunCityRange {
  /**
   * Start location.
   */
  readonly start: FunCityLocation;
  /**
   * End location.
   */
  readonly end: FunCityLocation;
}

/**
 * Error severity type.
 */
export type FunCityErrorType = 'warning' | 'error';

/**
 * Error information with location.
 */
export interface FunCityErrorInfo {
  /**
   * Error severity.
   */
  readonly type: FunCityErrorType;
  /**
   * Error description.
   */
  readonly description: string;
  /**
   * Error range in source text.
   */
  readonly range: FunCityRange;
}

//////////////////////////////////////////////////////////////////////////////

/**
 * Variable map used by the reducer.
 */
export type FunCityVariables = ReadonlyMap<string, unknown>;

/**
 * The string token.
 */
export interface FunCityStringToken {
  /**
   * Token kind.
   */
  readonly kind: 'string';
  /**
   * String value.
   */
  readonly value: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The number (numeric) token.
 */
export interface FunCityNumberToken {
  /**
   * Token kind.
   */
  readonly kind: 'number';
  /**
   * Numeric value.
   */
  readonly value: number;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The identity (variable name) token.
 */
export interface FunCityIdentityToken {
  /**
   * Token kind.
   */
  readonly kind: 'identity';
  /**
   * Identity.
   */
  readonly name: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Open parenthesis or bracket node.
 */
export interface FunCityOpenToken {
  /**
   * Token kind.
   */
  readonly kind: 'open';
  /**
   * Open symbol.
   */
  readonly symbol: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Close parenthesis or bracket token.
 */
export interface FunCityCloseToken {
  /**
   * Token kind.
   */
  readonly kind: 'close';
  /**
   * Close symbol.
   */
  readonly symbol: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * End of line token.
 */
export interface FunCityEndOfLineToken {
  /**
   * Token kind.
   */
  readonly kind: 'eol';
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Free form text token.
 */
export interface FunCityTextToken {
  /**
   * Token kind.
   */
  readonly kind: 'text';
  /**
   * Text value.
   */
  readonly text: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The token.
 */
export type FunCityToken =
  | FunCityStringToken
  | FunCityNumberToken
  | FunCityIdentityToken
  | FunCityOpenToken
  | FunCityCloseToken
  | FunCityEndOfLineToken
  | FunCityTextToken;

//////////////////////////////////////////////////////////////////////////////

/**
 * String expression node.
 */
export interface FunCityStringNode {
  /**
   * Node kind.
   */
  readonly kind: 'string';
  /**
   * String value.
   */
  readonly value: string;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Number (numeric) expression node.
 */
export interface FunCityNumberNode {
  /**
   * Node kind.
   */
  readonly kind: 'number';
  /**
   * Numeric value.
   */
  readonly value: number;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Variable (identity) expression node.
 */
export interface FunCityVariableNode {
  /**
   * Node kind.
   */
  readonly kind: 'variable';
  /**
   * Variable name.
   */
  readonly name: string;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Application expression node.
 */
export interface FunCityApplyNode {
  /**
   * Node kind.
   */
  readonly kind: 'apply';
  /**
   * Application target node.
   */
  readonly func: FunCityExpressionNode;
  /**
   * Application arguments.
   */
  readonly args: readonly FunCityExpressionNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Lambda expression node.
 */
export interface FunCityLambdaNode {
  /**
   * Node kind.
   */
  readonly kind: 'lambda';
  /**
   * Parameter names.
   */
  readonly names: readonly FunCityVariableNode[];
  /**
   * Lambda body expression.
   */
  readonly body: FunCityExpressionNode;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Expression list (array) node.
 */
export interface FunCityListNode {
  /**
   * Node kind.
   */
  readonly kind: 'list';
  /**
   * List item nodes.
   */
  readonly items: readonly FunCityExpressionNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Variable setter node.
 */
export interface FunCitySetNode {
  /**
   * Node kind.
   */
  readonly kind: 'set';
  /**
   * Target variable name.
   */
  readonly name: FunCityVariableNode;
  /**
   * Will be set the value from reduced expression.
   */
  readonly expr: FunCityExpressionNode;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Evaluate child scope node.
 */
export interface FunCityScopeNode {
  /**
   * Node kind.
   */
  readonly kind: 'scope';
  /**
   * Scoped node list.
   * @remarks Reduced each nodes, but takes last one reduced value.
   */
  readonly nodes: readonly FunCityExpressionNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The expression node.
 */
export type FunCityExpressionNode =
  | FunCityNumberNode
  | FunCityStringNode
  | FunCityVariableNode
  | FunCityApplyNode
  | FunCityLambdaNode
  | FunCityListNode
  | FunCitySetNode
  | FunCityScopeNode;

/**
 * Text block node.
 */
export interface FunCityTextNode {
  /**
   * Node kind.
   */
  readonly kind: 'text';
  /**
   * Text body.
   */
  readonly text: string;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Conditional branch (`if`) block node contains else block.
 */
export interface FunCityIfNode {
  /**
   * Node kind.
   */
  readonly kind: 'if';
  /**
   * Condition expression node.
   */
  readonly condition: FunCityExpressionNode;
  /**
   * Then (true) block node.
   */
  readonly then: readonly FunCityBlockNode[];
  /**
   * Else (false) block node.
   */
  readonly else: readonly FunCityBlockNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Conditional repeats (`while`) block node contains else block.
 */
export interface FunCityWhileNode {
  /**
   * Node kind.
   */
  readonly kind: 'while';
  /**
   * Condition expression node.
   */
  readonly condition: FunCityExpressionNode;
  /**
   * Repeat block node.
   */
  readonly repeat: readonly FunCityBlockNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Item iteration (`for`) block node contains else block.
 */
export interface FunCityForNode {
  /**
   * Node kind.
   */
  readonly kind: 'for';
  /**
   * Bind variable node in each iteration.
   */
  readonly bind: FunCityVariableNode;
  /**
   * Iteration target expression node.
   */
  readonly iterable: FunCityExpressionNode;
  /**
   * Repeat block node.
   */
  readonly repeat: readonly FunCityBlockNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The block node.
 */
export type FunCityBlockNode =
  | FunCityExpressionNode
  | FunCityTextNode
  | FunCityIfNode
  | FunCityWhileNode
  | FunCityForNode;

export interface ParserCursor {
  /**
   * Peek one token.
   * @returns A token or undefined when reached end of token.
   */
  peekToken: () => FunCityToken | undefined;
  /**
   * Get one token and advance.
   * @returns A token or undefined when reached end of token.
   */
  takeToken: () => FunCityToken | undefined;
  /**
   * Skip one token.
   */
  skipToken: () => void;
}

//////////////////////////////////////////////////////////////////////////////

/**
 * Variable value result.
 */
export interface FunCityReducerContextValueResult {
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
export interface FunCityFunctionContext {
  /**
   * Current scope variables.
   */
  readonly variables: any;
  /**
   * Current function application node.
   */
  readonly thisNode: FunCityExpressionNode;
  /**
   * Reduce expression node with this context.
   * @param node - Target node
   * @returns Reduced value.
   */
  readonly reduce: (node: FunCityExpressionNode) => Promise<unknown>;
  /**
   * Append directly error information.
   * @param error - Error or warning information.
   */
  readonly appendError: (error: FunCityErrorInfo) => void;
}

/**
 * The reducer context.
 */
export interface FunCityReducerContext {
  /**
   * Get current abort signal object.
   * @returns AbortSignal when available.
   */
  readonly abortSignal: AbortSignal | undefined;
  /**
   * Get current context (scope) variable value.
   * @param name - Variable name
   * @returns Variable value information
   */
  readonly getValue: (name: string) => FunCityReducerContextValueResult;
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
  readonly appendError: (error: FunCityErrorInfo) => void;
  /**
   * Indicate error received.
   * @returns The context is received any errors.
   */
  readonly isFailed: () => boolean;
  /**
   * Create new scoped context.
   * @returns New reducer context.
   */
  readonly newScope: () => FunCityReducerContext;
  /**
   * Create native function context proxy.
   * @param thisNode Current node (Indicating the current application is expected)
   * @returns Native function context proxy instance.
   */
  readonly createFunctionContext: (
    thisNode: FunCityExpressionNode
  ) => FunCityFunctionContext;
}
