// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

//////////////////////////////////////////////////////////////////////////////

/**
 * Error/Warning information writers.
 */
export interface FunCityErrorInfoWriter {
  /**
   * Warning message writer.
   * @param message - Message string
   */
  readonly warn: (message: string) => void;
  /**
   * Error message writer.
   * @param message - Message string
   */
  readonly error: (message: string) => void;
}

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

export interface FunCityRangedObject {
  /**
   * This object range.
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
export interface FunCityStringToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'string';
  /**
   * String value.
   */
  readonly value: string;
}

/**
 * The number (numeric) token.
 */
export interface FunCityNumberToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'number';
  /**
   * Numeric value.
   */
  readonly value: number;
}

/**
 * The identity (variable name) token.
 */
export interface FunCityIdentityToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'identity';
  /**
   * Identity.
   */
  readonly name: string;
}

/**
 * Open parenthesis or bracket node.
 */
export interface FunCityOpenToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'open';
  /**
   * Open symbol.
   */
  readonly symbol: string;
}

/**
 * Close parenthesis or bracket token.
 */
export interface FunCityCloseToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'close';
  /**
   * Close symbol.
   */
  readonly symbol: string;
}

/**
 * End of line token.
 */
export interface FunCityEndOfLineToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'eol';
}

/**
 * Free form text token.
 */
export interface FunCityTextToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'text';
  /**
   * Text value.
   */
  readonly text: string;
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
export interface FunCityStringNode extends FunCityRangedObject {
  /**
   * Node kind.
   */
  readonly kind: 'string';
  /**
   * String value.
   */
  readonly value: string;
}

/**
 * Number (numeric) expression node.
 */
export interface FunCityNumberNode extends FunCityRangedObject {
  /**
   * Node kind.
   */
  readonly kind: 'number';
  /**
   * Numeric value.
   */
  readonly value: number;
}

/**
 * Variable (identity) expression node.
 */
export interface FunCityVariableNode extends FunCityRangedObject {
  /**
   * Node kind.
   */
  readonly kind: 'variable';
  /**
   * Variable name.
   */
  readonly name: string;
}

/**
 * Application expression node.
 */
export interface FunCityApplyNode extends FunCityRangedObject {
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
}

/**
 * Expression list (array) node.
 */
export interface FunCityListNode extends FunCityRangedObject {
  /**
   * Node kind.
   */
  readonly kind: 'list';
  /**
   * List item nodes.
   */
  readonly items: readonly FunCityExpressionNode[];
}

/**
 * Evaluate child scope node.
 */
export interface FunCityScopeNode extends FunCityRangedObject {
  /**
   * Node kind.
   */
  readonly kind: 'scope';
  /**
   * Scoped node list.
   * @remarks Reduced each nodes, but takes last one reduced value.
   */
  readonly nodes: readonly FunCityExpressionNode[];
}

/**
 * The expression node.
 */
export type FunCityExpressionNode =
  | FunCityNumberNode
  | FunCityStringNode
  | FunCityVariableNode
  | FunCityApplyNode
  | FunCityListNode
  | FunCityScopeNode;

/**
 * Text block node.
 */
export interface FunCityTextNode extends FunCityRangedObject {
  /**
   * Node kind.
   */
  readonly kind: 'text';
  /**
   * Text body.
   */
  readonly text: string;
}

/**
 * Conditional branch (`if`) block node contains else block.
 */
export interface FunCityIfNode extends FunCityRangedObject {
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
}

/**
 * Conditional repeats (`while`) block node contains else block.
 */
export interface FunCityWhileNode extends FunCityRangedObject {
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
}

/**
 * Item iteration (`for`) block node contains else block.
 */
export interface FunCityForNode extends FunCityRangedObject {
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
 * Reducer running error.
 */
export class FunCityReducerError extends Error {
  /**
   * Error information.
   */
  readonly info: FunCityErrorInfo;

  constructor(info: FunCityErrorInfo) {
    super(info.description);
    this.name = 'FunCityReducerError';
    this.info = info;
    Object.setPrototypeOf(this, FunCityReducerError.prototype);
  }
}

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
   * Current function application node.
   */
  readonly thisNode: FunCityExpressionNode;
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
   * Convert a value to string.
   * @param v - A value
   * @returns String
   */
  readonly convertToString: (v: unknown) => string;
  /**
   * Reduce expression node with this context.
   * @param node - Target node
   * @returns Reduced value.
   */
  readonly reduce: (node: FunCityExpressionNode) => Promise<unknown>;
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
   * Get a bound function with caching for object receivers.
   * @param owner - Method owner object
   * @param fn - Original function
   * @returns Bound function
   */
  readonly getBoundFunction: (owner: object, fn: Function) => Function;
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
   * Convert a value to string.
   * @param v - A value
   * @returns String
   */
  readonly convertToString: (v: unknown) => string;
  /**
   * Create native function context proxy.
   * @param thisNode Current node (Indicating the current application is expected)
   * @returns Native function context proxy instance.
   */
  readonly createFunctionContext: (
    thisNode: FunCityExpressionNode
  ) => FunCityFunctionContext;
}

//////////////////////////////////////////////////////////////////////////////

/**
 * Basic runner properties.
 */
export interface FunCityOnceRunnerProps {
  /**
   * Predefined variables.
   */
  variables?: FunCityVariables;
  /**
   * Will be stored detected warnings/errors into it.
   */
  errors?: FunCityErrorInfo[];
  /**
   * Abort signal.
   */
  signal?: AbortSignal;
}
