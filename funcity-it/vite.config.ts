// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import prettierMax from 'prettier-max';
import screwUp from 'screw-up';
import dir4Json from 'dir4json';

/**
 * Vite configuration for the web app.
 */
export default defineConfig({
  plugins: [
    react(),
    prettierMax(),
    screwUp({
      outputMetadataFile: true,
    }),
    dir4Json({
      dirs: ['public/samples/'],
    }),
  ],
  build: {
    target: 'es2018',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});
