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

// Helper utilities for filtering module specifiers.
const isPathSpecifier = (moduleId: string): boolean => {
  if (moduleId === '.' || moduleId === '..') {
    return true;
  }
  return (
    moduleId.startsWith('./') ||
    moduleId.startsWith('../') ||
    moduleId.startsWith('file:') ||
    path.isAbsolute(moduleId)
  );
};

const getBaseModuleName = (moduleId: string): string | undefined => {
  if (moduleId.startsWith('@')) {
    const segments = moduleId.split('/');
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : moduleId;
  }
  const slashIndex = moduleId.indexOf('/');
  return slashIndex >= 0 ? moduleId.slice(0, slashIndex) : moduleId;
};

/**
 * Create a Node.js require function bound to a base directory.
 * @param basePath - Base directory for module resolution.
 * @param acceptModules - Allowed module names. When omitted, any module is allowed.
 * @returns The require function bound to basePath.
 */
export const createRequireFunction = (
  basePath?: string,
  acceptModules?: readonly string[]
): ReturnType<typeof createRequire> => {
  const baseDir = path.resolve(basePath ?? process.cwd());
  const entryPath = path.join(baseDir, '__funcity__.js');
  const baseRequire = createRequire(entryPath);

  if (!acceptModules || acceptModules.length === 0) {
    return baseRequire;
  }

  const allowedModules = new Set(acceptModules);

  const isAllowedModule = (moduleId: string): boolean => {
    if (allowedModules.has(moduleId)) {
      return true;
    }

    const normalizedId = moduleId.startsWith('node:')
      ? moduleId.slice('node:'.length)
      : moduleId;

    if (allowedModules.has(normalizedId)) {
      return true;
    }

    if (isPathSpecifier(normalizedId)) {
      return false;
    }

    const baseModule = getBaseModuleName(normalizedId);
    if (!baseModule) {
      return false;
    }

    return (
      allowedModules.has(baseModule) || allowedModules.has(`node:${baseModule}`)
    );
  };

  const requireWithFilter = ((moduleId: string) => {
    if (typeof moduleId === 'string' && !isAllowedModule(moduleId)) {
      const error = new Error(`Module is not allowed: ${moduleId}`);
      (error as { code?: string }).code = 'MODULE_NOT_ALLOWED';
      throw error;
    }
    return baseRequire(moduleId);
  }) as ReturnType<typeof createRequire>;

  requireWithFilter.resolve = baseRequire.resolve;
  requireWithFilter.cache = baseRequire.cache;
  requireWithFilter.extensions = baseRequire.extensions;
  requireWithFilter.main = baseRequire.main;

  return requireWithFilter;
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
