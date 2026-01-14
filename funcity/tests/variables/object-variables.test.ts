// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type { FunCityBlockNode, FunCityWarningEntry } from '../../src/types';
import { runReducer } from '../../src/reducer';
import { objectVariables } from '../../src/variables/object-variables';
import { buildCandidateVariables } from '../../src/variables/standard-variables';
import { applyNode, stringNode, variableNode } from '../test-utils';

///////////////////////////////////////////////////////////////////////////////////

describe('object variables test', () => {
  const reduceSingle = async (
    node: FunCityBlockNode,
    extra?: Record<string, unknown>
  ) => {
    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(objectVariables, extra ?? {});
    const reduced = await runReducer([node], variables, warningLogs);
    expect(reduced).toHaveLength(1);
    expect(warningLogs).toEqual([]);
    return reduced[0];
  };

  it('Object.keys', async () => {
    const value = await reduceSingle(
      applyNode('Object.keys', [variableNode('foo')]),
      { foo: { alpha: 1, beta: 2 } }
    );
    expect(value).toStrictEqual(['alpha', 'beta']);
  });

  it('Date constructor', async () => {
    const iso = '2025-11-23T00:00:00.000Z';
    const value = await reduceSingle(applyNode('Date', [stringNode(iso)]));
    expect(value).toBeInstanceOf(Date);
    expect((value as Date).toISOString()).toBe(iso);
  });
});
