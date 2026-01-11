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
      entry,
      name: 'funcity-cli',
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['fs/promises', 'readline', 'commander', 'funcity'],
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
    target: 'es2020',
    sourcemap: true,
    minify: false,
  },
});
