// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import config from '../vite.config';

////////////////////////////////////////////////////////////////////////////////

describe('build config test', () => {
  it('uses unplugin-dts for declaration generation', () => {
    const pluginNames = (config.plugins ?? []).flatMap((plugin) =>
      plugin && typeof plugin === 'object' && 'name' in plugin
        ? [String(plugin.name)]
        : []
    );
    expect(pluginNames).toContain('unplugin-dts');
  });

  it('suppresses ineffective dynamic import warning for library builds', () => {
    expect(
      config.build?.rolldownOptions?.checks?.ineffectiveDynamicImport
    ).toBe(false);
  });

  it('keeps node builtins externalized for library builds', () => {
    expect(config.build?.rolldownOptions?.external).toEqual(
      expect.arrayContaining(['path', 'module', 'readline'])
    );
  });
});
