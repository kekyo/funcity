// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type { FunCityLogEntry } from '../src/types';
import { runScriptOnceToText } from '../src/scripting';
import { objectVariables } from '../src/variables/object-variables';
import { buildCandidateVariables } from '../src/variables/standard-variables';

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

  it('passes aggressiveOptimize through the high-level runner', async () => {
    const script = '{{set range (fun [start count] [999])}}{{range 1 3}}';

    const normalLogs: FunCityLogEntry[] = [];
    await expect(
      runScriptOnceToText(script, {
        backend: 'source',
        aggressiveOptimize: false,
        logs: normalLogs,
        sourceId: 'hello.fc',
      })
    ).resolves.toBe('[999]');
    expect(normalLogs).toEqual([]);

    const aggressiveLogs: FunCityLogEntry[] = [];
    await expect(
      runScriptOnceToText(script, {
        backend: 'source',
        aggressiveOptimize: true,
        logs: aggressiveLogs,
        sourceId: 'hello.fc',
      })
    ).resolves.toBe('[1 2 3]');
    expect(aggressiveLogs).toEqual([]);
  });

  it('separates function calls from explicit constructor calls on every execution backend', async () => {
    const widget = function (this: { label?: string }, label: string) {
      if (new.target) {
        this.label = `constructed:${label}`;
        return;
      }
      return `called:${label}`;
    };
    const script =
      "{{Widget 'call'}}{{set instance (new Widget 'ctor')}}{{instance.label}}";

    for (const backend of ['reducer', 'closure', 'source'] as const) {
      const logs: FunCityLogEntry[] = [];
      await expect(
        runScriptOnceToText(script, {
          backend,
          variables: buildCandidateVariables(objectVariables, {
            Widget: widget,
          }),
          logs,
          sourceId: 'hello.fc',
        })
      ).resolves.toBe('called:callconstructed:ctor');
      expect(logs).toEqual([]);
    }
  });
});
