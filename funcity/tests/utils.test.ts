// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type { FunCityLogEntry, FunCityRange } from '../src/types';
import { convertToString, widerRange } from '../src/utils';

const makeRange = (
  sourceId: string,
  start: { line: number; column: number },
  end: { line: number; column: number }
): FunCityRange => ({
  sourceId,
  start,
  end,
});

describe('widerRange', () => {
  it('logs error on sourceId mismatch', () => {
    const logs: FunCityLogEntry[] = [];
    const rangeA = makeRange(
      'a.fc',
      { line: 1, column: 1 },
      { line: 1, column: 2 }
    );
    const rangeB = makeRange(
      'b.fc',
      { line: 1, column: 3 },
      { line: 1, column: 4 }
    );

    const combined = widerRange(rangeA, rangeB, logs);

    expect(combined).toEqual({
      sourceId: 'a.fc',
      start: { line: 1, column: 1 },
      end: { line: 1, column: 4 },
    });
    expect(logs).toEqual([
      {
        type: 'error',
        description: 'Range sourceId mismatch',
        range: combined,
      },
    ]);
  });

  it('does not log when sourceId matches', () => {
    const logs: FunCityLogEntry[] = [];
    const rangeA = makeRange(
      'same.fc',
      { line: 1, column: 1 },
      { line: 1, column: 2 }
    );
    const rangeB = makeRange(
      'same.fc',
      { line: 1, column: 3 },
      { line: 1, column: 4 }
    );

    widerRange(rangeA, rangeB, logs);

    expect(logs).toEqual([]);
  });
});

describe('convertToString', () => {
  it('stringifies URL values as origins', () => {
    expect(convertToString(new URL('https://example.com/path?q=1'))).toBe(
      'https://example.com'
    );
  });
});
