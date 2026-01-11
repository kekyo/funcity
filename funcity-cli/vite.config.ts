// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';
import dts from 'vite-plugin-dts';
import prettierMax from 'prettier-max';
import screwUp from 'screw-up';

const entry = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  'src/index.ts'
);

const builtins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

/**
 * Vite configuration for building the CLI bundle.
 */
export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
    prettierMax(),
    screwUp({
      outputMetadataFile: true,
    }),
  ],
  resolve: {
    conditions: ['node'],
  },
  build: {
    lib: {
      entry,
      name: 'funcity-cli',
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    ssr: true,
    rollupOptions: {
      input: entry,
      external: ['commander', 'funcity', ...builtins],
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
    target: 'node20',
    sourcemap: true,
    minify: false,
  },
});
