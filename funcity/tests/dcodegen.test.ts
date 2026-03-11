// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type { FunCityBlockNode, FunCityWarningEntry } from '../src/types';
import { createReducerContext, runReducer } from '../src/reducer';
import { createDCodegen } from '../src/dcodegen';
import { buildCandidateVariables } from '../src/variables/standard-variables';
import {
  applyNode,
  dotNode,
  forNode,
  funNode,
  ifNode,
  numberNode,
  setNode,
  stringNode,
  textNode,
  variableNode,
  whileNode,
} from './test-utils';

///////////////////////////////////////////////////////////////////////////////////

const runGenerated = async (
  nodes: readonly FunCityBlockNode[],
  extra?: Record<string, unknown>
) => {
  const warningLogs: FunCityWarningEntry[] = [];
  const variables = buildCandidateVariables(extra ?? {});
  const dcodegen = createDCodegen();
  const reducerContext = createReducerContext(
    variables,
    warningLogs,
    dcodegen.createExecutor()
  );
  const generated = dcodegen.generateProgram(nodes);
  const result = await generated(reducerContext);
  return { result, warningLogs, reducerContext, dcodegen };
};

const expectGeneratedMatchesReducer = async (
  nodes: readonly FunCityBlockNode[],
  extra?: Record<string, unknown>
) => {
  const reducerWarnings: FunCityWarningEntry[] = [];
  const reduced = await runReducer(
    nodes,
    buildCandidateVariables(extra ?? {}),
    reducerWarnings
  );
  const generated = await runGenerated(nodes, extra);
  expect(generated.result).toEqual(reduced);
  expect(generated.warningLogs).toEqual(reducerWarnings);
};

describe('dynamic code generator test', () => {
  it('matches reducer on mixed root blocks', async () => {
    await expectGeneratedMatchesReducer([
      textNode('Hello'),
      applyNode('add', [numberNode(1), numberNode(2)]),
      textNode('World'),
    ]);
  });

  it('matches reducer on dot access and bound methods', async () => {
    await expectGeneratedMatchesReducer(
      [
        applyNode(
          dotNode(variableNode('foo'), [{ name: 'bar' }, { name: 'get' }]),
          []
        ),
      ],
      {
        foo: {
          bar: {
            value: 123,
            get() {
              return this.value;
            },
          },
        },
      }
    );
  });

  it('matches reducer on control flow nodes', async () => {
    await expectGeneratedMatchesReducer([
      setNode('value', numberNode(0)),
      ifNode(variableNode('true'), [textNode('A')], [textNode('B')]),
      forNode('item', applyNode('range', [numberNode(1), numberNode(3)]), [
        variableNode('item'),
      ]),
      whileNode(applyNode('lt', [variableNode('value'), numberNode(2)]), [
        setNode(
          'value',
          applyNode('add', [variableNode('value'), numberNode(1)])
        ),
        variableNode('value'),
      ]),
    ]);
  });

  it('matches reducer on recursive lambdas', async () => {
    const fibBody = applyNode('cond', [
      applyNode('le', [variableNode('n'), numberNode(1)]),
      variableNode('n'),
      applyNode('add', [
        applyNode(variableNode('fib'), [
          applyNode('sub', [variableNode('n'), numberNode(1)]),
        ]),
        applyNode(variableNode('fib'), [
          applyNode('sub', [variableNode('n'), numberNode(2)]),
        ]),
      ]),
    ]);
    await expectGeneratedMatchesReducer([
      setNode('fib', funNode(['n'], fibBody)),
      applyNode(variableNode('fib'), [numberNode(10)]),
    ]);
  });

  it('exposes generated expression and block functions', async () => {
    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const dcodegen = createDCodegen();
    const reducerContext = createReducerContext(
      variables,
      warningLogs,
      dcodegen.createExecutor()
    );

    const generatedExpression = dcodegen.generateExpression(
      applyNode('add', [numberNode(4), numberNode(5)])
    );
    const generatedBlock = dcodegen.generateBlock(
      setNode('value', stringNode('ok'))
    );

    await expect(generatedExpression(reducerContext)).resolves.toBe(9);
    await expect(generatedBlock(reducerContext)).resolves.toEqual([undefined]);
    expect(warningLogs).toEqual([]);
  });

  it('renders text programs without building result arrays', async () => {
    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables({ name: 'World' });
    const dcodegen = createDCodegen();
    const reducerContext = createReducerContext(
      variables,
      warningLogs,
      dcodegen.createExecutor()
    );
    const generatedText = dcodegen.generateTextProgram([
      textNode('Hello '),
      variableNode('name'),
      textNode('!'),
    ]);

    await expect(generatedText(reducerContext)).resolves.toBe('Hello World!');
    expect(warningLogs).toEqual([]);
  });

  it('falls back when a specializable builtin is shadowed', async () => {
    await expectGeneratedMatchesReducer(
      [applyNode('add', [numberNode(1), numberNode(2)])],
      {
        add: (lhs: number, rhs: number) => lhs * rhs,
      }
    );
  });
});
