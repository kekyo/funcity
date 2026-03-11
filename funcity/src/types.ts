// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

//////////////////////////////////////////////////////////////////////////////

/**
 * Error/Warning information writers.
 */
export interface FunCityLogEntryWriter {
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
   * Source identifier (file path, URL, etc).
   */
  readonly sourceId: string;
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
 * Warning information with location.
 */
export interface FunCityWarningEntry {
  /**
   * Warning severity.
   */
  readonly type: 'warning';
  /**
   * Warning description.
   */
  readonly description: string;
  /**
   * Warning range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Error information with location.
 */
export interface FunCityErrorEntry {
  /**
   * Error severity.
   */
  readonly type: 'error';
  /**
   * Error description.
   */
  readonly description: string;
  /**
   * Error range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Log entry type.
 */
export type FunCityLogEntry = FunCityWarningEntry | FunCityErrorEntry;

//////////////////////////////////////////////////////////////////////////////

/**
 * Value or promise-like value.
 */
export type FunCityMaybePromise<T> = T | Promise<T>;

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
 * Dot (member access) token.
 */
export interface FunCityDotToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'dot';
  /**
   * Is this optional dot token?
   */
  readonly optional: boolean;
}

/**
 * End of line source.
 */
export type FunCityEndOfLineSource = 'newline' | 'semicolon';

/**
 * End of line token.
 */
export interface FunCityEndOfLineToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'eol';
  /**
   * End of line source.
   */
  readonly source: FunCityEndOfLineSource;
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
 * Template token (interpolated string).
 */
export interface FunCityTemplateToken extends FunCityRangedObject {
  /**
   * Token kind.
   */
  readonly kind: 'template';
  /**
   * Template token list.
   */
  readonly tokens: readonly FunCityToken[];
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
  | FunCityDotToken
  | FunCityEndOfLineToken
  | FunCityTextToken
  | FunCityTemplateToken;

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
 * Template (interpolated string) expression node.
 */
export interface FunCityTemplateNode extends FunCityRangedObject {
  /**
   * Node kind.
   */
  readonly kind: 'template';
  /**
   * Template block nodes.
   */
  readonly blocks: readonly FunCityBlockNode[];
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
 * Dot (member access) segment node.
 */
export interface FunCityDotSegment {
  /**
   * Segment name.
   */
  readonly name: string;
  /**
   * Segment is optional access.
   */
  readonly optional: boolean;
  /**
   * Segment name range.
   */
  readonly range: FunCityRange;
  /**
   * Operator range (dot or optional dot).
   */
  readonly operatorRange: FunCityRange;
}

/**
 * Dot (member access) expression node.
 */
export interface FunCityDotNode extends FunCityRangedObject {
  /**
   * Node kind.
   */
  readonly kind: 'dot';
  /**
   * Base expression node.
   */
  readonly base: FunCityExpressionNode;
  /**
   * Member access segments.
   */
  readonly segments: readonly FunCityDotSegment[];
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
  | FunCityTemplateNode
  | FunCityVariableNode
  | FunCityDotNode
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
  readonly info: FunCityErrorEntry;

  constructor(info: FunCityErrorEntry) {
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
   * Append context warning.
   * @param warning - Warning information.
   */
  readonly appendWarning: (warning: FunCityWarningEntry) => void;
  /**
   * Get a bound function with caching for object receivers.
   * @param owner - Method owner object
   * @param fn - Original function
   * @returns Bound function
   */
  readonly getBoundFunction: (owner: object, fn: Function) => Function;
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
  /**
   * Reduce expression node with this context and keep synchronous results synchronous.
   * @param node - Target node
   * @returns Reduced value or promise-like value.
   */
  readonly reduceImmediate: (
    node: FunCityExpressionNode
  ) => FunCityMaybePromise<unknown>;
  /**
   * Reduce block node(s) with this context.
   * @param nodeOrNodes - Target block node or list
   * @returns Reduced values.
   */
  readonly reduceBlock: (
    nodeOrNodes: FunCityBlockNode | readonly FunCityBlockNode[]
  ) => Promise<unknown[]>;
  /**
   * Reduce block node(s) with this context and keep synchronous results synchronous.
   * @param nodeOrNodes - Target block node or list
   * @returns Reduced values or promise-like value.
   */
  readonly reduceBlockImmediate: (
    nodeOrNodes: FunCityBlockNode | readonly FunCityBlockNode[]
  ) => FunCityMaybePromise<unknown[]>;
}

/**
 * Node executor implementation used by reducer contexts.
 */
export interface FunCityReducerExecutor {
  /**
   * Reduce expression node.
   * @param context - Reducer context
   * @param node - Target expression node
   * @param signal - AbortSignal when available.
   * @returns Reduced native value.
   */
  readonly reduceExpressionNode: (
    context: FunCityReducerContext,
    node: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ) => Promise<unknown>;
  /**
   * Reduce expression node while preserving synchronous results.
   * @param context - Reducer context
   * @param node - Target expression node
   * @param signal - AbortSignal when available.
   * @returns Reduced native value or promise-like value.
   */
  readonly reduceExpressionNodeImmediate: (
    context: FunCityReducerContext,
    node: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ) => FunCityMaybePromise<unknown>;
  /**
   * Reduce block node.
   * @param context - Reducer context
   * @param node - Target block node
   * @param signal - AbortSignal when available.
   * @returns Reduced native values.
   */
  readonly reduceNode: (
    context: FunCityReducerContext,
    node: FunCityBlockNode,
    signal: AbortSignal | undefined
  ) => Promise<unknown[]>;
  /**
   * Reduce block node while preserving synchronous results.
   * @param context - Reducer context
   * @param node - Target block node
   * @param signal - AbortSignal when available.
   * @returns Reduced native values or promise-like value.
   */
  readonly reduceNodeImmediate: (
    context: FunCityReducerContext,
    node: FunCityBlockNode,
    signal: AbortSignal | undefined
  ) => FunCityMaybePromise<unknown[]>;
}

/**
 * The reducer context.
 */
export interface FunCityReducerContext {
  /**
   * Get current context (scope) variable value.
   * @param name - Variable name
   * @param signal - AbortSignal when available.
   * @returns Variable value information
   */
  readonly getValue: (
    name: string,
    signal: AbortSignal | undefined
  ) => FunCityReducerContextValueResult;
  /**
   * Set current context (scope) variable value.
   * @param name - Variable name
   * @param value - New value
   * @param signal - AbortSignal when available.
   */
  readonly setValue: (
    name: string,
    value: unknown,
    signal: AbortSignal | undefined
  ) => void;
  /**
   * Get a bound function with caching for object receivers.
   * @param owner - Method owner object
   * @param fn - Original function
   * @returns Bound function
   */
  readonly getBoundFunction: (owner: object, fn: Function) => Function;
  /**
   * Append context warning.
   * @param warning - Warning information.
   */
  readonly appendWarning: (warning: FunCityWarningEntry) => void;
  /**
   * Create new scoped context.
   * @param signal - AbortSignal when available.
   * @returns New reducer context.
   */
  readonly newScope: (signal: AbortSignal | undefined) => FunCityReducerContext;
  /**
   * Get current scope slot version.
   * @returns Slot version.
   */
  readonly getSlotVersion: () => number;
  /**
   * Resolve a variable name to the current scope slot when available.
   * @param name - Variable name
   * @param signal - AbortSignal when available.
   * @returns Slot index or undefined when the current scope does not own it.
   */
  readonly resolveLocalSlot: (
    name: string,
    signal: AbortSignal | undefined
  ) => number | undefined;
  /**
   * Ensure the current scope owns the slot for a variable name.
   * @param name - Variable name
   * @param signal - AbortSignal when available.
   * @returns Slot index.
   */
  readonly ensureLocalSlot: (
    name: string,
    signal: AbortSignal | undefined
  ) => number;
  /**
   * Get a value from the current scope slot.
   * @param slot - Slot index
   * @param signal - AbortSignal when available.
   * @returns Slot value.
   */
  readonly getSlotValue: (
    slot: number,
    signal: AbortSignal | undefined
  ) => unknown;
  /**
   * Set a value to the current scope slot.
   * @param slot - Slot index
   * @param value - New value
   * @param signal - AbortSignal when available.
   */
  readonly setSlotValue: (
    slot: number,
    value: unknown,
    signal: AbortSignal | undefined
  ) => void;
  /**
   * Convert a value to string.
   * @param v - A value
   * @returns String
   */
  readonly convertToString: (v: unknown) => string;
  /**
   * Reduce expression node with this context.
   * @param node - Target expression node
   * @param signal - AbortSignal when available.
   * @returns Reduced native value.
   */
  readonly reduceExpressionNode: (
    node: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ) => Promise<unknown>;
  /**
   * Reduce expression node with this context and keep synchronous results synchronous.
   * @param node - Target expression node
   * @param signal - AbortSignal when available.
   * @returns Reduced native value or promise-like value.
   */
  readonly reduceExpressionNodeImmediate: (
    node: FunCityExpressionNode,
    signal: AbortSignal | undefined
  ) => FunCityMaybePromise<unknown>;
  /**
   * Reduce block node with this context.
   * @param node - Target block node
   * @param signal - AbortSignal when available.
   * @returns Reduced native values.
   */
  readonly reduceNode: (
    node: FunCityBlockNode,
    signal: AbortSignal | undefined
  ) => Promise<unknown[]>;
  /**
   * Reduce block node with this context and keep synchronous results synchronous.
   * @param node - Target block node
   * @param signal - AbortSignal when available.
   * @returns Reduced native values or promise-like value.
   */
  readonly reduceNodeImmediate: (
    node: FunCityBlockNode,
    signal: AbortSignal | undefined
  ) => FunCityMaybePromise<unknown[]>;
  /**
   * Check whether a function is constructable.
   * @param fn - Target function
   * @returns True when constructable.
   */
  readonly isConstructable: (fn: Function) => boolean;
  /**
   * Create native function context proxy.
   * @param thisNode Current node (Indicating the current application is expected)
   * @param signal - AbortSignal when available.
   * @returns Native function context proxy instance.
   */
  readonly createFunctionContext: (
    thisNode: FunCityExpressionNode,
    signal: AbortSignal | undefined
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
   * Source identifier (file path, URL, etc).
   */
  sourceId: string;
  /**
   * Will be stored detected warnings/logs into it.
   */
  logs?: FunCityLogEntry[];
}
