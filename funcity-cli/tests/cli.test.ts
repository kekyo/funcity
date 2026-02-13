// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  createReplSession,
  runMain,
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
    const result = await runScriptToText('Hello {{add 1 2}}', 'hello.fc');
    expect(result.logs).toEqual([]);
    expect(result.output).toBe('Hello 3');
  });

  it('exposes object variables', async () => {
    const iso = '2025-11-23T00:00:00.000Z';
    const result = await runScriptToText(`{{Date '${iso}'}}`, 'hello.fc');
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
      const result = await runScriptToText(script, 'sample.fc', dir);
      expect(result.logs).toEqual([]);
      expect(result.output).toBe('ok');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('executes Fibonacci example from README', async () => {
    const script = `{{\nset fib (fun n \\\n  (cond (le n 1) \\\n    n \\\n    (add (fib (sub n 1)) (fib (sub n 2)))))\n}}\nFibonacci (10) = {{fib 10}}\n`;
    const result = await runScriptToText(script, 'hello.fc');

    expect(result.logs).toEqual([]);
    expect(result.output?.trim()).toBe('Fibonacci (10) = 55');
  });

  it('streams output before reducer errors', async () => {
    const chunks: string[] = [];
    const result = await runScriptToTextStreaming(
      'Hello{{set 1 2}}',
      'hello.fc',
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

describe('funcity-cli include', () => {
  const withTempDir = async (
    root: string,
    prefix: string,
    callback: (dir: string) => Promise<void>
  ): Promise<void> => {
    const dir = await fs.mkdtemp(path.join(root, prefix));
    try {
      await callback(dir);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  };

  it('resolves include in repl from cwd', async () => {
    await withTempDir(
      process.cwd(),
      'funcity-cli-include-repl-',
      async (dir) => {
        const includePath = path.join(dir, 'snippet.fc');
        await fs.writeFile(includePath, 'Hello from repl', 'utf8');
        const relativeDir = path.relative(process.cwd(), dir);
        const session = createReplSession();
        const result = await session.evaluateLine(
          `include './${relativeDir}/snippet.fc'`,
          new AbortController().signal
        );
        expect(result.logs).toEqual([]);
        expect(result.output).toBe('it: Hello from repl');
      }
    );
  });

  it('resolves include in run from script directory with same scope', async () => {
    await withTempDir(os.tmpdir(), 'funcity-cli-include-run-', async (dir) => {
      const includePath = path.join(dir, 'inc.fc');
      await fs.writeFile(includePath, '{{set a 5}}', 'utf8');
      const scriptPath = path.join(dir, 'main.fc');
      const script = "{{include 'inc.fc'}}{{a}}";
      const result = await runScriptToText(script, scriptPath);
      expect(result.logs).toEqual([]);
      expect(result.output).toBe('5');
    });
  });

  it('supports nested includes with relative paths', async () => {
    await withTempDir(
      os.tmpdir(),
      'funcity-cli-include-nested-',
      async (dir) => {
        const subDir = path.join(dir, 'sub');
        await fs.mkdir(subDir, { recursive: true });
        await fs.writeFile(path.join(subDir, 'nested.fc'), 'Nested', 'utf8');
        await fs.writeFile(
          path.join(subDir, 'child.fc'),
          "{{include 'nested.fc'}}",
          'utf8'
        );
        const scriptPath = path.join(dir, 'main.fc');
        const script = "{{include 'sub/child.fc'}}";
        const result = await runScriptToText(script, scriptPath);
        expect(result.logs).toEqual([]);
        expect(result.output).toBe('Nested');
      }
    );
  });

  it('resolves include for stdin from cwd', async () => {
    await withTempDir(
      process.cwd(),
      'funcity-cli-include-stdin-',
      async (dir) => {
        const includePath = path.join(dir, 'stdin.fc');
        await fs.writeFile(includePath, 'Hello stdin', 'utf8');
        const relativeDir = path.relative(process.cwd(), dir);
        const script = `{{include './${relativeDir}/stdin.fc'}}`;
        const result = await runScriptToText(script, '<stdin>');
        expect(result.logs).toEqual([]);
        expect(result.output).toBe('Hello stdin');
      }
    );
  });

  it('reports include parse errors', async () => {
    await withTempDir(
      os.tmpdir(),
      'funcity-cli-include-error-',
      async (dir) => {
        const includePath = path.join(dir, 'bad.fc');
        await fs.writeFile(includePath, '{{if}}{{end}}', 'utf8');
        const scriptPath = path.join(dir, 'main.fc');
        const script = "{{include 'bad.fc'}}";
        const result = await runScriptToText(script, scriptPath);
        expect(result.output).toBeUndefined();
        expect(result.logs.length).toBeGreaterThan(0);
        expect(result.logs[0]?.description).toMatch(/Include parse error/);
      }
    );
  });
});

describe('funcity-cli options', () => {
  const captureStdout = async (
    callback: () => Promise<void>
  ): Promise<string> => {
    const chunks: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((
      chunk: unknown
    ) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);

    try {
      await callback();
      return chunks.join('');
    } finally {
      writeSpy.mockRestore();
    }
  };

  const withTempDir = async (
    callback: (dir: string) => Promise<void>
  ): Promise<void> => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'funcity-cli-main-'));
    try {
      await callback(dir);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  };

  it('supports repeated -d and -D, and -D takes priority', async () => {
    await withTempDir(async (dir) => {
      const scriptPath = path.join(dir, 'script.fc');
      const defineAPath = path.join(dir, 'define-a.json');
      const defineBPath = path.join(dir, 'define-b.json');
      await fs.writeFile(
        scriptPath,
        '{{foo}}|{{bar}}|{{num}}|{{flag}}',
        'utf8'
      );
      await fs.writeFile(
        defineAPath,
        JSON.stringify({ foo: 'json-a', bar: 'first' }),
        'utf8'
      );
      await fs.writeFile(
        defineBPath,
        JSON.stringify({ bar: 'second', num: 7 }),
        'utf8'
      );

      const output = await captureStdout(async () => {
        await runMain([
          'node',
          'funcity',
          '--no-rc',
          '-d',
          defineAPath,
          '-d',
          defineBPath,
          '-D',
          'foo=define',
          '-D',
          'flag',
          '-i',
          scriptPath,
        ]);
      });

      expect(output).toBe('define|second|7|true');
    });
  });

  it('does not treat -D value as command name', async () => {
    await withTempDir(async (dir) => {
      const scriptPath = path.join(dir, 'script.fc');
      await fs.writeFile(scriptPath, '{{repl}}', 'utf8');

      const output = await captureStdout(async () => {
        await runMain([
          'node',
          'funcity',
          '--no-rc',
          '-D',
          'repl',
          '-i',
          scriptPath,
        ]);
      });

      expect(output).toBe('true');
    });
  });

  it('fails when -d JSON root is not object', async () => {
    await withTempDir(async (dir) => {
      const scriptPath = path.join(dir, 'script.fc');
      const definePath = path.join(dir, 'define.json');
      await fs.writeFile(scriptPath, '{{foo}}', 'utf8');
      await fs.writeFile(definePath, JSON.stringify([1, 2, 3]), 'utf8');

      await expect(
        runMain([
          'node',
          'funcity',
          '--no-rc',
          'run',
          '-d',
          definePath,
          '-i',
          scriptPath,
        ])
      ).rejects.toThrow('JSON root must be an object');
    });
  });
});
