// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

//////////////////////////////////////////////////////////////////////////////

export interface FunCityLocation {
  readonly line: number;
  readonly column: number;
}

export interface FunCityRange {
  readonly start: FunCityLocation;
  readonly end: FunCityLocation;
}

export const emptyLocation: FunCityLocation = {
  line: 0,
  column: 0,
} as const;

export const emptyRange: FunCityRange = {
  start: emptyLocation,
  end: emptyLocation,
} as const;

export type FunCityErrorType = 'warning' | 'error';

export interface FunCityErrorInfo {
  readonly type: FunCityErrorType;
  readonly description: string;
  readonly range: FunCityRange;
}

export type FunCityVariables = ReadonlyMap<string, unknown>;

//////////////////////////////////////////////////////////////////////////////

const specialFunctionMarker: unique symbol = Symbol('$$special$$');

export const makeSpecialFunction = (f: Function) => {
  (f as any)[specialFunctionMarker] = true;
  return f;
};

export const isSpecialFunction = (f: Function): boolean => {
  return (f as any)[specialFunctionMarker] ?? false;
};

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

export const asIterable = (v: unknown): Iterable<unknown> | undefined => {
  if (typeof (v as any)[Symbol.iterator] === 'function') {
    return v as Iterable<unknown>;
  } else {
    return undefined;
  }
};

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

export const fromError = (error: any): string => {
  if (error.message) {
    return error.message;
  } else if (typeof error.toString === 'function') {
    return error.toString() ?? 'unknown';
  } else {
    return 'unknown';
  }
};

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
