// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type {
  FunCityLogEntry,
  FunCityBlockNode,
  FunCityExpressionNode,
  FunCityFunctionContext,
  FunCityWarningEntry,
} from '../src/types';
import { buildCandidateVariables } from '../src/variables/standard-variables';
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
const dotNode = (
  base: FunCityExpressionNode,
  segments: readonly { name: string; optional?: boolean }[]
) => ({
  kind: 'dot' as const,
  base,
  segments: segments.map((segment) => ({
    name: segment.name,
    optional: segment.optional ?? false,
    range,
    operatorRange: range,
  })),
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
const funNode = (names: readonly string[], body: FunCityExpressionNode) => {
  const nameNode =
    names.length === 0
      ? listNode([])
      : names.length === 1
        ? variableNode(names[0]!)
        : listNode(names.map(variableNode));
  return applyNode(variableNode('fun'), [nameNode, body]);
};
const scopeNode = (nodes: FunCityExpressionNode[]) => ({
  kind: 'scope' as const,
  nodes,
  range,
});
const setNode = (name: string, expr: FunCityExpressionNode) => ({
  kind: 'apply' as const,
  func: variableNode('set'),
  args: [variableNode(name), expr],
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

const expectReducerError = async (
  promise: Promise<unknown>,
  info: FunCityLogEntry
) => {
  await expect(promise).rejects.toMatchObject({ info });
};

describe('scripting reducer test', () => {
  it('empty', async () => {
    // "{{}}"
    const nodes: FunCityBlockNode[] = [];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([]);
    expect(warningLogs).toEqual([]);
  });

  it('number node', async () => {
    // "{{12345}}"
    const nodes: FunCityBlockNode[] = [numberNode(12345)];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([12345]);
    expect(warningLogs).toEqual([]);
  });

  it('string node', async () => {
    // "{{'hello'}}"
    const nodes: FunCityBlockNode[] = [stringNode('hello')];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual(['hello']);
    expect(warningLogs).toEqual([]);
  });

  it('variable node', async () => {
    // "{{true}}"
    const nodes: FunCityBlockNode[] = [variableNode('true')];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(); // Included `true`
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([true]);
    expect(warningLogs).toEqual([]);
  });

  it('text node', async () => {
    // "Hello"
    const nodes: FunCityBlockNode[] = [textNode('Hello')];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual(['Hello']);
    expect(warningLogs).toEqual([]);
  });

  it('variable node (not bind)', async () => {
    // "{{foobar}}"
    const nodes: FunCityBlockNode[] = [variableNode('foobar')];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    await expectReducerError(runReducer(nodes, variables, warningLogs), {
      type: 'error',
      description: 'variable is not bound: foobar',
      range,
    });

    expect(warningLogs).toEqual([]);
  });

  it('variable node (traverse)', async () => {
    // "{{foo.bar}}"
    const nodes: FunCityBlockNode[] = [
      dotNode(variableNode('foo'), [{ name: 'bar' }]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables({
      foo: {
        bar: 'ABC',
      },
    });
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual(['ABC']);
    expect(warningLogs).toEqual([]);
  });

  it('variable node (bound method)', async () => {
    // "{{foo.bar.get ()}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(
        dotNode(variableNode('foo'), [{ name: 'bar' }, { name: 'get' }]),
        []
      ),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables({
      foo: {
        bar: {
          value: 123,
          get() {
            return this.value;
          },
        },
      },
    });
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([123]);
    expect(warningLogs).toEqual([]);
  });

  it('variable node (function object method)', async () => {
    // "{{fn.get ()}}"
    const fn = Object.assign(
      function () {
        return 0;
      },
      {
        value: 456,
        get(this: { value: number }) {
          return this.value;
        },
      }
    );
    const nodes: FunCityBlockNode[] = [
      applyNode(dotNode(variableNode('fn'), [{ name: 'get' }]), []),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables({ fn });
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([456]);
    expect(warningLogs).toEqual([]);
  });

  it('dot node (expression base)', async () => {
    // "{{(foo ()).bar ()}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(
        dotNode(applyNode(variableNode('foo'), []), [{ name: 'bar' }]),
        []
      ),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables({
      foo() {
        return {
          value: 321,
          bar() {
            return this.value;
          },
        };
      },
    });
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([321]);
    expect(warningLogs).toEqual([]);
  });

  it('variable node (conditional combine)', async () => {
    // "{{siteName?}}"
    const nodes: FunCityBlockNode[] = [variableNode('siteName?')];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables({
      siteName: 'My Site',
    });
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual(['My Site']);
    expect(warningLogs).toEqual([]);
  });

  it('dot node (conditional combine)', async () => {
    // "{{foo?.bar}}"
    const nodes: FunCityBlockNode[] = [
      dotNode(variableNode('foo'), [{ name: 'bar', optional: true }]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([]);
    expect(warningLogs).toEqual([]);
  });

  it('dot node (optional dot with non-object base)', async () => {
    // "{{foo?.bar}}"
    const nodes: FunCityBlockNode[] = [
      dotNode(variableNode('foo'), [{ name: 'bar', optional: true }]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables({ foo: 123 });
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([]);
    expect(warningLogs).toEqual([]);
  });

  it('dot node (segment postfix optional)', async () => {
    // "{{foo.bar?}}"
    const nodes: FunCityBlockNode[] = [
      dotNode(variableNode('foo'), [{ name: 'bar?' }]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables({ foo: 123 });
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([]);
    expect(warningLogs).toEqual([]);
  });

  it('root list', async () => {
    // "Hello{{add 123 456}}World"
    const nodes: FunCityBlockNode[] = [
      textNode('Hello'),
      applyNode(variableNode('add'), [numberNode(123), numberNode(456)]),
      textNode('World'),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(); // Included `add`
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual(['Hello', 579, 'World']);
    expect(warningLogs).toEqual([]);
  });

  it('application node', async () => {
    // "{{add 123 456}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(variableNode('add'), [numberNode(123), numberNode(456)]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(); // Included `add`
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([579]);
    expect(warningLogs).toEqual([]);
  });

  it('multiple sentence', async () => {
    // "{{12345\n'hello'\ntrue}}"
    const nodes: FunCityBlockNode[] = [
      scopeNode([numberNode(12345), stringNode('hello'), variableNode('true')]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(); // Included `true`
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([true]); // Takes last one.
    expect(warningLogs).toEqual([]);
  });

  it('multiple expressions in the list', async () => {
    // "{{[12345 'hello' true]}}"
    const nodes: FunCityBlockNode[] = [
      listNode([numberNode(12345), stringNode('hello'), variableNode('true')]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(); // Included `true`
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([[12345, 'hello', true]]);
    expect(warningLogs).toEqual([]);
  });

  it('set variable', async () => {
    // "{{set foo 123\nfoo}}"
    const nodes: FunCityBlockNode[] = [
      setNode('foo', numberNode(123)),
      variableNode('foo'),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([123]);
    expect(warningLogs).toEqual([]);
  });

  it('set returns undefined', async () => {
    // "{{set foo 123}}"
    const nodes: FunCityBlockNode[] = [setNode('foo', numberNode(123))];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([]);
    expect(warningLogs).toEqual([]);
  });

  it('set inside function scope', async () => {
    // "{{(fun [] (set foo 1\nfoo)) ()}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(
        funNode(
          [],
          scopeNode([setNode('foo', numberNode(1)), variableNode('foo')])
        ),
        []
      ),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([1]);
    expect(warningLogs).toEqual([]);
  });

  it('set requires bind identity', async () => {
    // "{{set 1 missing}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(variableNode('set'), [numberNode(1), variableNode('missing')]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    await expectReducerError(runReducer(nodes, variables, warningLogs), {
      type: 'error',
      description: 'Required `set` bind identity',
      range,
    });

    expect(warningLogs).toEqual([]);
  });

  it('set requires two arguments (missing)', async () => {
    // "{{set foo}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(variableNode('set'), [variableNode('foo')]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    await expectReducerError(runReducer(nodes, variables, warningLogs), {
      type: 'error',
      description: 'Required `set` bind identity and expression',
      range,
    });

    expect(warningLogs).toEqual([]);
  });

  it('set requires two arguments (too many)', async () => {
    // "{{set foo 1 2}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(variableNode('set'), [
        variableNode('foo'),
        numberNode(1),
        numberNode(2),
      ]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    await expectReducerError(runReducer(nodes, variables, warningLogs), {
      type: 'error',
      description: 'Required `set` bind identity and expression',
      range,
    });

    expect(warningLogs).toEqual([]);
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

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual(['ABC', 'ABC', 'ABC', 'ABC', 'ABC']);

    expect(warningLogs).toEqual([]);
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

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

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

    expect(warningLogs).toEqual([]);
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

    const variables = buildCandidateVariables({
      delay: async (ms: unknown) => {
        await new Promise<void>((resolve) => setTimeout(resolve, Number(ms)));
        return undefined;
      },
    });

    const controller = new AbortController();
    const start = Date.now();
    const abortTimer = setTimeout(() => controller.abort(), abortAfterMs);

    const warningLogs: FunCityWarningEntry[] = [];
    try {
      await expect(
        runReducer(nodes, variables, warningLogs, controller.signal)
      ).rejects.toMatchObject({ name: 'AbortError' });
    } finally {
      clearTimeout(abortTimer);
    }

    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(iterations * delayMs);

    expect(warningLogs).toEqual([]);
  });

  it('if true', async () => {
    // "{{set flag true\nif flag}}ABC{{end}}"
    const nodes: FunCityBlockNode[] = [
      setNode('flag', variableNode('true')),
      ifNode(variableNode('flag'), [stringNode('ABC')], [stringNode('DEF')]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(); // Included `true`
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual(['ABC']);
    expect(warningLogs).toEqual([]);
  });

  it('if false', async () => {
    // "{{set flag false\nif flag}}ABC{{end}}"
    const nodes: FunCityBlockNode[] = [
      setNode('flag', variableNode('false')),
      ifNode(variableNode('flag'), [stringNode('ABC')], [stringNode('DEF')]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(); // Included `false`
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual(['DEF']);
    expect(warningLogs).toEqual([]);
  });

  it('apply function', async () => {
    // "{{(fun foo foo) 123}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(funNode(['foo'], variableNode('foo')), [numberNode(123)]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([123]);
    expect(warningLogs).toEqual([]);
  });

  it('apply function (empty parameter)', async () => {
    // "{{(fun [] 123) ()}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(funNode([], numberNode(123)), []),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([123]);
    expect(warningLogs).toEqual([]);
  });

  it('apply function (multiple parameter)', async () => {
    // "{{(fun [a b] (add a b)) 1 2}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(
        funNode(
          ['a', 'b'],
          applyNode(variableNode('add'), [variableNode('a'), variableNode('b')])
        ),
        [numberNode(1), numberNode(2)]
      ),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([3]);
    expect(warningLogs).toEqual([]);
  });

  it('fun requires two arguments', async () => {
    // "{{fun foo}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(variableNode('fun'), [variableNode('foo')]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    await expectReducerError(runReducer(nodes, variables, warningLogs), {
      type: 'error',
      description: 'Required `fun` parameter identity and expression',
      range,
    });

    expect(warningLogs).toEqual([]);
  });

  it('fun requires parameter identity', async () => {
    // "{{fun 1 2}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(variableNode('fun'), [numberNode(1), numberNode(2)]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    await expectReducerError(runReducer(nodes, variables, warningLogs), {
      type: 'error',
      description: 'Required `fun` parameter identity',
      range,
    });

    expect(warningLogs).toEqual([]);
  });

  it('native function calling', async () => {
    // "{{foo 123}}"
    const nodes: FunCityBlockNode[] = [
      applyNode(variableNode('foo'), [numberNode(123)]),
    ];

    const customVars = {
      foo: (v: unknown) => Number(v) + 100,
    };

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(customVars);
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([223]);
    expect(warningLogs).toEqual([]);
  });

  it('bind function and apply', async () => {
    // "{{set foo (fun abc (add abc 100))\nfoo 123}}"
    const nodes: FunCityBlockNode[] = [
      setNode(
        'foo',
        funNode(
          ['abc'],
          applyNode(variableNode('add'), [variableNode('abc'), numberNode(100)])
        )
      ),
      applyNode(variableNode('foo'), [numberNode(123)]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([223]);
    expect(warningLogs).toEqual([]);
  });

  it('function recursion with set binding', async () => {
    // "{{set foo (fun [n] (cond (eq n 0) 1 (mul n (foo (sub n 1)))))\nfoo 5}}"
    const trueNode = numberNode(1);
    const falseNode = applyNode(variableNode('mul'), [
      variableNode('n'),
      applyNode(variableNode('foo'), [
        applyNode(variableNode('sub'), [variableNode('n'), numberNode(1)]),
      ]),
    ]);
    const condNode = applyNode(variableNode('eq'), [
      variableNode('n'),
      numberNode(0),
    ]);
    const condApplyNode = applyNode(variableNode('cond'), [
      condNode,
      trueNode,
      falseNode,
    ]);

    const nodes: FunCityBlockNode[] = [
      setNode('foo', funNode(['n'], condApplyNode)),
      applyNode(variableNode('foo'), [numberNode(5)]),
    ];

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables();
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([120]);
    expect(warningLogs).toEqual([]);
  });

  it('native function calling and use context', async () => {
    // "{{set bar 100\nfoo 123}}"
    const nodes: FunCityBlockNode[] = [
      setNode('bar', numberNode(100)),
      applyNode(variableNode('foo'), [numberNode(123)]),
    ];

    async function foo(this: FunCityFunctionContext, v: unknown) {
      return Number(v) + Number(this.getValue('bar').value);
    }
    const customVars = {
      foo,
    };

    const warningLogs: FunCityWarningEntry[] = [];
    const variables = buildCandidateVariables(customVars);
    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([223]);
    expect(warningLogs).toEqual([]);
  });

  it('scope should see parent updates after local write', async () => {
    const delay = async (ms: unknown) => {
      await new Promise<void>((resolve) => setTimeout(resolve, Number(ms)));
      return undefined;
    };
    const variables = buildCandidateVariables({ x: 1, delay });

    const childExpr = applyNode(
      funNode(
        [],
        scopeNode([
          setNode('local', numberNode(0)),
          applyNode(variableNode('delay'), [numberNode(100)]),
          variableNode('x'),
        ])
      ),
      []
    );
    const parentUpdateExpr = scopeNode([
      applyNode(variableNode('delay'), [numberNode(10)]),
      setNode('x', numberNode(2)),
    ]);

    const warningLogs: FunCityWarningEntry[] = [];
    const nodes: FunCityBlockNode[] = [listNode([childExpr, parentUpdateExpr])];

    const reduced = await runReducer(nodes, variables, warningLogs);

    expect(reduced).toEqual([[2, undefined]]);
    expect(warningLogs).toEqual([]);
  });
});
