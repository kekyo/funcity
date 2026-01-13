// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  FunCityApplyNode,
  FunCityExpressionNode,
  FunCityListNode,
  FunCityNumberNode,
  FunCityStringNode,
  FunCityVariableNode,
} from '../src/types';

// ATTENTION: All `range` fields are nonsense value.

export const dummyRange = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};

export const numberNode = (value: number): FunCityNumberNode => ({
  kind: 'number' as const,
  value,
  range: dummyRange,
});

export const stringNode = (value: string): FunCityStringNode => ({
  kind: 'string' as const,
  value,
  range: dummyRange,
});

export const variableNode = (name: string): FunCityVariableNode => ({
  kind: 'variable' as const,
  name,
  range: dummyRange,
});

export const setNode = (name: string, expr: FunCityExpressionNode) => ({
  kind: 'apply' as const,
  func: variableNode('set'),
  args: [variableNode(name), expr],
  range: dummyRange,
});

export const listNode = (items: FunCityExpressionNode[]): FunCityListNode => ({
  kind: 'list' as const,
  items,
  range: dummyRange,
});

export const applyNode = (
  name: string,
  args: FunCityExpressionNode[]
): FunCityApplyNode => ({
  kind: 'apply' as const,
  func: variableNode(name),
  args,
  range: dummyRange,
});

export const funNode = (
  names: string[],
  body: FunCityExpressionNode
): FunCityApplyNode => {
  const nameNode =
    names.length === 0
      ? listNode([])
      : names.length === 1
        ? variableNode(names[0]!)
        : listNode(names.map((name) => variableNode(name)));
  return applyNode('fun', [nameNode, body]);
};
