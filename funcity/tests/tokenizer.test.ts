// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import { type FunCityErrorInfo } from '../src/types';
import { runCodeTokenizer, runTokenizer } from '../src/tokenizer';

///////////////////////////////////////////////////////////////////////////////////

describe('scripting tokenize test', () => {
  it('empty', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('', errors);

    expect(tokens).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('text block token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('Hello', errors);

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
    expect(errors).toEqual([]);
  });

  it('escaped block braces in text', () => {
    const errors: FunCityErrorInfo[] = [];
    // Escaped block braces: 'Hello \{{World\}}'
    const tokens = runTokenizer('Hello \\{{World\\}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('literal backslash is kept', () => {
    const errors: FunCityErrorInfo[] = [];
    // Escape character '\' is not affected without block braces.
    const tokens = runTokenizer('A\\nB', errors);

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
    expect(errors).toEqual([]);
  });

  it('variable token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{hello}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('code token without block braces', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runCodeTokenizer("foo 123 'bar'", errors);

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
    expect(errors).toEqual([]);
  });

  it('code token with line continuation (LF)', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runCodeTokenizer('add 1 \\\n2', errors);

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
    expect(errors).toEqual([]);
  });

  it('code token with line continuation (CRLF)', () => {
    const errors: FunCityErrorInfo[] = [];
    const crlf = String.fromCharCode(13, 10);
    const tokens = runCodeTokenizer(`add 1 \\${crlf}2`, errors);

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
    expect(errors).toEqual([]);
  });

  it('member access variable token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{foo.bar}}', errors);

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
        name: 'foo.bar',
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
    expect(errors).toEqual([]);
  });

  it('combined both text and apply body tokens', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('ABC{{hello}}DEF', errors);

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
    expect(errors).toEqual([]);
  });

  it('before space', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{  'hello'}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('after space', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{'hello'  }}", errors);

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
    expect(errors).toEqual([]);
  });

  it('multiple lines 2', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{'hello'\n12345}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('multiple lines 3', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{'hello'\n12345\nfoobar}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('multiple lines after space', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{'hello'  \n12345}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('multiple lines before space', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{'hello'\n  12345}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('string token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{'hello'}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('empty string token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{''}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('string token with escapes', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{'a\\n\\t\\r\\v\\f\\0\\\\\\'b'}}", errors);

    expect(tokens[1]).toMatchObject({
      kind: 'string',
      value: "a\n\t\r\v\f\0\\'b",
    });
    expect(errors).toEqual([]);
  });

  it('string token with invalid escape keeps raw', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{'a\\xb'}}", errors);

    expect(tokens[1]).toMatchObject({
      kind: 'string',
      value: 'a\\xb',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.description).toBe('invalid escape sequence: \\x');
  });

  it('number token 12345', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{12345}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('number token -1234', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{-1234}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('number token +1234', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{+1234}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('number token 12.34', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{12.34}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('variable token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{hello}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('multiple tokens', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{foo 123 'bar'}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('multiple token with multiple spaces', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{foo  123  'bar'}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('variable parenteses token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{(hello)}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('string parenteses token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{('hello')}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('number parenteses token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{(12345)}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('multiple parenteses tokens', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{(foo 123 'bar')}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('nested multiple parenteses tokens', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{foo (123) 'bar'}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('open token before space', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{  (12345)}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('open token after space', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{(  12345)}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('close token before space', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{(12345  )}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('close token after space', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{(12345)  }}', errors);

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
    expect(errors).toEqual([]);
  });

  it('variable bracket token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{[hello]}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('string bracket token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{['hello']}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('number bracket token', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer('{{[12345]}}', errors);

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
    expect(errors).toEqual([]);
  });

  it('multiple bracket tokens', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{[foo 123 'bar']}}", errors);

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
    expect(errors).toEqual([]);
  });

  it('nested multiple bracket tokens', () => {
    const errors: FunCityErrorInfo[] = [];
    const tokens = runTokenizer("{{foo [123] 'bar'}}", errors);

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
    expect(errors).toEqual([]);
  });
});
