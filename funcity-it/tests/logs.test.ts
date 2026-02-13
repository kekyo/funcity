// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';
import type { FunCityLogEntry } from 'funcity';
import { formatException, formatLogEntries, formatRange } from '../src/logs';

const sourceId = 'unknown.fc';

describe('formatRange', () => {
  it('formats single location', () => {
    const range = {
      sourceId,
      start: { line: 1, column: 2 },
      end: { line: 1, column: 2 },
    };
    expect(formatRange(range)).toBe('1:2');
  });

  it('formats range location', () => {
    const range = {
      sourceId,
      start: { line: 1, column: 2 },
      end: { line: 2, column: 3 },
    };
    expect(formatRange(range)).toBe('1:2:2:3');
  });
});

describe('formatLogEntries', () => {
  it('formats entries with sourceId', () => {
    const entry: FunCityLogEntry = {
      type: 'error',
      description: 'boom',
      range: {
        sourceId,
        start: { line: 1, column: 2 },
        end: { line: 1, column: 2 },
      },
    };
    expect(formatLogEntries([entry])[0]).toBe('unknown.fc:1:2: error: boom');
  });
});

describe('formatException', () => {
  it('formats Error instance', () => {
    expect(formatException(new Error('failed'))).toBe(
      'exception: Error: failed'
    );
  });

  it('formats non-Error value', () => {
    expect(formatException('oops')).toBe('exception: oops');
  });
});
