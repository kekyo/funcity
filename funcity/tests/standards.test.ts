// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { beforeAll, describe, expect, it } from 'vitest';
import type {
  FunCityApplyNode,
  FunCityExpressionNode,
  FunCityLambdaNode,
  FunCityListNode,
  FunCityBlockNode,
  FunCityNumberNode,
  FunCityStringNode,
  FunCityVariableNode,
} from '../src/parser';
import { runReducer } from '../src/reducer';
import type { FunCityErrorInfo } from '../src/scripting';
import { buildCandidateVariables } from '../src/standards';

///////////////////////////////////////////////////////////////////////////////////

// ATTENTION: All `range` fields are nonsense value.

const range = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};
const numberNode = (value: number): FunCityNumberNode => ({
  kind: 'number' as const,
  value,
  range,
});
const stringNode = (value: string): FunCityStringNode => ({
  kind: 'string' as const,
  value,
  range,
});
const variableNode = (name: string): FunCityVariableNode => ({
  kind: 'variable' as const,
  name,
  range,
});
const listNode = (items: FunCityExpressionNode[]): FunCityListNode => ({
  kind: 'list' as const,
  items,
  range,
});
const applyNode = (
  name: string,
  args: FunCityExpressionNode[]
): FunCityApplyNode => ({
  kind: 'apply' as const,
  func: variableNode(name),
  args,
  range,
});
const lambdaNode = (
  names: string[],
  body: FunCityExpressionNode
): FunCityLambdaNode => ({
  kind: 'lambda' as const,
  names: names.map((name) => variableNode(name)),
  body,
  range,
});
const nodes: FunCityBlockNode[] = [
  variableNode('true'),
  variableNode('false'),
  applyNode('add', [numberNode(1), numberNode(2)]),
  applyNode('sub', [numberNode(5), numberNode(3)]),
  applyNode('mul', [numberNode(7), numberNode(2)]),
  applyNode('div', [numberNode(8), numberNode(2)]),
  applyNode('mod', [numberNode(9), numberNode(4)]),
  applyNode('equal', [numberNode(1), numberNode(1)]),
  applyNode('equal', [numberNode(1), numberNode(2)]),
  applyNode('now', []),
  applyNode('concat', [
    numberNode(12),
    listNode([numberNode(34), numberNode(56)]),
    numberNode(78),
  ]),
  applyNode('join', [
    stringNode(','),
    listNode([numberNode(12), numberNode(34), numberNode(56)]),
  ]),
  applyNode('trim', [stringNode(' ABC ')]),
  applyNode('toUpper', [stringNode('AbC')]),
  applyNode('toLower', [stringNode('AbC')]),
  applyNode('length', [listNode([numberNode(12), numberNode(34)])]),
  applyNode('length', [stringNode('ABC')]),
  applyNode('and', [variableNode('true'), variableNode('false')]),
  applyNode('and', [variableNode('true'), variableNode('true')]),
  applyNode('or', [variableNode('false'), variableNode('false')]),
  applyNode('or', [variableNode('false'), variableNode('true')]),
  applyNode('not', [variableNode('false')]),
  applyNode('not', [variableNode('true')]),
  applyNode('cond', [variableNode('true'), numberNode(123), numberNode(456)]),
  applyNode('cond', [variableNode('false'), numberNode(123), numberNode(456)]),
  applyNode('at', [
    numberNode(1),
    listNode([numberNode(12), numberNode(34), numberNode(56)]),
  ]),
  applyNode('at', [numberNode(1), stringNode('ABC')]),
  applyNode('first', [
    listNode([numberNode(12), numberNode(34), numberNode(56)]),
  ]),
  applyNode('last', [
    listNode([numberNode(12), numberNode(34), numberNode(56)]),
  ]),
  applyNode('range', [numberNode(3), numberNode(5)]),
  applyNode('reverse', [
    listNode([numberNode(1), numberNode(2), numberNode(3)]),
  ]),
  applyNode('sort', [listNode([numberNode(3), numberNode(5), numberNode(1)])]),
  applyNode('map', [
    lambdaNode(
      ['foo'],
      applyNode('mul', [variableNode('foo'), numberNode(10)])
    ),
    listNode([numberNode(12), numberNode(34), numberNode(56)]),
  ]),
  applyNode('flatMap', [
    lambdaNode(
      ['foo'],
      listNode([applyNode('mul', [variableNode('foo'), numberNode(10)])])
    ),
    listNode([numberNode(12), numberNode(34), numberNode(56)]),
  ]),
  applyNode('filter', [
    lambdaNode(['foo'], applyNode('mod', [variableNode('foo'), numberNode(2)])),
    listNode([numberNode(1), numberNode(2), numberNode(3)]),
  ]),
  applyNode('collect', [
    listNode([numberNode(1), variableNode('undefined'), numberNode(3)]),
  ]),
  applyNode('reduce', [
    stringNode('A'),
    lambdaNode(
      ['acc', 'v'],
      applyNode('concat', [variableNode('acc'), variableNode('v')])
    ),
    listNode([stringNode('B'), stringNode('C'), stringNode('D')]),
  ]),
  applyNode('match', [
    stringNode('[A-Z]'),
    stringNode('The quick brown fox jumps over the lazy dog. It barked.'),
  ]),
  applyNode('replace', [
    stringNode('dog'),
    stringNode('ferret'),
    stringNode("I think Ruth's dog is cuter than your dog!"),
  ]),
  applyNode('regex', [stringNode('[A-Z]'), stringNode('gi')]),
  applyNode('regex', [stringNode('[A-Z]')]),
  {
    kind: 'apply',
    func: applyNode('bind', [variableNode('add'), numberNode(123)]),
    args: [numberNode(100)],
    range,
  },
  applyNode('toString', []),
  applyNode('toString', [
    numberNode(123),
    stringNode('ABC'),
    variableNode('true'),
    variableNode('false'),
    variableNode('undefined'),
    variableNode('null'),
    listNode([numberNode(111), numberNode(222)]),
    lambdaNode(['a'], variableNode('a')),
  ]),
  applyNode('typeof', [numberNode(111)]),
  applyNode('typeof', [stringNode('ABC')]),
  applyNode('typeof', [variableNode('null')]),
];

describe('standard variables test', () => {
  let reduced: unknown[] = [];
  let errors: FunCityErrorInfo[] = [];
  let nowBefore = 0;
  let nowAfter = 0;

  beforeAll(async () => {
    errors = [];
    const variables = buildCandidateVariables();
    nowBefore = Date.now();
    reduced = await runReducer(nodes, variables, errors);
    nowAfter = Date.now();
  });

  it('true', () => {
    expect(reduced).toHaveLength(47);
    expect(errors).toEqual([]);
    expect(reduced[0]).toBe(true);
  });
  it('false', () => {
    expect(reduced[1]).toBe(false);
  });
  it('add', () => {
    expect(reduced[2]).toBe(3);
  });
  it('sub', () => {
    expect(reduced[3]).toBe(2);
  });
  it('mul', () => {
    expect(reduced[4]).toBe(14);
  });
  it('div', () => {
    expect(reduced[5]).toBe(4);
  });
  it('mod', () => {
    expect(reduced[6]).toBe(1);
  });
  it('equal true', () => {
    expect(reduced[7]).toBe(true);
  });
  it('equal false', () => {
    expect(reduced[8]).toBe(false);
  });
  it('now', () => {
    const nowValue = reduced[9] as number;
    expect(typeof nowValue).toBe('number');
    expect(nowValue).toBeGreaterThanOrEqual(nowBefore);
    expect(nowValue).toBeLessThanOrEqual(nowAfter);
  });
  it('concat', () => {
    expect(reduced[10]).toBe('12345678');
  });
  it('join', () => {
    expect(reduced[11]).toBe('12,34,56');
  });
  it('trim', () => {
    expect(reduced[12]).toBe('ABC');
  });
  it('toUpper', () => {
    expect(reduced[13]).toBe('ABC');
  });
  it('toLower', () => {
    expect(reduced[14]).toBe('abc');
  });
  it('length array', () => {
    expect(reduced[15]).toBe(2);
  });
  it('length string', () => {
    expect(reduced[16]).toBe(3);
  });
  it('and false', () => {
    expect(reduced[17]).toBe(false);
  });
  it('and true', () => {
    expect(reduced[18]).toBe(true);
  });
  it('or false', () => {
    expect(reduced[19]).toBe(false);
  });
  it('or true', () => {
    expect(reduced[20]).toBe(true);
  });
  it('not false', () => {
    expect(reduced[21]).toBe(true);
  });
  it('not true', () => {
    expect(reduced[22]).toBe(false);
  });
  it('cond true', () => {
    expect(reduced[23]).toBe(123);
  });
  it('cond false', () => {
    expect(reduced[24]).toBe(456);
  });
  it('at array', () => {
    expect(reduced[25]).toBe(34);
  });
  it('at string', () => {
    expect(reduced[26]).toBe('B');
  });
  it('first', () => {
    expect(reduced[27]).toBe(12);
  });
  it('last', () => {
    expect(reduced[28]).toBe(56);
  });
  it('range', () => {
    expect(reduced[29]).toStrictEqual([3, 4, 5, 6, 7]);
  });
  it('reverse', () => {
    expect(reduced[30]).toStrictEqual([3, 2, 1]);
  });
  it('sort', () => {
    expect(reduced[31]).toStrictEqual([1, 3, 5]);
  });
  it('map', () => {
    expect(reduced[32]).toStrictEqual([120, 340, 560]);
  });
  it('flatMap', () => {
    expect(reduced[33]).toStrictEqual([120, 340, 560]);
  });
  it('filter', () => {
    expect(reduced[34]).toStrictEqual([1, 3]);
  });
  it('collect', () => {
    expect(reduced[35]).toStrictEqual([1, 3]);
  });
  it('reduce', () => {
    expect(reduced[36]).toBe('ABCD');
  });
  it('match', () => {
    expect(reduced[37]).toStrictEqual(['T', 'I']);
  });
  it('replace', () => {
    expect(reduced[38]).toBe(
      "I think Ruth's ferret is cuter than your ferret!"
    );
  });
  it('regex gi', () => {
    expect(reduced[39]!.toString()).toBe('/[A-Z]/gi');
  });
  it('regex', () => {
    expect(reduced[40]!.toString()).toBe('/[A-Z]/');
  });
  it('bind', () => {
    expect(reduced[41]).toBe(223);
  });
  it('toString empty', () => {
    expect(reduced[42]).toBe('');
  });
  it('toString values', () => {
    expect(reduced[43]).toBe(
      '123,ABC,true,false,(undefined),(null),[111,222],fun<#1>'
    );
  });
  it('typeof number', () => {
    expect(reduced[44]).toBe('number');
  });
  it('typeof string', () => {
    expect(reduced[45]).toBe('string');
  });
  it('typeof null', () => {
    expect(reduced[46]).toBe('null');
  });
});
