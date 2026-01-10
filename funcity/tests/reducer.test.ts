// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type {
  FunCityErrorInfo,
  FunCityBlockNode,
  FunCityExpressionNode,
  FunCityFunctionContext,
} from '../src/types';
import { buildCandidateVariables } from '../src/standards';
import { runReducer } from '../src/reducer';

///////////////////////////////////////////////////////////////////////////////////

// ATTENTION: All `range` fields are dummy value.
const range = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};
const variableNode = (name: string) => ({
  kind: 'variable' as const,
  name,
  range,
});
const numberNode = (value: number) => ({
  kind: 'number' as const,
  value,
  range,
});
const stringNode = (value: string) => ({
  kind: 'string' as const,
  value,
  range,
});
const textNode = (text: string) => ({
  kind: 'text' as const,
  text,
  range,
});
const listNode = (items: FunCityExpressionNode[]) => ({
  kind: 'list' as const,
  items,
  range,
});
const applyNode = (
  func: FunCityExpressionNode,
  args: FunCityExpressionNode[]
) => ({
  kind: 'apply' as const,
  func,
  args,
  range,
});
const lambdaNode = (names: readonly string[], body: FunCityExpressionNode) => ({
  kind: 'lambda' as const,
  names: names.map(variableNode),
  body,
  range,
});
const scopeNode = (nodes: FunCityExpressionNode[]) => ({
  kind: 'scope' as const,
  nodes,
  range,
});
const setNode = (name: string, expr: FunCityExpressionNode) => ({
  kind: 'set' as const,
  name: variableNode(name),
  expr,
  range,
});
const ifNode = (
  condition: FunCityExpressionNode,
  thenNodes: FunCityBlockNode[],
  elseNodes: FunCityBlockNode[]
) => ({
  kind: 'if' as const,
  condition,
  then: thenNodes,
  else: elseNodes,
  range,
});
const whileNode = (
  condition: FunCityExpressionNode,
  repeat: FunCityBlockNode[]
) => ({
  kind: 'while' as const,
  condition,
  repeat,
  range,
});
const forNode = (
  bind: string,
  iterable: FunCityExpressionNode,
  repeat: FunCityBlockNode[]
) => ({
  kind: 'for' as const,
  bind: variableNode(bind),
  iterable,
  repeat,
  range,
});

describe('scripting reducer test', () => {
  it('empty', async () => {
    // "{{}}"
    const nodes: FunCityBlockNode[] = [];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('number node', async () => {
    // "{{12345}}"
    const nodes: FunCityBlockNode[] = [numberNode(12345)];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([12345]);
    expect(errors).toEqual([]);
  });

  it('string node', async () => {
    // "{{'hello'}}"
    const nodes: FunCityBlockNode[] = [stringNode('hello')];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual(['hello']);
    expect(errors).toEqual([]);
  });

  it('variable node', async () => {
    // "{{true}}"
    const nodes: FunCityBlockNode[] = [variableNode('true')];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables(); // Included `true`
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([true]);
    expect(errors).toEqual([]);
  });

  it('text node', async () => {
    // "Hello"
    const nodes: FunCityBlockNode[] = [textNode('Hello')];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual(['Hello']);
    expect(errors).toEqual([]);
  });

  it('variable node (not bind)', async () => {
    // "{{foobar}}"
    const nodes: FunCityBlockNode[] = [variableNode('foobar')];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([]);
    expect(errors).toEqual([
      {
        type: 'error',
        description: 'variable is not bound: foobar',
        range,
      },
    ]);
  });

  it('variable node (traverse)', async () => {
    // "{{foo.bar}}"
    const nodes: FunCityBlockNode[] = [variableNode('foo.bar')];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables({
      foo: {
        bar: 'ABC',
      },
    });
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual(['ABC']);
    expect(errors).toEqual([]);
  });

  it('variable node (conditional combine)', async () => {
    // "{{siteName?}}"
    const nodes: FunCityBlockNode[] = [variableNode('siteName?')];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables({
      siteName: 'My Site',
    });
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual(['My Site']);
    expect(errors).toEqual([]);
  });

  it('root list', async () => {
    // "Hello{{add 123 456}}World"
    const nodes: FunCityBlockNode[] = [
      textNode('Hello'),
      applyNode(variableNode('add'), [numberNode(123), numberNode(456)]),
      textNode('World'),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables(); // Included `add`
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual(['Hello', 579, 'World']);
    expect(errors).toEqual([]);
  });

  it('application node', async () => {
    // "{{add 123 456}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(variableNode('add'), [numberNode(123), numberNode(456)]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables(); // Included `add`
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([579]);
    expect(errors).toEqual([]);
  });

  it('multiple sentence', async () => {
    // "{{12345\n'hello'\ntrue}}"
    const nodes: FunCityBlockNode[] = [
      scopeNode([numberNode(12345), stringNode('hello'), variableNode('true')]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables(); // Included `true`
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([true]); // Takes last one.
    expect(errors).toEqual([]);
  });

  it('multiple expressions in the list', async () => {
    // "{{[12345 'hello' true]}}"
    const nodes: FunCityBlockNode[] = [
      listNode([numberNode(12345), stringNode('hello'), variableNode('true')]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables(); // Included `true`
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([[12345, 'hello', true]]);
    expect(errors).toEqual([]);
  });

  it('set variable', async () => {
    // "{{set foo 123\nfoo}}"
    const nodes: FunCityBlockNode[] = [
      setNode('foo', numberNode(123)),
      variableNode('foo'),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([123]);
    expect(errors).toEqual([]);
  });

  it('for', async () => {
    // "{{for i [1 2 3 4 5]}}ABC{{end}}"
    const nodes: FunCityBlockNode[] = [
      forNode(
        'i',
        listNode([
          numberNode(1),
          numberNode(2),
          numberNode(3),
          numberNode(4),
          numberNode(5),
        ]),
        [stringNode('ABC')]
      ),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual(['ABC', 'ABC', 'ABC', 'ABC', 'ABC']);
    expect(errors).toEqual([]);
  });

  it('while', async () => {
    // "{{set count 10\nwhile count}}ABC{{set count (sub count 1)\nend}}"
    const nodes: FunCityBlockNode[] = [
      setNode('count', numberNode(10)),
      whileNode(variableNode('count'), [
        stringNode('ABC'),
        setNode(
          'count',
          applyNode(variableNode('sub'), [variableNode('count'), numberNode(1)])
        ),
      ]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([
      'ABC',
      'ABC',
      'ABC',
      'ABC',
      'ABC',
      'ABC',
      'ABC',
      'ABC',
      'ABC',
      'ABC',
    ]);
    expect(errors).toEqual([]);
  });

  it('abort signal during loop', async () => {
    const iterations = 40;
    const delayMs = 10;
    const abortAfterMs = 30;

    const nodes: FunCityBlockNode[] = [
      setNode('count', numberNode(iterations)),
      whileNode(variableNode('count'), [
        applyNode(variableNode('delay'), [numberNode(delayMs)]),
        setNode(
          'count',
          applyNode(variableNode('sub'), [variableNode('count'), numberNode(1)])
        ),
      ]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables({
      delay: async (ms: unknown) => {
        await new Promise<void>((resolve) => setTimeout(resolve, Number(ms)));
        return undefined;
      },
    });

    const controller = new AbortController();
    const start = Date.now();
    const abortTimer = setTimeout(() => controller.abort(), abortAfterMs);

    try {
      await expect(
        runReducer(nodes, variables, errors, controller.signal)
      ).rejects.toMatchObject({ name: 'AbortError' });
    } finally {
      clearTimeout(abortTimer);
    }

    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(iterations * delayMs);
  });

  it('if true', async () => {
    // "{{set flag true\nif flag}}ABC{{end}}"
    const nodes: FunCityBlockNode[] = [
      setNode('flag', variableNode('true')),
      ifNode(variableNode('flag'), [stringNode('ABC')], [stringNode('DEF')]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables(); // Included `true`
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual(['ABC']);
    expect(errors).toEqual([]);
  });

  it('if false', async () => {
    // "{{set flag false\nif flag}}ABC{{end}}"
    const nodes: FunCityBlockNode[] = [
      setNode('flag', variableNode('false')),
      ifNode(variableNode('flag'), [stringNode('ABC')], [stringNode('DEF')]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables(); // Included `false`
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual(['DEF']);
    expect(errors).toEqual([]);
  });

  it('apply lambda function', async () => {
    // "{{(fun foo foo) 123}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(lambdaNode(['foo'], variableNode('foo')), [numberNode(123)]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([123]);
    expect(errors).toEqual([]);
  });

  it('apply lambda function (empty parameter)', async () => {
    // "{{(fun [] 123) ()}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(lambdaNode([], numberNode(123)), []),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([123]);
    expect(errors).toEqual([]);
  });

  it('apply lambda function (multiple parameter)', async () => {
    // "{{(fun [a b] (add a b)) 1 2}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(
        lambdaNode(
          ['a', 'b'],
          applyNode(variableNode('add'), [variableNode('a'), variableNode('b')])
        ),
        [numberNode(1), numberNode(2)]
      ),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([3]);
    expect(errors).toEqual([]);
  });

  it('native function calling', async () => {
    // "{{foo 123}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(variableNode('foo'), [numberNode(123)]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const customVars = {
      foo: (v: unknown) => Number(v) + 100,
    };

    const variables = buildCandidateVariables(customVars);
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([223]);
    expect(errors).toEqual([]);
  });

  it('bind function and apply', async () => {
    // "{{set foo (fun abc (add abc 100))\nfoo 123}}"
    const nodes: FunCityBlockNode[] = [
      setNode(
        'foo',
        lambdaNode(
          ['abc'],
          applyNode(variableNode('add'), [variableNode('abc'), numberNode(100)])
        )
      ),
      applyNode(variableNode('foo'), [numberNode(123)]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([223]);
    expect(errors).toEqual([]);
  });

  it('lambda recursion with set binding', async () => {
    // "{{set foo (fun [n] (cond (equal n 0) 1 (mul n (foo (sub n 1)))))\nfoo 5}}"
    const trueNode = numberNode(1);
    const falseNode = applyNode(variableNode('mul'), [
      variableNode('n'),
      applyNode(variableNode('foo'), [
        applyNode(variableNode('sub'), [variableNode('n'), numberNode(1)]),
      ]),
    ]);
    const condNode = applyNode(variableNode('equal'), [
      variableNode('n'),
      numberNode(0),
    ]);
    const condApplyNode = applyNode(variableNode('cond'), [
      condNode,
      trueNode,
      falseNode,
    ]);

    const nodes: FunCityBlockNode[] = [
      setNode('foo', lambdaNode(['n'], condApplyNode)),
      applyNode(variableNode('foo'), [numberNode(5)]),
    ];
    const errors: FunCityErrorInfo[] = [];

    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([120]);
    expect(errors).toEqual([]);
  });

  it('native function calling and use context', async () => {
    // "{{set bar 100\nfoo 123}}"
    const nodes: FunCityBlockNode[] = [
      setNode('bar', numberNode(100)),
      applyNode(variableNode('foo'), [numberNode(123)]),
    ];
    const errors: FunCityErrorInfo[] = [];

    async function foo(this: FunCityFunctionContext, v: unknown) {
      return Number(v) + this.variables.bar;
    }
    const customVars = {
      foo,
    };

    const variables = buildCandidateVariables(customVars);
    const reduced = await runReducer(nodes, variables, errors);

    expect(reduced).toEqual([223]);
    expect(errors).toEqual([]);
  });
});
