// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for unit tests.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: './tests/setup.ts',
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
  },
  define: {
    global: 'globalThis',
  },
});
