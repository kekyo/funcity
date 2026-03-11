// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

////////////////////////////////////////////////////////////////////////////////

const execFileAsync = promisify(execFile);
const testsDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(testsDir, '..');

describe('benchmark script test', () => {
  it('writes a timestamped summary under the result root', async () => {
    const resultsRootDir = await mkdtemp(resolve(tmpdir(), 'funcity-bench-'));
    const { stdout } = await execFileAsync(
      'node',
      [
        'scripts/benchmark-jit.mjs',
        '--profile',
        'smoke',
        '--results-root',
        resultsRootDir,
      ],
      {
        cwd: workspaceDir,
      }
    );

    const output = JSON.parse(stdout);
    const entries = await readdir(resultsRootDir, { withFileTypes: true });
    const runDirectory = entries.find((entry) => entry.isDirectory());

    expect(runDirectory?.name).toMatch(/^\d{8}_\d{6}_\d{3}$/);
    expect(output.runId).toBe(runDirectory?.name);

    const summaryPath = resolve(
      resultsRootDir,
      runDirectory?.name ?? '',
      'summary.json'
    );
    const markdownPath = resolve(
      resultsRootDir,
      runDirectory?.name ?? '',
      'summary.md'
    );
    const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
    const markdown = await readFile(markdownPath, 'utf8');

    expect(summary.profile).toBe('smoke');
    expect(summary.runtimeComparisons).toHaveLength(1);
    expect(summary.scenarios).toHaveLength(4);
    expect(
      summary.runtimeComparisons[0]?.benchmarks.map((result) => result.name)
    ).toEqual(['native-node', 'jit-closure', 'jit-source', 'jit-selected']);
    expect(
      summary.scenarios.map(
        (scenario) =>
          scenario.benchmarks.find((result) => result.name === 'jit-selected')
            ?.backend
      )
    ).toEqual(['source', 'source', 'source', 'source']);
    expect(summary.runtimeComparisons[0]?.nativeSource).toContain('fib');
    expect(markdown).toContain('# JIT Benchmark Summary');
    expect(markdown).toContain('## Runtime Comparisons');
  });
});
