// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  createReplSession,
  runScriptToText,
  runScriptToTextStreaming,
} from '../src/cli';

describe('funcity-cli repl', () => {
  it('evaluates code and keeps bindings', async () => {
    const session = createReplSession();
    const signal = new AbortController().signal;

    const first = await session.evaluateLine('set x 10', signal);
    expect(first.logs).toEqual([]);
    expect(first.output).toBe('it: (undefined)');

    const second = await session.evaluateLine('add x 5', signal);
    expect(second.logs).toEqual([]);
    expect(second.output).toBe('it: 15');
  });

  it('binds it and its in repl', async () => {
    const session = createReplSession();
    const signal = new AbortController().signal;

    const result = await session.evaluateLine(
      'for i [1 undefined 2]; i; end',
      signal
    );
    expect(result.logs).toEqual([]);
    expect(result.output).toBe('it: 2');

    const itsLength = await session.evaluateLine('length its', signal);
    expect(itsLength.logs).toEqual([]);
    expect(itsLength.output).toBe('it: 2');
  });

  it('returns parse logs without throwing', async () => {
    const session = createReplSession();

    const result = await session.evaluateLine(
      'set fib (fun n',
      new AbortController().signal
    );
    expect(result.logs.length).toBeGreaterThan(0);
  });

  it('can suppress it output', async () => {
    const session = createReplSession();
    const signal = new AbortController().signal;

    const silent = await session.evaluateLine('add 1 2', signal, {
      emitIt: false,
    });
    expect(silent.logs).toEqual([]);
    expect(silent.output).toBe('');

    const next = await session.evaluateLine('add it 1', signal);
    expect(next.logs).toEqual([]);
    expect(next.output).toBe('it: 4');
  });
});

describe('funcity-cli run', () => {
  it('executes script with text blocks', async () => {
    const result = await runScriptToText('Hello {{add 1 2}}');
    expect(result.logs).toEqual([]);
    expect(result.output).toBe('Hello 3');
  });

  it('exposes object variables', async () => {
    const iso = '2025-11-23T00:00:00.000Z';
    const result = await runScriptToText(`{{Date '${iso}'}}`);
    expect(result.logs).toEqual([]);
    expect(result.output).toBe(iso);
  });

  it('executes script that uses require', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'funcity-cli-'));
    try {
      const modulePath = path.join(dir, 'sample.cjs');
      await fs.writeFile(
        modulePath,
        "module.exports = { value: 'ok' };",
        'utf8'
      );
      const script = "{{set mod (require './sample.cjs')}}{{mod.value}}";
      const result = await runScriptToText(script, dir);
      expect(result.logs).toEqual([]);
      expect(result.output).toBe('ok');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('executes Fibonacci example from README', async () => {
    const script = `{{\nset fib (fun n \\\n  (cond (le n 1) \\\n    n \\\n    (add (fib (sub n 1)) (fib (sub n 2)))))\n}}\nFibonacci (10) = {{fib 10}}\n`;
    const result = await runScriptToText(script);

    expect(result.logs).toEqual([]);
    expect(result.output?.trim()).toBe('Fibonacci (10) = 55');
  });

  it('streams output before reducer errors', async () => {
    const chunks: string[] = [];
    const result = await runScriptToTextStreaming(
      'Hello{{set 1 2}}',
      undefined,
      (chunk) => {
        chunks.push(chunk);
      }
    );

    expect(chunks.join('')).toBe('Hello');
    expect(result.output).toBeUndefined();
    expect(result.logs.length).toBeGreaterThan(0);
  });
});
