// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import { type FunCityLogEntry } from '../src/types';
import { runCodeTokenizer, runTokenizer } from '../src/tokenizer';

///////////////////////////////////////////////////////////////////////////////////

describe('scripting tokenize test', () => {
  it('empty', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('', logs);

    expect(tokens).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('text block token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('Hello', logs);

    expect(tokens).toEqual([
      {
        kind: 'text',
        text: 'Hello',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 5 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('escaped block braces in text', () => {
    const logs: FunCityLogEntry[] = [];
    // Escaped block braces: 'Hello \{{World\}}'
    const tokens = runTokenizer('Hello \\{{World\\}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'text',
        text: 'Hello {{World}}',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 17 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('literal backslash is kept', () => {
    const logs: FunCityLogEntry[] = [];
    // Escape character '\' is not affected without block braces.
    const tokens = runTokenizer('A\\nB', logs);

    expect(tokens).toEqual([
      {
        kind: 'text',
        text: 'A\\nB',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 4 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('variable token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{hello}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'hello',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('optional variable token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{foo?}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'foo?',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 8 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('code token without block braces', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runCodeTokenizer("foo 123 'bar'", logs);

    expect(tokens).toEqual([
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 5 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'string',
        value: 'bar',
        range: {
          start: { line: 1, column: 9 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('code token with line continuation (LF)', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runCodeTokenizer('add 1 \\\n2', logs);

    expect(tokens).toEqual([
      {
        kind: 'identity',
        name: 'add',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 5 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'number',
        value: 2,
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 1 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('code token with line continuation (CRLF)', () => {
    const logs: FunCityLogEntry[] = [];
    const crlf = String.fromCharCode(13, 10);
    const tokens = runCodeTokenizer(`add 1 \\${crlf}2`, logs);

    expect(tokens).toEqual([
      {
        kind: 'identity',
        name: 'add',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 5 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'number',
        value: 2,
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 1 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('code token with line comment', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runCodeTokenizer('foo // bar\nbaz', logs);

    expect(tokens).toEqual([
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'identity',
        name: 'baz',
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('member access variable token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{foo.bar}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'dot',
        optional: false,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'identity',
        name: 'bar',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 11 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('optional member access variable token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{foo?.bar}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'dot',
        optional: true,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'identity',
        name: 'bar',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 12 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('optional member access with postfix token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{foo?.bar?}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'dot',
        optional: true,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'identity',
        name: 'bar?',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('combined both text and apply body tokens', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('ABC{{hello}}DEF', logs);

    expect(tokens).toEqual([
      {
        kind: 'text',
        text: 'ABC',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'identity',
        name: 'hello',
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 12 },
        },
      },
      {
        kind: 'text',
        text: 'DEF',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 15 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('before space', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{  'hello'}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 5 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('after space', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{'hello'  }}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple lines 2', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{'hello'\n12345}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 5 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 2, column: 6 },
          end: { line: 2, column: 7 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple lines 3', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{'hello'\n12345\nfoobar}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 5 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 6 },
          end: { line: 2, column: 6 },
        },
      },
      {
        kind: 'identity',
        name: 'foobar',
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 6 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 3, column: 7 },
          end: { line: 3, column: 8 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple lines after space', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{'hello'  \n12345}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 12 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 5 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 2, column: 6 },
          end: { line: 2, column: 7 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple lines before space', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{'hello'\n  12345}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 2, column: 3 },
          end: { line: 2, column: 7 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 2, column: 8 },
          end: { line: 2, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('string token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{'hello'}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 11 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('empty string token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{''}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'string',
        value: '',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 4 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 5 },
          end: { line: 1, column: 6 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('string token with escapes', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{'a\\n\\t\\r\\v\\f\\0\\\\\\'b'}}", logs);

    expect(tokens[1]).toMatchObject({
      kind: 'string',
      value: "a\n\t\r\v\f\0\\'b",
    });
    expect(logs).toEqual([]);
  });

  it('string token with invalid escape keeps raw', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{'a\\xb'}}", logs);

    expect(tokens[1]).toMatchObject({
      kind: 'string',
      value: 'a\\xb',
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.description).toBe('invalid escape sequence: \\x');
  });

  it('number token 12345', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{12345}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('number token -1234', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{-1234}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'number',
        value: -1234,
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('number token +1234', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{+1234}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'number',
        value: 1234,
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('number token 12.34', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{12.34}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'number',
        value: 12.34,
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('variable token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{hello}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'hello',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple tokens', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{foo 123 'bar'}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'string',
        value: 'bar',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 15 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 16 },
          end: { line: 1, column: 17 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple token with multiple spaces', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{foo  123  'bar'}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'string',
        value: 'bar',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 17 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 18 },
          end: { line: 1, column: 19 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('variable parenteses token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{(hello)}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'identity',
        name: 'hello',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 9 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 11 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('string parenteses token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{('hello')}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('number parenteses token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{(12345)}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 9 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 11 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple parenteses tokens', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{(foo 123 'bar')}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'string',
        value: 'bar',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 16 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 17 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 18 },
          end: { line: 1, column: 19 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('nested multiple parenteses tokens', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{foo (123) 'bar'}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'string',
        value: 'bar',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 17 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 18 },
          end: { line: 1, column: 19 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('open token before space', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{  (12345)}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 5 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('open token after space', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{(  12345)}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('close token before space', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{(12345  )}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('close token after space', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{(12345)  }}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 9 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('variable bracket token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{[hello]}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '[',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'identity',
        name: 'hello',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 9 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 11 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('string bracket token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{['hello']}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '[',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('number bracket token', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer('{{[12345]}}', logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '[',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 9 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 11 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple bracket tokens', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{[foo 123 'bar']}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'open',
        symbol: '[',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 3 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'string',
        value: 'bar',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 16 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 17 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 18 },
          end: { line: 1, column: 19 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('nested multiple bracket tokens', () => {
    const logs: FunCityLogEntry[] = [];
    const tokens = runTokenizer("{{foo [123] 'bar'}}", logs);

    expect(tokens).toEqual([
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'open',
        symbol: '[',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'string',
        value: 'bar',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 17 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 18 },
          end: { line: 1, column: 19 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });
});
