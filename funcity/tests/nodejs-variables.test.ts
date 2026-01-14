// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as nodePath from 'path';
import * as nodeOs from 'os';

import type { FunCityBlockNode, FunCityWarningEntry } from '../src/types';
import { runReducer } from '../src/reducer';
import { nodeJsVariables } from '../src/nodejs-variables';
import { buildCandidateVariables } from '../src/standard-variables';
import { applyNode, stringNode } from './test-utils';

///////////////////////////////////////////////////////////////////////////////////

describe('nodejs variables test', () => {
  const reduceSingle = async (node: FunCityBlockNode) => {
    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(nodeJsVariables);
    const reduced = await runReducer([node], variables, warningLogs);
    expect(reduced).toHaveLength(1);
    expect(warningLogs).toEqual([]);
    return reduced[0];
  };

  it('path.join', async () => {
    const value = await reduceSingle(
      applyNode('path.join', [stringNode('foo'), stringNode('bar')])
    );
    expect(value).toBe(nodePath.join('foo', 'bar'));
  });

  it('os.platform', async () => {
    const value = await reduceSingle(applyNode('os.platform', []));
    expect(value).toBe(nodeOs.platform());
  });

  it('crypto.randomUUID', async () => {
    const value = await reduceSingle(applyNode('crypto.randomUUID', []));
    expect(typeof value).toBe('string');
    expect(value).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('process.cwd', async () => {
    const value = await reduceSingle(applyNode('process.cwd', []));
    expect(value).toBe(process.cwd());
  });

  it('fs.readFile/writeFile', async () => {
    const dir = await fs.mkdtemp(nodePath.join(nodeOs.tmpdir(), 'funcity-'));
    const filePath = nodePath.join(dir, 'sample.txt');
    try {
      const warningLogs: FunCityWarningEntry[] = [];
      const variables = buildCandidateVariables(nodeJsVariables);
      const reduced = await runReducer(
        [
          applyNode('fs.writeFile', [
            stringNode(filePath),
            stringNode('hello'),
          ]),
          applyNode('fs.readFile', [stringNode(filePath), stringNode('utf8')]),
        ],
        variables,
        warningLogs
      );
      expect(reduced).toEqual(['hello']);
      expect(warningLogs).toEqual([]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
