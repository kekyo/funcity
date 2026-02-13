// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';
import { StringStream } from '@codemirror/language';
import { funcityStreamParser } from '../src/editor/funcity-language';

const createState = () => {
  if (!funcityStreamParser.startState) {
    throw new Error('funcityStreamParser.startState is required');
  }
  return funcityStreamParser.startState(undefined as any);
};

const tokenizeStyles = (line: string, inExpression: boolean) => {
  const state = createState();
  if (inExpression) {
    state.stack.push({ kind: 'expr', braceLength: 2 });
  }
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

const tokenizeTokens = (line: string) => {
  const state = createState();
  const stream = new StringStream(line, 2, 2);
  const tokens: Array<{ text: string; style: string | null }> = [];

  while (!stream.eol()) {
    stream.start = stream.pos;
    const style = funcityStreamParser.token(stream, state);
    const text = stream.current();
    if (text.length > 0) {
      tokens.push({ text, style });
    }
    if (stream.pos === stream.start) {
      stream.next();
    }
  }

  return tokens;
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

  it('highlights double-quoted strings', () => {
    const styles = tokenizeStyles('"a\\n"', true);
    expect(styles).toContain('string');
    expect(styles).toContain('escape');
  });

  it('highlights backtick-quoted strings', () => {
    const styles = tokenizeStyles('`a`', true);
    expect(styles).toContain('string');
  });

  it('highlights triple-quoted strings', () => {
    const tokens = tokenizeTokens("{{'''hello'''}}");
    const tripleQuotes = tokens
      .filter((token) => token.style === 'string' && token.text === "'''")
      .map((token) => token.text);
    expect(tripleQuotes).toHaveLength(2);
  });

  it('highlights elseif as keyword', () => {
    const styles = tokenizeStyles('elseif true', true);
    expect(styles).toContain('keyword');
  });

  it('highlights interpolation braces in text', () => {
    const tokens = tokenizeTokens('Hello {{name}}!');
    const interpolation = tokens
      .filter((token) => token.style === 'interpolation')
      .map((token) => token.text);
    expect(interpolation).toEqual(['{{', '}}']);
  });

  it('highlights interpolation braces inside strings', () => {
    const tokens = tokenizeTokens("{{'Hello {{name}}!'}}");
    const interpolation = tokens
      .filter((token) => token.style === 'interpolation')
      .map((token) => token.text);
    expect(interpolation).toEqual(['{{', '{{', '}}', '}}']);
  });

  it('supports repeated braces for interpolation', () => {
    const tokens = tokenizeTokens('Hello {{{name}}}!');
    const interpolation = tokens
      .filter((token) => token.style === 'interpolation')
      .map((token) => token.text);
    expect(interpolation).toEqual(['{{{', '}}}']);
  });
});
