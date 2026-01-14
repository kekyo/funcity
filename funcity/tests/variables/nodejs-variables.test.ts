// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as nodePath from 'path';
import * as nodeOs from 'os';

import {
  createRequireFunction,
  nodeJsVariables,
} from '../../src/variables/nodejs-variables';

describe('nodejs variables test', () => {
  it('nodeJsVariables exposes readline only', () => {
    expect(Object.keys(nodeJsVariables)).toEqual(['readline']);
    expect(typeof nodeJsVariables.readline).toBe('function');
  });

  it('createRequireFunction resolves from basePath', async () => {
    const dir = await fs.mkdtemp(nodePath.join(nodeOs.tmpdir(), 'funcity-'));
    try {
      const modulePath = nodePath.join(dir, 'sample.cjs');
      await fs.writeFile(
        modulePath,
        "module.exports = { value: 'hello' };",
        'utf8'
      );
      const requireFromDir = createRequireFunction(dir);
      const result = requireFromDir('./sample.cjs') as { value: string };
      expect(result.value).toBe('hello');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
