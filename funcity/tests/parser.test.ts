// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type { FunCityLogEntry, FunCityToken } from '../src/types';
import { parseExpressions, runParser } from '../src/parser';

///////////////////////////////////////////////////////////////////////////////////

describe('scripting parser test', () => {
  it('nop token 1', () => {
    // ""
    const token: FunCityToken[] = [];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // ""
    expect(nodes).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('nop token 2', () => {
    // "{{}}"
    const token: FunCityToken[] = [
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{}}"
    expect(nodes).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('number token', () => {
    // "{{12345}}"
    const token: FunCityToken[] = [
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{12345}}"
    expect(nodes).toEqual([
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 7 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('string token', () => {
    // "{{'hello'}}"
    const token: FunCityToken[] = [
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{'hello'}}"
    expect(nodes).toEqual([
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('variable token', () => {
    // "{{foobar}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{foobar}}"
    expect(nodes).toEqual([
      {
        kind: 'variable',
        name: 'foobar',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 8 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('member access variable token', () => {
    // "{{foo.bar}}"
    const token: FunCityToken[] = [
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{foo.bar}}"
    expect(nodes).toEqual([
      {
        kind: 'variable',
        name: 'foo.bar',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('both text and number body', () => {
    // "Hello{{123}}World"
    const token: FunCityToken[] = [
      {
        kind: 'text',
        text: 'Hello',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 6 },
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
        symbol: '}}',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 12 },
        },
      },
      {
        kind: 'text',
        text: 'World',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 17 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "Hello{{123}}World"
    expect(nodes).toEqual([
      {
        kind: 'text',
        text: 'Hello',
        range: {
          start: { line: 1, column: 1 },
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
        kind: 'text',
        text: 'World',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 17 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple tokens application', () => {
    // "{{foobar 'hello' 12345}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 16 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 18 },
          end: { line: 1, column: 22 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 23 },
          end: { line: 1, column: 24 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{foobar 'hello' 12345}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'foobar',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 8 },
          },
        },
        args: [
          {
            kind: 'string',
            value: 'hello',
            range: {
              start: { line: 1, column: 10 },
              end: { line: 1, column: 16 },
            },
          },
          {
            kind: 'number',
            value: 12345,
            range: {
              start: { line: 1, column: 18 },
              end: { line: 1, column: 22 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 22 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('nested application tokens', () => {
    // "{{foobar (baz 12345)}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'identity',
        name: 'baz',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 13 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 15 },
          end: { line: 1, column: 19 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 20 },
          end: { line: 1, column: 20 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 21 },
          end: { line: 1, column: 23 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{foobar (baz 12345)}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'foobar',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 8 },
          },
        },
        args: [
          {
            kind: 'apply',
            func: {
              kind: 'variable',
              name: 'baz',
              range: {
                start: { line: 1, column: 11 },
                end: { line: 1, column: 13 },
              },
            },
            args: [
              {
                kind: 'number',
                value: 12345,
                range: {
                  start: { line: 1, column: 15 },
                  end: { line: 1, column: 19 },
                },
              },
            ],
            range: {
              start: { line: 1, column: 11 },
              end: { line: 1, column: 19 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 19 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('nested application tokens (empty argument)', () => {
    // "{{foobar ()}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 10 },
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{foobar ()}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'foobar',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 8 },
          },
        },
        args: [],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 11 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('nested application tokens (empty argument 2)', () => {
    // "{{foobar (baz ())}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'identity',
        name: 'baz',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 13 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 15 },
          end: { line: 1, column: 15 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 16 },
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{foobar (baz ())}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'foobar',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 8 },
          },
        },
        args: [
          {
            kind: 'apply',
            func: {
              kind: 'variable',
              name: 'baz',
              range: {
                start: { line: 1, column: 11 },
                end: { line: 1, column: 13 },
              },
            },
            args: [],
            range: {
              start: { line: 1, column: 11 },
              end: { line: 1, column: 16 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 16 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple tokens application with eol (1)', () => {
    // "{{foobar\n12345}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 9 },
          end: { line: 1, column: 9 },
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{foobar\n12345}}"
    expect(nodes).toEqual([
      {
        kind: 'scope',
        nodes: [
          {
            kind: 'variable',
            name: 'foobar',
            range: {
              start: { line: 1, column: 3 },
              end: { line: 1, column: 8 },
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
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 2, column: 5 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple tokens application with eol (2)', () => {
    // "{{12345\n'ABC'}}"
    const token: FunCityToken[] = [
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
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 9 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'string',
        value: 'ABC',
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{12345\n'ABC'}}"
    expect(nodes).toEqual([
      {
        kind: 'scope',
        nodes: [
          {
            kind: 'number',
            value: 12345,
            range: {
              start: { line: 1, column: 3 },
              end: { line: 1, column: 8 },
            },
          },
          {
            kind: 'string',
            value: 'ABC',
            range: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 5 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 2, column: 5 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('parentheses number token', () => {
    // "{{(12345)}}"
    const token: FunCityToken[] = [
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
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{(12345)}}"
    expect(nodes).toEqual([
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 8 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('parentheses string token', () => {
    // "{{('hello')}}"
    const token: FunCityToken[] = [
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{('hello')}}"
    expect(nodes).toEqual([
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 10 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('parentheses variable token', () => {
    // "{{(foobar)}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 10 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 22 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    expect(nodes).toEqual([
      {
        kind: 'variable',
        name: 'foobar',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('parentheses multiple tokens', () => {
    // "{{(foobar 'hello' 12345)}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 17 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 19 },
          end: { line: 1, column: 23 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 24 },
          end: { line: 1, column: 24 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 25 },
          end: { line: 1, column: 26 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{(foobar 'hello' 12345)}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'foobar',
          range: {
            start: { line: 1, column: 4 },
            end: { line: 1, column: 9 },
          },
        },
        args: [
          {
            kind: 'string',
            value: 'hello',
            range: {
              start: { line: 1, column: 11 },
              end: { line: 1, column: 17 },
            },
          },
          {
            kind: 'number',
            value: 12345,
            range: {
              start: { line: 1, column: 19 },
              end: { line: 1, column: 23 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 23 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('parentheses multiple scoped tokens', () => {
    // "{{(foobar\n'hello'\n12345)}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 4 },
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
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 7 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 8 },
          end: { line: 2, column: 8 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 5 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 3, column: 6 },
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{(foobar\n'hello'\n12345)}}"
    expect(nodes).toEqual([
      {
        kind: 'scope',
        nodes: [
          {
            kind: 'variable',
            name: 'foobar',
            range: {
              start: { line: 1, column: 4 },
              end: { line: 1, column: 9 },
            },
          },
          {
            kind: 'string',
            value: 'hello',
            range: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 7 },
            },
          },
          {
            kind: 'number',
            value: 12345,
            range: {
              start: { line: 3, column: 1 },
              end: { line: 3, column: 5 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 3, column: 6 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('nested parentheses multiple tokens', () => {
    // "{{foo (bar (baz 'hello') 12345) hoge}}"
    const token: FunCityToken[] = [
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
        kind: 'identity',
        name: 'bar',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'open',
        symbol: '(',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 12 },
        },
      },
      {
        kind: 'identity',
        name: 'baz',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 15 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 23 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 24 },
          end: { line: 1, column: 24 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 26 },
          end: { line: 1, column: 30 },
        },
      },
      {
        kind: 'close',
        symbol: ')',
        range: {
          start: { line: 1, column: 31 },
          end: { line: 1, column: 31 },
        },
      },
      {
        kind: 'identity',
        name: 'hoge',
        range: {
          start: { line: 1, column: 33 },
          end: { line: 1, column: 36 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 37 },
          end: { line: 1, column: 38 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{foo (bar (baz 'hello') 12345) hoge}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'foo',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 5 },
          },
        },
        args: [
          {
            kind: 'apply',
            func: {
              kind: 'variable',
              name: 'bar',
              range: {
                start: { line: 1, column: 8 },
                end: { line: 1, column: 10 },
              },
            },
            args: [
              {
                kind: 'apply',
                func: {
                  kind: 'variable',
                  name: 'baz',
                  range: {
                    start: { line: 1, column: 13 },
                    end: { line: 1, column: 15 },
                  },
                },
                args: [
                  {
                    kind: 'string',
                    value: 'hello',
                    range: {
                      start: { line: 1, column: 17 },
                      end: { line: 1, column: 23 },
                    },
                  },
                ],
                range: {
                  start: { line: 1, column: 13 },
                  end: { line: 1, column: 23 },
                },
              },
              {
                kind: 'number',
                value: 12345,
                range: {
                  start: { line: 1, column: 26 },
                  end: { line: 1, column: 30 },
                },
              },
            ],
            range: {
              start: { line: 1, column: 8 },
              end: { line: 1, column: 30 },
            },
          },
          {
            kind: 'variable',
            name: 'hoge',
            range: {
              start: { line: 1, column: 33 },
              end: { line: 1, column: 36 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 36 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('bracket number token', () => {
    // "{{[12345]}}"
    const token: FunCityToken[] = [
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{[12345]}}"
    expect(nodes).toEqual([
      {
        kind: 'list',
        items: [
          {
            kind: 'number',
            value: 12345,
            range: {
              start: { line: 1, column: 4 },
              end: { line: 1, column: 8 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 9 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('bracket string token', () => {
    // "{{['hello']}}"
    const token: FunCityToken[] = [
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{['hello']}}"
    expect(nodes).toEqual([
      {
        kind: 'list',
        items: [
          {
            kind: 'string',
            value: 'hello',
            range: {
              start: { line: 1, column: 4 },
              end: { line: 1, column: 10 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 11 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('bracket variable token', () => {
    // "{{[foobar]}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 10 },
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{[foobar]}}"
    expect(nodes).toEqual([
      {
        kind: 'list',
        items: [
          {
            kind: 'variable',
            name: 'foobar',
            range: {
              start: { line: 1, column: 4 },
              end: { line: 1, column: 9 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 10 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('bracket multiple tokens', () => {
    // "{{[foobar 'hello' 12345]}}"
    const token: FunCityToken[] = [
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
        name: 'foobar',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 17 },
        },
      },
      {
        kind: 'number',
        value: 12345,
        range: {
          start: { line: 1, column: 19 },
          end: { line: 1, column: 23 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 24 },
          end: { line: 1, column: 24 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 25 },
          end: { line: 1, column: 26 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{[foobar 'hello' 12345]}}"
    expect(nodes).toEqual([
      {
        kind: 'list',
        items: [
          {
            kind: 'variable',
            name: 'foobar',
            range: {
              start: { line: 1, column: 4 },
              end: { line: 1, column: 9 },
            },
          },
          {
            kind: 'string',
            value: 'hello',
            range: {
              start: { line: 1, column: 11 },
              end: { line: 1, column: 17 },
            },
          },
          {
            kind: 'number',
            value: 12345,
            range: {
              start: { line: 1, column: 19 },
              end: { line: 1, column: 23 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 24 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('nested bracket multiple tokens', () => {
    // "{{foo [123 [bar 'hello'] 456] baz}}"
    const token: FunCityToken[] = [
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
        kind: 'open',
        symbol: '[',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 12 },
        },
      },
      {
        kind: 'identity',
        name: 'bar',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 15 },
        },
      },
      {
        kind: 'string',
        value: 'hello',
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 23 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 24 },
          end: { line: 1, column: 24 },
        },
      },
      {
        kind: 'number',
        value: 456,
        range: {
          start: { line: 1, column: 26 },
          end: { line: 1, column: 28 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 29 },
          end: { line: 1, column: 29 },
        },
      },
      {
        kind: 'identity',
        name: 'baz',
        range: {
          start: { line: 1, column: 31 },
          end: { line: 1, column: 33 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 34 },
          end: { line: 1, column: 35 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{foo [123 [bar 'hello'] 456] baz}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'foo',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 5 },
          },
        },
        args: [
          {
            kind: 'list',
            items: [
              {
                kind: 'number',
                value: 123,
                range: {
                  start: { line: 1, column: 8 },
                  end: { line: 1, column: 10 },
                },
              },
              {
                kind: 'list',
                items: [
                  {
                    kind: 'variable',
                    name: 'bar',
                    range: {
                      start: { line: 1, column: 13 },
                      end: { line: 1, column: 15 },
                    },
                  },
                  {
                    kind: 'string',
                    value: 'hello',
                    range: {
                      start: { line: 1, column: 17 },
                      end: { line: 1, column: 23 },
                    },
                  },
                ],
                range: {
                  start: { line: 1, column: 12 },
                  end: { line: 1, column: 24 },
                },
              },
              {
                kind: 'number',
                value: 456,
                range: {
                  start: { line: 1, column: 26 },
                  end: { line: 1, column: 28 },
                },
              },
            ],
            range: {
              start: { line: 1, column: 7 },
              end: { line: 1, column: 29 },
            },
          },
          {
            kind: 'variable',
            name: 'baz',
            range: {
              start: { line: 1, column: 31 },
              end: { line: 1, column: 33 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 33 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('conditional token (if)', () => {
    // "{{if 1\n123\nend}}"
    const token: FunCityToken[] = [
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
        name: 'if',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 4 },
        },
      },
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 4 },
          end: { line: 2, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 3 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 3, column: 4 },
          end: { line: 3, column: 5 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{if 1\n123\nend}}"
    expect(nodes).toEqual([
      {
        kind: 'if',
        condition: {
          kind: 'number',
          value: 1,
          range: {
            start: { line: 1, column: 6 },
            end: { line: 1, column: 6 },
          },
        },
        then: [
          {
            kind: 'number',
            value: 123,
            range: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 3 },
            },
          },
        ],
        else: [],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 3, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('conditional token (applied if)', () => {
    // "{{if 1\nfoo 123\nend}}"
    const token: FunCityToken[] = [
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
        name: 'if',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 4 },
        },
      },
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 3 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 2, column: 5 },
          end: { line: 2, column: 7 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 8 },
          end: { line: 2, column: 8 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 3 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 3, column: 4 },
          end: { line: 3, column: 5 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{if 1\nfoo 123\nend}}"
    expect(nodes).toEqual([
      {
        kind: 'if',
        condition: {
          kind: 'number',
          value: 1,
          range: {
            start: { line: 1, column: 6 },
            end: { line: 1, column: 6 },
          },
        },
        then: [
          {
            kind: 'apply',
            func: {
              kind: 'variable',
              name: 'foo',
              range: {
                start: { line: 2, column: 1 },
                end: { line: 2, column: 3 },
              },
            },
            args: [
              {
                kind: 'number',
                value: 123,
                range: {
                  start: { line: 2, column: 5 },
                  end: { line: 2, column: 7 },
                },
              },
            ],
            range: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 7 },
            },
          },
        ],
        else: [],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 3, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('conditional token (scoped if)', () => {
    // "{{if 1\nfoo\n123\nend}}"
    const token: FunCityToken[] = [
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
        name: 'if',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 4 },
        },
      },
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 4 },
          end: { line: 2, column: 4 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 3, column: 4 },
          end: { line: 3, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 4, column: 1 },
          end: { line: 4, column: 3 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 4, column: 4 },
          end: { line: 4, column: 5 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{if 1\nfoo\n123\nend}}"
    expect(nodes).toEqual([
      {
        kind: 'if',
        condition: {
          kind: 'number',
          value: 1,
          range: {
            start: { line: 1, column: 6 },
            end: { line: 1, column: 6 },
          },
        },
        then: [
          {
            kind: 'scope',
            nodes: [
              {
                kind: 'variable',
                name: 'foo',
                range: {
                  start: { line: 2, column: 1 },
                  end: { line: 2, column: 3 },
                },
              },
              {
                kind: 'number',
                value: 123,
                range: {
                  start: { line: 3, column: 1 },
                  end: { line: 3, column: 3 },
                },
              },
            ],
            range: {
              start: { line: 2, column: 1 },
              end: { line: 3, column: 3 },
            },
          },
        ],
        else: [],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 4, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('conditional token (if-else)', () => {
    // "{{if 1\n123\nelse\n456\nend}}"
    const token: FunCityToken[] = [
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
        name: 'if',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 4 },
        },
      },
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 4 },
          end: { line: 2, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'else',
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 4 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 3, column: 5 },
          end: { line: 3, column: 5 },
        },
      },
      {
        kind: 'number',
        value: 456,
        range: {
          start: { line: 4, column: 1 },
          end: { line: 4, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 4, column: 4 },
          end: { line: 4, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 5, column: 1 },
          end: { line: 5, column: 3 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 5, column: 4 },
          end: { line: 5, column: 5 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{if 1\n123\nelse\n456\nend}}"
    expect(nodes).toEqual([
      {
        kind: 'if',
        condition: {
          kind: 'number',
          value: 1,
          range: {
            start: { line: 1, column: 6 },
            end: { line: 1, column: 6 },
          },
        },
        then: [
          {
            kind: 'number',
            value: 123,
            range: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 3 },
            },
          },
        ],
        else: [
          {
            kind: 'number',
            value: 456,
            range: {
              start: { line: 4, column: 1 },
              end: { line: 4, column: 3 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 5, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('conditional token (if-else across blocks)', () => {
    // "{{if flag?}}THEN{{else}}ELSE{{end}}"
    const token: FunCityToken[] = [
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
        name: 'if',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'flag?',
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
        text: 'THEN',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 16 },
        },
      },
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 18 },
        },
      },
      {
        kind: 'identity',
        name: 'else',
        range: {
          start: { line: 1, column: 19 },
          end: { line: 1, column: 22 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 23 },
          end: { line: 1, column: 24 },
        },
      },
      {
        kind: 'text',
        text: 'ELSE',
        range: {
          start: { line: 1, column: 25 },
          end: { line: 1, column: 28 },
        },
      },
      {
        kind: 'open',
        symbol: '{{',
        range: {
          start: { line: 1, column: 29 },
          end: { line: 1, column: 30 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 1, column: 31 },
          end: { line: 1, column: 33 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 34 },
          end: { line: 1, column: 35 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{if flag?}}THEN{{else}}ELSE{{end}}"
    expect(nodes).toEqual([
      {
        kind: 'if',
        condition: {
          kind: 'variable',
          name: 'flag?',
          range: {
            start: { line: 1, column: 6 },
            end: { line: 1, column: 10 },
          },
        },
        then: [
          {
            kind: 'text',
            text: 'THEN',
            range: {
              start: { line: 1, column: 13 },
              end: { line: 1, column: 16 },
            },
          },
        ],
        else: [
          {
            kind: 'text',
            text: 'ELSE',
            range: {
              start: { line: 1, column: 25 },
              end: { line: 1, column: 28 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 33 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('conditional token (nested if)', () => {
    // "{{if 1\nif 0\n123\nend\nend}}"
    const token: FunCityToken[] = [
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
        name: 'if',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 4 },
        },
      },
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'identity',
        name: 'if',
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 2 },
        },
      },
      {
        kind: 'number',
        value: 0,
        range: {
          start: { line: 2, column: 4 },
          end: { line: 2, column: 4 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 5 },
          end: { line: 2, column: 5 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 3, column: 4 },
          end: { line: 3, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 4, column: 1 },
          end: { line: 4, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 4, column: 4 },
          end: { line: 4, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 5, column: 1 },
          end: { line: 5, column: 3 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 5, column: 4 },
          end: { line: 5, column: 5 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{if 1\nif 0\n123\nend\nend}}"
    expect(nodes).toEqual([
      {
        kind: 'if',
        condition: {
          kind: 'number',
          value: 1,
          range: {
            start: { line: 1, column: 6 },
            end: { line: 1, column: 6 },
          },
        },
        then: [
          {
            kind: 'if',
            condition: {
              kind: 'number',
              value: 0,
              range: {
                start: { line: 2, column: 4 },
                end: { line: 2, column: 4 },
              },
            },
            then: [
              {
                kind: 'number',
                value: 123,
                range: {
                  start: { line: 3, column: 1 },
                  end: { line: 3, column: 3 },
                },
              },
            ],
            else: [],
            range: {
              start: { line: 2, column: 1 },
              end: { line: 4, column: 3 },
            },
          },
        ],
        else: [],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 5, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('conditional token (nested if-else)', () => {
    // "{{if 1\nif 0\n123\nelse\n456\nend\nelse\n789\nend}}"
    const token: FunCityToken[] = [
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
        name: 'if',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 4 },
        },
      },
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 6 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'identity',
        name: 'if',
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 2 },
        },
      },
      {
        kind: 'number',
        value: 0,
        range: {
          start: { line: 2, column: 4 },
          end: { line: 2, column: 4 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 5 },
          end: { line: 2, column: 5 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 3, column: 4 },
          end: { line: 3, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'else',
        range: {
          start: { line: 4, column: 1 },
          end: { line: 4, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 4, column: 4 },
          end: { line: 4, column: 4 },
        },
      },
      {
        kind: 'number',
        value: 456,
        range: {
          start: { line: 5, column: 1 },
          end: { line: 5, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 5, column: 4 },
          end: { line: 5, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 6, column: 1 },
          end: { line: 6, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 6, column: 4 },
          end: { line: 6, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'else',
        range: {
          start: { line: 7, column: 1 },
          end: { line: 7, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 7, column: 4 },
          end: { line: 7, column: 4 },
        },
      },
      {
        kind: 'number',
        value: 789,
        range: {
          start: { line: 8, column: 1 },
          end: { line: 8, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 8, column: 4 },
          end: { line: 8, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 9, column: 1 },
          end: { line: 9, column: 3 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 9, column: 4 },
          end: { line: 9, column: 5 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{if 1\nif 0\n123\nelse\n456\nend\nelse\n789\nend}}"
    expect(nodes).toEqual([
      {
        kind: 'if',
        condition: {
          kind: 'number',
          value: 1,
          range: {
            start: { line: 1, column: 6 },
            end: { line: 1, column: 6 },
          },
        },
        then: [
          {
            kind: 'if',
            condition: {
              kind: 'number',
              value: 0,
              range: {
                start: { line: 2, column: 4 },
                end: { line: 2, column: 4 },
              },
            },
            then: [
              {
                kind: 'number',
                value: 123,
                range: {
                  start: { line: 3, column: 1 },
                  end: { line: 3, column: 3 },
                },
              },
            ],
            else: [
              {
                kind: 'number',
                value: 456,
                range: {
                  start: { line: 5, column: 1 },
                  end: { line: 5, column: 3 },
                },
              },
            ],
            range: {
              start: { line: 2, column: 1 },
              end: { line: 6, column: 3 },
            },
          },
        ],
        else: [
          {
            kind: 'number',
            value: 789,
            range: {
              start: { line: 8, column: 1 },
              end: { line: 8, column: 3 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 9, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('repeat token (while)', () => {
    // "{{while 1\n123\nend}}"
    const token: FunCityToken[] = [
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
        name: 'while',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 7 },
        },
      },
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 9 },
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
        value: 123,
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 3 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 4 },
          end: { line: 2, column: 4 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 3 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 3, column: 4 },
          end: { line: 3, column: 5 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{while 1\n123\nend}}"
    expect(nodes).toEqual([
      {
        kind: 'while',
        condition: {
          kind: 'number',
          value: 1,
          range: {
            start: { line: 1, column: 9 },
            end: { line: 1, column: 9 },
          },
        },
        repeat: [
          {
            kind: 'number',
            value: 123,
            range: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 3 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 3, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('repeat token (for)', () => {
    // "{{for item items\nitem\nend}}"
    const token: FunCityToken[] = [
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
        name: 'for',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'identity', // required
        name: 'item',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'identity',
        name: 'items',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 16 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 17 },
        },
      },
      {
        kind: 'identity',
        name: 'item',
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 4 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 2, column: 5 },
          end: { line: 2, column: 5 },
        },
      },
      {
        kind: 'identity',
        name: 'end',
        range: {
          start: { line: 3, column: 1 },
          end: { line: 3, column: 3 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 3, column: 4 },
          end: { line: 3, column: 5 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{for item items\nitem\nend}}"
    expect(nodes).toEqual([
      {
        kind: 'for',
        bind: {
          kind: 'variable',
          name: 'item',
          range: {
            start: { line: 1, column: 7 },
            end: { line: 1, column: 10 },
          },
        },
        iterable: {
          kind: 'variable',
          name: 'items',
          range: {
            start: { line: 1, column: 12 },
            end: { line: 1, column: 16 },
          },
        },
        repeat: [
          {
            kind: 'variable',
            name: 'item',
            range: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 4 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 3, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('bind token (set)', () => {
    // "{{set foo 123\nfoo}}"
    const token: FunCityToken[] = [
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
        name: 'set',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'identity', // required
        name: 'foo',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 13 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 14 },
          end: { line: 1, column: 14 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 3 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 2, column: 4 },
          end: { line: 2, column: 5 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{set foo 123\nfoo}}"
    expect(nodes).toEqual([
      {
        kind: 'scope',
        nodes: [
          {
            kind: 'apply',
            func: {
              kind: 'variable',
              name: 'set',
              range: {
                start: { line: 1, column: 3 },
                end: { line: 1, column: 5 },
              },
            },
            args: [
              {
                kind: 'variable',
                name: 'foo',
                range: {
                  start: { line: 1, column: 7 },
                  end: { line: 1, column: 9 },
                },
              },
              {
                kind: 'number',
                value: 123,
                range: {
                  start: { line: 1, column: 11 },
                  end: { line: 1, column: 13 },
                },
              },
            ],
            range: {
              start: { line: 1, column: 3 },
              end: { line: 1, column: 13 },
            },
          },
          {
            kind: 'variable',
            name: 'foo',
            range: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 3 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 2, column: 3 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('fun token (single parameter)', () => {
    // "{{fun foo 123}}"
    const token: FunCityToken[] = [
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
        name: 'fun',
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 5 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 9 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 11 },
          end: { line: 1, column: 13 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 14 },
          end: { line: 1, column: 15 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{fun foo 123}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'fun',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 5 },
          },
        },
        args: [
          {
            kind: 'variable',
            name: 'foo',
            range: {
              start: { line: 1, column: 7 },
              end: { line: 1, column: 9 },
            },
          },
          {
            kind: 'number',
            value: 123,
            range: {
              start: { line: 1, column: 11 },
              end: { line: 1, column: 13 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 13 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('fun token (list parameter)', () => {
    // "{{fun [foo] 123}}"
    const token: FunCityToken[] = [
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
        name: 'fun',
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
        kind: 'identity',
        name: 'foo',
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
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 13 },
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{fun [foo] 123}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'fun',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 5 },
          },
        },
        args: [
          {
            kind: 'list',
            items: [
              {
                kind: 'variable',
                name: 'foo',
                range: {
                  start: { line: 1, column: 8 },
                  end: { line: 1, column: 10 },
                },
              },
            ],
            range: {
              start: { line: 1, column: 7 },
              end: { line: 1, column: 11 },
            },
          },
          {
            kind: 'number',
            value: 123,
            range: {
              start: { line: 1, column: 13 },
              end: { line: 1, column: 15 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 15 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('fun token (list parameter, 2 args)', () => {
    // "{{fun [foo bar] 123}}"
    const token: FunCityToken[] = [
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
        name: 'fun',
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
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 10 },
        },
      },
      {
        kind: 'identity',
        name: 'bar',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 14 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 15 },
          end: { line: 1, column: 15 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 19 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 20 },
          end: { line: 1, column: 21 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{fun [foo bar] 123}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'fun',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 5 },
          },
        },
        args: [
          {
            kind: 'list',
            items: [
              {
                kind: 'variable',
                name: 'foo',
                range: {
                  start: { line: 1, column: 8 },
                  end: { line: 1, column: 10 },
                },
              },
              {
                kind: 'variable',
                name: 'bar',
                range: {
                  start: { line: 1, column: 12 },
                  end: { line: 1, column: 14 },
                },
              },
            ],
            range: {
              start: { line: 1, column: 7 },
              end: { line: 1, column: 15 },
            },
          },
          {
            kind: 'number',
            value: 123,
            range: {
              start: { line: 1, column: 17 },
              end: { line: 1, column: 19 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 19 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('fun expression in func position', () => {
    // "{{(fun [foo] foo) 123}}"
    const token: FunCityToken[] = [
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
        name: 'fun',
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 6 },
        },
      },
      {
        kind: 'open',
        symbol: '[',
        range: {
          start: { line: 1, column: 8 },
          end: { line: 1, column: 8 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 9 },
          end: { line: 1, column: 11 },
        },
      },
      {
        kind: 'close',
        symbol: ']',
        range: {
          start: { line: 1, column: 12 },
          end: { line: 1, column: 12 },
        },
      },
      {
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 14 },
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
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 19 },
          end: { line: 1, column: 21 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 22 },
          end: { line: 1, column: 23 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{(fun [foo] foo) 123}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'apply',
          func: {
            kind: 'variable',
            name: 'fun',
            range: {
              start: { line: 1, column: 4 },
              end: { line: 1, column: 6 },
            },
          },
          args: [
            {
              kind: 'list',
              items: [
                {
                  kind: 'variable',
                  name: 'foo',
                  range: {
                    start: { line: 1, column: 9 },
                    end: { line: 1, column: 11 },
                  },
                },
              ],
              range: {
                start: { line: 1, column: 8 },
                end: { line: 1, column: 12 },
              },
            },
            {
              kind: 'variable',
              name: 'foo',
              range: {
                start: { line: 1, column: 14 },
                end: { line: 1, column: 16 },
              },
            },
          ],
          range: {
            start: { line: 1, column: 4 },
            end: { line: 1, column: 16 },
          },
        },
        args: [
          {
            kind: 'number',
            value: 123,
            range: {
              start: { line: 1, column: 19 },
              end: { line: 1, column: 21 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 4 },
          end: { line: 1, column: 21 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('fun expression with extra argument', () => {
    // "{{fun [foo] foo 123}}"
    const token: FunCityToken[] = [
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
        name: 'fun',
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
        kind: 'identity',
        name: 'foo',
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
        kind: 'identity',
        name: 'foo',
        range: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 15 },
        },
      },
      {
        kind: 'number',
        value: 123,
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 19 },
        },
      },
      {
        kind: 'close',
        symbol: '}}',
        range: {
          start: { line: 1, column: 20 },
          end: { line: 1, column: 21 },
        },
      },
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = runParser(token, logs);

    // "{{fun [foo] foo 123}}"
    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'fun',
          range: {
            start: { line: 1, column: 3 },
            end: { line: 1, column: 5 },
          },
        },
        args: [
          {
            kind: 'list',
            items: [
              {
                kind: 'variable',
                name: 'foo',
                range: {
                  start: { line: 1, column: 8 },
                  end: { line: 1, column: 10 },
                },
              },
            ],
            range: {
              start: { line: 1, column: 7 },
              end: { line: 1, column: 11 },
            },
          },
          {
            kind: 'variable',
            name: 'foo',
            range: {
              start: { line: 1, column: 13 },
              end: { line: 1, column: 15 },
            },
          },
          {
            kind: 'number',
            value: 123,
            range: {
              start: { line: 1, column: 17 },
              end: { line: 1, column: 19 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 3 },
          end: { line: 1, column: 19 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });
});

describe('code parser test', () => {
  it('single expression', () => {
    const token: FunCityToken[] = [
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = parseExpressions(token, logs);

    expect(nodes).toEqual([
      {
        kind: 'apply',
        func: {
          kind: 'variable',
          name: 'foo',
          range: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 3 },
          },
        },
        args: [
          {
            kind: 'number',
            value: 123,
            range: {
              start: { line: 1, column: 5 },
              end: { line: 1, column: 7 },
            },
          },
        ],
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 7 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });

  it('multiple expressions', () => {
    const token: FunCityToken[] = [
      {
        kind: 'number',
        value: 1,
        range: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 1 },
        },
      },
      {
        kind: 'eol',
        range: {
          start: { line: 1, column: 2 },
          end: { line: 1, column: 2 },
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
    ];
    const logs: FunCityLogEntry[] = [];

    const nodes = parseExpressions(token, logs);

    expect(nodes).toEqual([
      {
        kind: 'scope',
        nodes: [
          {
            kind: 'number',
            value: 1,
            range: {
              start: { line: 1, column: 1 },
              end: { line: 1, column: 1 },
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
        ],
        range: {
          start: { line: 1, column: 1 },
          end: { line: 2, column: 1 },
        },
      },
    ]);
    expect(logs).toEqual([]);
  });
});
