// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type { FunCityBlockNode } from '../src/types';
import { runReducer } from '../src/reducer';
import { buildCandidateVariables } from '../src/standard-variables';
import {
  applyNode,
  dummyRange,
  funNode,
  listNode,
  numberNode,
  stringNode,
  variableNode,
} from './test-utils';

///////////////////////////////////////////////////////////////////////////////////

describe('standard variables test', () => {
  const reduceSingle = async (node: FunCityBlockNode) => {
    const variables = buildCandidateVariables();
    const reduced = await runReducer([node], variables);
    expect(reduced).toHaveLength(1);
    return reduced[0];
  };

  it('true', async () => {
    const value = await reduceSingle(variableNode('true'));
    expect(value).toBe(true);
  });
  it('false', async () => {
    const value = await reduceSingle(variableNode('false'));
    expect(value).toBe(false);
  });
  it('add', async () => {
    const value = await reduceSingle(
      applyNode('add', [numberNode(1), numberNode(2)])
    );
    expect(value).toBe(3);
  });
  it('sub', async () => {
    const value = await reduceSingle(
      applyNode('sub', [numberNode(5), numberNode(3)])
    );
    expect(value).toBe(2);
  });
  it('mul', async () => {
    const value = await reduceSingle(
      applyNode('mul', [numberNode(7), numberNode(2)])
    );
    expect(value).toBe(14);
  });
  it('div', async () => {
    const value = await reduceSingle(
      applyNode('div', [numberNode(8), numberNode(2)])
    );
    expect(value).toBe(4);
  });
  it('mod', async () => {
    const value = await reduceSingle(
      applyNode('mod', [numberNode(9), numberNode(4)])
    );
    expect(value).toBe(1);
  });
  it('eq true', async () => {
    const value = await reduceSingle(
      applyNode('eq', [numberNode(1), numberNode(1)])
    );
    expect(value).toBe(true);
  });
  it('eq false', async () => {
    const value = await reduceSingle(
      applyNode('eq', [numberNode(1), numberNode(2)])
    );
    expect(value).toBe(false);
  });
  it('ne true', async () => {
    const value = await reduceSingle(
      applyNode('ne', [numberNode(1), numberNode(2)])
    );
    expect(value).toBe(true);
  });
  it('ne false', async () => {
    const value = await reduceSingle(
      applyNode('ne', [numberNode(1), numberNode(1)])
    );
    expect(value).toBe(false);
  });
  it('lt true', async () => {
    const value = await reduceSingle(
      applyNode('lt', [numberNode(1), numberNode(2)])
    );
    expect(value).toBe(true);
  });
  it('lt false', async () => {
    const value = await reduceSingle(
      applyNode('lt', [numberNode(2), numberNode(1)])
    );
    expect(value).toBe(false);
  });
  it('gt true', async () => {
    const value = await reduceSingle(
      applyNode('gt', [numberNode(2), numberNode(1)])
    );
    expect(value).toBe(true);
  });
  it('gt false', async () => {
    const value = await reduceSingle(
      applyNode('gt', [numberNode(1), numberNode(2)])
    );
    expect(value).toBe(false);
  });
  it('le true', async () => {
    const value = await reduceSingle(
      applyNode('le', [numberNode(2), numberNode(2)])
    );
    expect(value).toBe(true);
  });
  it('le false', async () => {
    const value = await reduceSingle(
      applyNode('le', [numberNode(3), numberNode(2)])
    );
    expect(value).toBe(false);
  });
  it('ge true', async () => {
    const value = await reduceSingle(
      applyNode('ge', [numberNode(2), numberNode(2)])
    );
    expect(value).toBe(true);
  });
  it('ge false', async () => {
    const value = await reduceSingle(
      applyNode('ge', [numberNode(1), numberNode(2)])
    );
    expect(value).toBe(false);
  });
  it('now', async () => {
    const variables = buildCandidateVariables();
    const nowBefore = Date.now();
    const reduced = await runReducer([applyNode('now', [])], variables);
    const nowAfter = Date.now();
    expect(reduced).toHaveLength(1);
    const nowValue = reduced[0] as number;
    expect(typeof nowValue).toBe('number');
    expect(nowValue).toBeGreaterThanOrEqual(nowBefore);
    expect(nowValue).toBeLessThanOrEqual(nowAfter);
  });
  it('concat', async () => {
    const value = await reduceSingle(
      applyNode('concat', [
        numberNode(12),
        listNode([numberNode(34), numberNode(56)]),
        numberNode(78),
      ])
    );
    expect(value).toBe('12345678');
  });
  it('join', async () => {
    const value = await reduceSingle(
      applyNode('join', [
        stringNode(','),
        listNode([numberNode(12), numberNode(34), numberNode(56)]),
      ])
    );
    expect(value).toBe('12,34,56');
  });
  it('trim', async () => {
    const value = await reduceSingle(applyNode('trim', [stringNode(' ABC ')]));
    expect(value).toBe('ABC');
  });
  it('toUpper', async () => {
    const value = await reduceSingle(applyNode('toUpper', [stringNode('AbC')]));
    expect(value).toBe('ABC');
  });
  it('toLower', async () => {
    const value = await reduceSingle(applyNode('toLower', [stringNode('AbC')]));
    expect(value).toBe('abc');
  });
  it('length array', async () => {
    const value = await reduceSingle(
      applyNode('length', [listNode([numberNode(12), numberNode(34)])])
    );
    expect(value).toBe(2);
  });
  it('length string', async () => {
    const value = await reduceSingle(applyNode('length', [stringNode('ABC')]));
    expect(value).toBe(3);
  });
  it('and false', async () => {
    const value = await reduceSingle(
      applyNode('and', [variableNode('true'), variableNode('false')])
    );
    expect(value).toBe(false);
  });
  it('and true', async () => {
    const value = await reduceSingle(
      applyNode('and', [variableNode('true'), variableNode('true')])
    );
    expect(value).toBe(true);
  });
  it('or false', async () => {
    const value = await reduceSingle(
      applyNode('or', [variableNode('false'), variableNode('false')])
    );
    expect(value).toBe(false);
  });
  it('or true', async () => {
    const value = await reduceSingle(
      applyNode('or', [variableNode('false'), variableNode('true')])
    );
    expect(value).toBe(true);
  });
  it('and short-circuit', async () => {
    const value = await reduceSingle(
      applyNode('and', [variableNode('false'), variableNode('missing')])
    );
    expect(value).toBe(false);
  });
  it('or short-circuit', async () => {
    const value = await reduceSingle(
      applyNode('or', [variableNode('true'), variableNode('missing')])
    );
    expect(value).toBe(true);
  });
  it('not false', async () => {
    const value = await reduceSingle(applyNode('not', [variableNode('false')]));
    expect(value).toBe(true);
  });
  it('not true', async () => {
    const value = await reduceSingle(applyNode('not', [variableNode('true')]));
    expect(value).toBe(false);
  });
  it('cond true', async () => {
    const value = await reduceSingle(
      applyNode('cond', [
        variableNode('true'),
        numberNode(123),
        numberNode(456),
      ])
    );
    expect(value).toBe(123);
  });
  it('cond false', async () => {
    const value = await reduceSingle(
      applyNode('cond', [
        variableNode('false'),
        numberNode(123),
        numberNode(456),
      ])
    );
    expect(value).toBe(456);
  });
  it('at array', async () => {
    const value = await reduceSingle(
      applyNode('at', [
        numberNode(1),
        listNode([numberNode(12), numberNode(34), numberNode(56)]),
      ])
    );
    expect(value).toBe(34);
  });
  it('at string', async () => {
    const value = await reduceSingle(
      applyNode('at', [numberNode(1), stringNode('ABC')])
    );
    expect(value).toBe('B');
  });
  it('first', async () => {
    const value = await reduceSingle(
      applyNode('first', [
        listNode([numberNode(12), numberNode(34), numberNode(56)]),
      ])
    );
    expect(value).toBe(12);
  });
  it('last', async () => {
    const value = await reduceSingle(
      applyNode('last', [
        listNode([numberNode(12), numberNode(34), numberNode(56)]),
      ])
    );
    expect(value).toBe(56);
  });
  it('range', async () => {
    const value = await reduceSingle(
      applyNode('range', [numberNode(3), numberNode(5)])
    );
    expect(value).toStrictEqual([3, 4, 5, 6, 7]);
  });
  it('reverse', async () => {
    const value = await reduceSingle(
      applyNode('reverse', [
        listNode([numberNode(1), numberNode(2), numberNode(3)]),
      ])
    );
    expect(value).toStrictEqual([3, 2, 1]);
  });
  it('sort', async () => {
    const value = await reduceSingle(
      applyNode('sort', [
        listNode([numberNode(3), numberNode(5), numberNode(1)]),
      ])
    );
    expect(value).toStrictEqual([1, 3, 5]);
  });
  it('map', async () => {
    const value = await reduceSingle(
      applyNode('map', [
        funNode(
          ['foo'],
          applyNode('mul', [variableNode('foo'), numberNode(10)])
        ),
        listNode([numberNode(12), numberNode(34), numberNode(56)]),
      ])
    );
    expect(value).toStrictEqual([120, 340, 560]);
  });
  it('flatMap', async () => {
    const value = await reduceSingle(
      applyNode('flatMap', [
        funNode(
          ['foo'],
          listNode([applyNode('mul', [variableNode('foo'), numberNode(10)])])
        ),
        listNode([numberNode(12), numberNode(34), numberNode(56)]),
      ])
    );
    expect(value).toStrictEqual([120, 340, 560]);
  });
  it('filter', async () => {
    const value = await reduceSingle(
      applyNode('filter', [
        funNode(
          ['foo'],
          applyNode('mod', [variableNode('foo'), numberNode(2)])
        ),
        listNode([numberNode(1), numberNode(2), numberNode(3)]),
      ])
    );
    expect(value).toStrictEqual([1, 3]);
  });
  it('collect', async () => {
    const value = await reduceSingle(
      applyNode('collect', [
        listNode([numberNode(1), variableNode('undefined'), numberNode(3)]),
      ])
    );
    expect(value).toStrictEqual([1, 3]);
  });
  it('reduce', async () => {
    const value = await reduceSingle(
      applyNode('reduce', [
        stringNode('A'),
        funNode(
          ['acc', 'v'],
          applyNode('concat', [variableNode('acc'), variableNode('v')])
        ),
        listNode([stringNode('B'), stringNode('C'), stringNode('D')]),
      ])
    );
    expect(value).toBe('ABCD');
  });
  it('match', async () => {
    const value = await reduceSingle(
      applyNode('match', [
        stringNode('[A-Z]'),
        stringNode('The quick brown fox jumps over the lazy dog. It barked.'),
      ])
    );
    expect(value).toStrictEqual(['T', 'I']);
  });
  it('replace', async () => {
    const value = await reduceSingle(
      applyNode('replace', [
        stringNode('dog'),
        stringNode('ferret'),
        stringNode("I think Ruth's dog is cuter than your dog!"),
      ])
    );
    expect(value).toBe("I think Ruth's ferret is cuter than your ferret!");
  });
  it('regex gi', async () => {
    const value = await reduceSingle(
      applyNode('regex', [stringNode('[A-Z]'), stringNode('gi')])
    );
    expect((value as RegExp).toString()).toBe('/[A-Z]/gi');
  });
  it('regex', async () => {
    const value = await reduceSingle(applyNode('regex', [stringNode('[A-Z]')]));
    expect((value as RegExp).toString()).toBe('/[A-Z]/');
  });
  it('bind', async () => {
    const value = await reduceSingle({
      kind: 'apply',
      func: applyNode('bind', [variableNode('add'), numberNode(123)]),
      args: [numberNode(100)],
      range: dummyRange,
    });
    expect(value).toBe(223);
  });
  it('toString empty', async () => {
    const value = await reduceSingle(applyNode('toString', []));
    expect(value).toBe('');
  });
  it('toString values', async () => {
    const value = await reduceSingle(
      applyNode('toString', [
        numberNode(123),
        stringNode('ABC'),
        variableNode('true'),
        variableNode('false'),
        variableNode('undefined'),
        variableNode('null'),
        listNode([numberNode(111), numberNode(222)]),
        funNode(['a'], variableNode('a')),
      ])
    );
    expect(value).toBe(
      '123,ABC,true,false,(undefined),(null),[111,222],fun<#1>'
    );
  });
  it('toBoolean true', async () => {
    const value = await reduceSingle(applyNode('toBoolean', [numberNode(1)]));
    expect(value).toBe(true);
  });
  it('toBoolean false', async () => {
    const value = await reduceSingle(applyNode('toBoolean', [numberNode(0)]));
    expect(value).toBe(false);
  });
  it('toNumber', async () => {
    const value = await reduceSingle(
      applyNode('toNumber', [stringNode('123')])
    );
    expect(value).toBe(123);
  });
  it('toBigInt', async () => {
    const value = await reduceSingle(
      applyNode('toBigInt', [stringNode('123')])
    );
    expect(value).toBe(123n);
  });
  it('url', async () => {
    const value = await reduceSingle(
      applyNode('url', [stringNode('https://example.com/foo')])
    );
    expect(value).toBeInstanceOf(URL);
    expect((value as URL).href).toBe('https://example.com/foo');
  });
  it('url with base', async () => {
    const value = await reduceSingle(
      applyNode('url', [
        stringNode('bar'),
        stringNode('https://example.com/base/'),
      ])
    );
    expect((value as URL).href).toBe('https://example.com/base/bar');
  });
  it('typeof number', async () => {
    const value = await reduceSingle(applyNode('typeof', [numberNode(111)]));
    expect(value).toBe('number');
  });
  it('typeof string', async () => {
    const value = await reduceSingle(applyNode('typeof', [stringNode('ABC')]));
    expect(value).toBe('string');
  });
  it('typeof null', async () => {
    const value = await reduceSingle(
      applyNode('typeof', [variableNode('null')])
    );
    expect(value).toBe('null');
  });

  it('delay', async () => {
    const variables = buildCandidateVariables();
    const start = Date.now();
    const reduced = await runReducer(
      [applyNode('delay', [numberNode(10)]), numberNode(1)],
      variables
    );
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(5);
    expect(reduced).toEqual([1]);
  });
});
