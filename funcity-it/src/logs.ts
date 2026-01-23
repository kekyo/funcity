// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import type { FunCityLocation, FunCityLogEntry, FunCityRange } from 'funcity';

const locationEquals = (lhs: FunCityLocation, rhs: FunCityLocation) =>
  lhs.line === rhs.line && lhs.column === rhs.column;

export const formatRange = (range: FunCityRange) =>
  locationEquals(range.start, range.end)
    ? `${range.start.line}:${range.start.column}`
    : `${range.start.line}:${range.start.column}:${range.end.line}:${range.end.column}`;

export const formatLogEntry = (entry: FunCityLogEntry, path = 'script') =>
  `${path}:${formatRange(entry.range)}: ${entry.type}: ${entry.description}`;

export const formatLogEntries = (
  entries: readonly FunCityLogEntry[],
  path = 'script'
) => entries.map((entry) => formatLogEntry(entry, path));

export const formatException = (error: unknown, label = 'exception') => {
  if (error instanceof Error) {
    const name = error.name || 'Error';
    const detail = error.message ? `: ${error.message}` : '';
    return `${label}: ${name}${detail}`;
  }
  return `${label}: ${String(error)}`;
};
