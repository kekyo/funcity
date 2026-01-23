// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';
import { StringStream } from '@codemirror/language';
import { funcityStreamParser } from '../src/editor/funcity-language';

const tokenizeStyles = (line: string, inExpression: boolean) => {
  const state = { inExpression, inString: false };
  const stream = new StringStream(line, 2, 2);
  const styles: Array<string | null> = [];

  while (!stream.eol()) {
    stream.start = stream.pos;
    const style = funcityStreamParser.token(stream, state);
    styles.push(style);

    if (stream.pos === stream.start) {
      stream.next();
    }
  }

  return styles;
};

describe('funcity stream parser', () => {
  it('returns comment token inside expression', () => {
    const styles = tokenizeStyles('  // comment', true);
    expect(styles).toContain('comment');
  });

  it('does not treat line comments outside expression as comment tokens', () => {
    const styles = tokenizeStyles('// comment', false);
    expect(styles).not.toContain('comment');
  });

  it('highlights escape sequences inside strings', () => {
    const styles = tokenizeStyles("'a\\n\\t'", true);
    const escapes = styles.filter((style) => style === 'escape');
    expect(escapes).toHaveLength(2);
  });
});
