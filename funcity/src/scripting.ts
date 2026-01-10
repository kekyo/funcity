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
 * Empty location with zeroed coordinates.
 */
export const emptyLocation: FunCityLocation = {
  line: 0,
  column: 0,
} as const;

/**
 * Empty range with zeroed coordinates.
 */
export const emptyRange: FunCityRange = {
  start: emptyLocation,
  end: emptyLocation,
} as const;

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

/**
 * Variable map used by the reducer.
 */
export type FunCityVariables = ReadonlyMap<string, unknown>;

//////////////////////////////////////////////////////////////////////////////

const specialFunctionMarker: unique symbol = Symbol('$$special$$');

/**
 * Mark a function as a special function.
 * @param f - Target function.
 * @returns The same function with a marker.
 */
export const makeSpecialFunction = (f: Function) => {
  (f as any)[specialFunctionMarker] = true;
  return f;
};

/**
 * Check whether a function is marked as special.
 * @param f - Target function.
 * @returns True when marked.
 */
export const isSpecialFunction = (f: Function): boolean => {
  return (f as any)[specialFunctionMarker] ?? false;
};

/**
 * Evaluate value with the interpreter's conditional semantics.
 * @param v - Target value.
 * @returns True when the value should be treated as truthy.
 */
export const isConditionalTrue = (v: unknown) => {
  if (v === undefined || v === null) {
    return false;
  }
  switch (typeof v) {
    case 'boolean':
      return v;
    case 'number':
    case 'bigint':
      return v !== 0;
    default:
      return true;
  }
};

/**
 * Cast a value to iterable when it has a default iterator.
 * @param v - Target value.
 * @returns Iterable instance or undefined when not iterable.
 */
export const asIterable = (v: unknown): Iterable<unknown> | undefined => {
  if (typeof (v as any)[Symbol.iterator] === 'function') {
    return v as Iterable<unknown>;
  } else {
    return undefined;
  }
};

/**
 * Combine variable maps or records into a single variable map.
 * @param variablesList - Variable sources to merge.
 * @returns Combined variable map.
 */
export const combineVariables = (
  ...variablesList: readonly (FunCityVariables | Record<string, unknown>)[]
): FunCityVariables => {
  const variables = new Map<string, unknown>();

  const appendVariables = (vs: FunCityVariables) =>
    vs.forEach((v, k) => variables.set(k, v));
  const appendRecord = (vs: Record<string, unknown>) =>
    Object.keys(vs).forEach((k) => variables.set(k, vs[k]));

  variablesList.forEach((vs) => {
    if (vs['forEach'] !== undefined) {
      // ReadonlyMap.forEach
      appendVariables(vs as FunCityVariables);
    } else {
      appendRecord(vs as Record<string, unknown>);
    }
  });

  return variables;
};

/**
 * Convert an error object into a human-readable message.
 * @param error - Error object.
 * @returns Error message.
 */
export const fromError = (error: any): string => {
  if (error.message) {
    return error.message;
  } else if (typeof error.toString === 'function') {
    return error.toString() ?? 'unknown';
  } else {
    return 'unknown';
  }
};

/**
 * Build a range that covers all provided ranges.
 * @param ranges - Ranges to cover.
 * @returns The widest range.
 */
export const widerRange = (...ranges: FunCityRange[]): FunCityRange => {
  let start = emptyRange.start;
  let end = emptyRange.end;

  for (const range of ranges) {
    if (range.start.line >= 1 && range.start.column >= 1) {
      if (start.line === 0 || start.column === 0) {
        start = range.start;
      } else if (range.start.line < start.line) {
        start = range.start;
      } else if (
        range.start.line === start.line &&
        range.start.column < start.column
      ) {
        start = range.start;
      }

      if (end.line === 0 || end.column === 0) {
        end = range.end;
      } else if (range.end.line > end.line) {
        end = range.end;
      } else if (range.end.line === end.line && range.end.column > end.column) {
        end = range.end;
      }
    }
  }

  return { start, end };
};

const locationEquals = (lhs: FunCityLocation, rhs: FunCityLocation) =>
  lhs.line === rhs.line && lhs.column === rhs.column;

const getLocationString = (range: FunCityRange) =>
  locationEquals(range.start, range.end)
    ? `${range.start.line}:${range.start.column}`
    : `${range.start.line}:${range.start.column}:${range.end.line}:${range.end.column}`;

const printErrorString = (path: string, error: FunCityErrorInfo) => {
  switch (error.type) {
    case 'warning':
      console.warn(
        `${path}:${getLocationString(error.range)}: warning: ${error.description}`
      );
      break;
    case 'error':
      console.error(
        `${path}:${getLocationString(error.range)}: error: ${error.description}`
      );
      return true;
  }
  return false;
};

/**
 * Output error list and return whether any error-level entry exists.
 * @param path - Source path.
 * @param errors - Errors to output.
 * @returns True when an error-level entry exists.
 */
export const outputErrors = (
  path: string,
  errors: readonly FunCityErrorInfo[]
) => {
  let isError = false;
  for (const error of errors) {
    const result = printErrorString(path, error);
    isError ||= result;
  }
  return isError;
};
