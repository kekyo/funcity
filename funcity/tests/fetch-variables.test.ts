// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type { FunCityBlockNode, FunCityWarningEntry } from '../src/types';
import { runReducer } from '../src/reducer';
import { fetchVariables } from '../src/fetch-variables';
import { buildCandidateVariables } from '../src/standard-variables';
import { applyNode, setNode, stringNode } from './test-utils';

///////////////////////////////////////////////////////////////////////////////////

describe('standard variables test', () => {
  const reduceSingle = async (node: FunCityBlockNode) => {
    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(fetchVariables);
    const reduced = await runReducer([node], variables, warningLogs);
    expect(reduced).toHaveLength(1);
    expect(warningLogs).toEqual([]);
    return reduced[0];
  };

  it('fetch', async () => {
    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(fetchVariables);
    const reduced = await runReducer(
      [
        setNode(
          'res',
          applyNode('fetch', [stringNode('data:text/plain,hello')])
        ),
        applyNode('res.text', []),
      ],
      variables,
      warningLogs
    );
    expect(reduced).toEqual(['hello']);
  });

  it('fetchText', async () => {
    const value = await reduceSingle(
      applyNode('fetchText', [stringNode('data:text/plain,hello')])
    );
    expect(value).toBe('hello');
  });

  it('fetchJson', async () => {
    const value = await reduceSingle(
      applyNode('fetchJson', [
        stringNode('data:application/json,%7B%22ok%22%3Atrue%7D'),
      ])
    );
    expect(value).toEqual({ ok: true });
  });
});
