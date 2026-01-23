// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';
import { resolveBasePath } from '../src/paths';

describe('resolveBasePath', () => {
  it('uses the root base URL by default', () => {
    expect(resolveBasePath('samples/demo.txt', '/')).toBe('/samples/demo.txt');
  });

  it('handles asset paths that already start with a slash', () => {
    expect(resolveBasePath('/samples/demo.txt', '/')).toBe('/samples/demo.txt');
  });

  it('normalizes a base URL without a trailing slash', () => {
    expect(resolveBasePath('images/logo.png', '/funcity')).toBe(
      '/funcity/images/logo.png'
    );
  });

  it('preserves a base URL with a trailing slash', () => {
    expect(resolveBasePath('images/logo.png', '/funcity/')).toBe(
      '/funcity/images/logo.png'
    );
  });

  it('returns the normalized base URL when no asset path is provided', () => {
    expect(resolveBasePath('', '/funcity')).toBe('/funcity/');
  });

  it('falls back to the root base URL when base URL is empty', () => {
    expect(resolveBasePath('samples/demo.txt', '')).toBe('/samples/demo.txt');
  });
});
