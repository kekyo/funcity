// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import dts from 'vite-plugin-dts';
import prettierMax from 'prettier-max';
import screwUp from 'screw-up';

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
  build: {
    lib: {
      entry: {
        index: resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'src/index.ts'
        ),
      },
      name: 'funcity-cli',
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'fs/promises',
        'commander',
        'funcity',
        'path',
        'os',
        'crypto',
        'process',
        'readline',
      ],
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
    target: 'node18',
    sourcemap: true,
    minify: false,
  },
  esbuild: {
    platform: 'node',
  },
});
