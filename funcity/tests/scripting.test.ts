// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type { FunCityLogEntry } from '../src/types';
import { runScriptOnceToText } from '../src/scripting';

////////////////////////////////////////////////////////////////////////////////

describe('scripting test', () => {
  it('runs template scripts with every execution backend', async () => {
    const script = 'Hello {{add 1 2}}';

    for (const backend of ['reducer', 'closure', 'source'] as const) {
      const logs: FunCityLogEntry[] = [];
      await expect(
        runScriptOnceToText(script, {
          backend,
          logs,
          sourceId: 'hello.fc',
        })
      ).resolves.toBe('Hello 3');
      expect(logs).toEqual([]);
    }
  });
});
