// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  FunCityLogEntry,
  FunCityLogEntryWriter,
  FunCityLocation,
  FunCityRange,
  FunCityVariables,
} from './types';

//////////////////////////////////////////////////////////////////////////////

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

const specialFunctionMarker: unique symbol = Symbol('$$special$$');

/**
 * Mark a function as a funcity special function.
 * @param f - Target function.
 * @returns The same function with a marker.
 */
export const makeFunCityFunction = (f: Function) => {
  (f as any)[specialFunctionMarker] = true;
  return f;
};

/**
 * Check whether a function is marked as funcity special function.
 * @param f - Target function.
 * @returns True when marked.
 */
export const isFunCityFunction = (f: Function): boolean => {
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

const printErrorString = (
  path: string,
  error: FunCityLogEntry,
  writer: FunCityLogEntryWriter
) => {
  switch (error.type) {
    case 'warning':
      writer.warn(
        `${path}:${getLocationString(error.range)}: warning: ${error.description}`
      );
      break;
    case 'error':
      writer.error(
        `${path}:${getLocationString(error.range)}: error: ${error.description}`
      );
      return true;
  }
  return false;
};

/**
 * Output error list and return whether any error-level entry exists.
 * @param path - Source path.
 * @param logs - Errors to output.
 * @param writer - Writer interface.
 * @returns True when an error-level entry exists.
 */
export const outputErrors = (
  path: string,
  logs: readonly FunCityLogEntry[],
  writer?: FunCityLogEntryWriter
) => {
  const _writer = writer ?? console;
  let isError = false;
  for (const error of logs) {
    const result = printErrorString(path, error, _writer);
    isError ||= result;
  }
  return isError;
};

export const internalConvertToString = (
  v: unknown,
  getFuncId: (fn: Function) => number
): string => {
  switch (v) {
    case undefined:
      return '(undefined)';
    case null:
      return '(null)';
    default:
      switch (typeof v) {
        case 'string':
          return v;
        case 'boolean':
          return v ? 'true' : 'false';
        case 'number':
        case 'bigint':
        case 'symbol':
          return v.toString();
        case 'function':
          if (v.name) {
            return `fun<${v.name}:#${getFuncId(v)}>`;
          } else {
            return `fun<#${getFuncId(v)}>`;
          }
        default:
          if (Array.isArray(v)) {
            return JSON.stringify(v);
          }
          const iterable = asIterable(v);
          if (iterable) {
            const arr = Array.from(iterable);
            return JSON.stringify(arr);
          } else if (v instanceof Date) {
            return v.toISOString();
          } else if (v instanceof Error) {
            return `${v.name}: ${v.message}`;
          } else if (v instanceof URL) {
            return v.origin;
          } else {
            return JSON.stringify(v);
          }
      }
  }
};

export const internalCreateFunctionIdGenerator = () => {
  const funcIds = new WeakMap<Function, number>();
  let nextId = 1;

  const getFuncId = (fn: Function) => {
    const cached = funcIds.get(fn);
    if (cached) {
      return cached;
    }
    const id = nextId++;
    funcIds.set(fn, id);
    return id;
  };
  return getFuncId;
};

const getGlobalFuncId = internalCreateFunctionIdGenerator();

/**
 * Convert to string.
 * @param v Target instance
 * @returns String
 */
export const convertToString = (v: unknown): string =>
  internalConvertToString(v, getGlobalFuncId);
