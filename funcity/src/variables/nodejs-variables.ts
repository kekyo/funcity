// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import * as path from 'path';
import process from 'process';
import * as nodeReadline from 'readline';
import { createRequire } from 'module';

import type { FunCityFunctionContext } from '../types';

//////////////////////////////////////////////////////////////////////////////

/**
 * Create a Node.js require function bound to a base directory.
 * @param basePath - Base directory for module resolution.
 * @returns The require function bound to basePath.
 */
export const createRequireFunction = (
  basePath?: string
): ReturnType<typeof createRequire> => {
  const baseDir = path.resolve(basePath ?? process.cwd());
  const entryPath = path.join(baseDir, '__funcity__.js');
  return createRequire(entryPath);
};

/**
 * Built-in Node.js variables and functions.
 */
export const nodeJsVariables = Object.freeze({
  readline: async function (this: FunCityFunctionContext, prompt?: unknown) {
    const question = prompt === undefined ? '' : this.convertToString(prompt);
    const signal = this.abortSignal;

    return await new Promise<string>((resolve, reject) => {
      const rl = nodeReadline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      let settled = false;

      const cleanup = () => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        rl.close();
      };

      const finishResolve = (value: string) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      };

      const finishReject = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };

      const onAbort = () => {
        const abortError = new Error('Aborted');
        (abortError as { name?: string }).name = 'AbortError';
        finishReject(abortError);
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      rl.question(question, (answer) => {
        finishResolve(answer);
      });
    });
  },
} as const);
