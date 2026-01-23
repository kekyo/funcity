// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';
import { DEFAULT_SCRIPT } from '../src/default-script';
import { extractScriptFromSearch, getInitialScript } from '../src/query';

describe('extractScriptFromSearch', () => {
  it('returns undefined when no query string', () => {
    expect(extractScriptFromSearch('')).toBeUndefined();
  });

  it('returns script when present', () => {
    expect(extractScriptFromSearch('?script=hello')).toBe('hello');
  });
});

describe('getInitialScript', () => {
  it('returns default script when missing', () => {
    expect(getInitialScript('')).toBe(DEFAULT_SCRIPT);
  });

  it('returns default script when empty', () => {
    expect(getInitialScript('?script=')).toBe(DEFAULT_SCRIPT);
  });

  it('returns decoded script', () => {
    const script = getInitialScript('?script=hello%0Aworld');
    expect(script).toBe('hello\nworld');
  });
});
