// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';
import { createReplSession, runScriptText } from '../src/cli';

describe('funcity-cli repl', () => {
  it('evaluates code and keeps bindings', async () => {
    const session = createReplSession();

    const first = await session.evaluateLine('set x 10');
    expect(first.errors).toEqual([]);
    expect(first.output).toBe('');

    const second = await session.evaluateLine('add x 5');
    expect(second.errors).toEqual([]);
    expect(second.output).toBe('15');
  });

  it('returns parse errors without throwing', async () => {
    const session = createReplSession();

    const result = await session.evaluateLine('set fib (fun n');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('funcity-cli run', () => {
  it('executes script with text blocks', async () => {
    const result = await runScriptText('Hello {{add 1 2}}');
    expect(result.errors).toEqual([]);
    expect(result.output).toBe('Hello 3');
  });

  it('executes Fibonacci example from README', async () => {
    const script = `{{\nset fib (fun n \\\n  (cond (or (equal n 0) (equal n 1)) \\\n    n \\\n    (add (fib (sub n 1)) (fib (sub n 2)))))\n}}\nFibonacci (10) = {{fib 10}}\n`;
    const result = await runScriptText(script);

    expect(result.errors).toEqual([]);
    expect(result.output.trim()).toBe('Fibonacci (10) = 55');
  });
});
