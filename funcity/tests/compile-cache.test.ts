// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import { compileScriptCached } from '../src/compile-cache';

///////////////////////////////////////////////////////////////////////////////////

describe('compile cache test', () => {
  it('reuses the same compiled template entry for the same source', () => {
    const script = 'Hello {{add 1 2}}';
    const sourceId = 'hello.fc';

    const first = compileScriptCached(script, sourceId, 'template');
    const second = compileScriptCached(script, sourceId, 'template');

    expect(second).toBe(first);
    expect(second.program).toBe(first.program);
    expect(second.textProgram).toBe(first.textProgram);
  });

  it('separates cache entries by mode', () => {
    const script = 'add 1 2';
    const sourceId = 'hello.fc';

    const code = compileScriptCached(script, sourceId, 'code');
    const template = compileScriptCached(script, sourceId, 'template');

    expect(code).not.toBe(template);
  });

  it('separates cache entries by execution backend', () => {
    const script = 'Hello {{add 1 2}}';
    const sourceId = 'hello.fc';

    const source = compileScriptCached(script, sourceId, 'template', 'source');
    const closure = compileScriptCached(
      script,
      sourceId,
      'template',
      'closure'
    );
    const reducer = compileScriptCached(
      script,
      sourceId,
      'template',
      'reducer'
    );

    expect(source).not.toBe(closure);
    expect(closure).not.toBe(reducer);
    expect(source.program).not.toBe(closure.program);
    expect(source.textProgram).not.toBe(reducer.textProgram);
  });
});
