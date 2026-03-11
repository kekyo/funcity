// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { describe, expect, it } from 'vitest';

import type { FunCityBlockNode, FunCityWarningEntry } from '../src/types';
import { createReducerContext, runReducer } from '../src/reducer';
import {
  createDCodegen,
  type FunCityDynamicCodeGeneratorBackend,
} from '../src/dcodegen';
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
  extra?: Record<string, unknown>,
  backend?: FunCityDynamicCodeGeneratorBackend
) => {
  const warningLogs: FunCityWarningEntry[] = [];
  const variables = buildCandidateVariables(extra ?? {});
  const dcodegen = createDCodegen({ backend });
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
  extra?: Record<string, unknown>,
  backend?: FunCityDynamicCodeGeneratorBackend
) => {
  const reducerWarnings: FunCityWarningEntry[] = [];
  const reduced = await runReducer(
    nodes,
    buildCandidateVariables(extra ?? {}),
    reducerWarnings
  );
  const generated = await runGenerated(nodes, extra, backend);
  expect(generated.result).toEqual(reduced);
  expect(generated.warningLogs).toEqual(reducerWarnings);
};

describe('dynamic code generator test', () => {
  for (const backend of ['closure', 'source'] as const) {
    describe(`${backend} backend`, () => {
      it('matches reducer on mixed root blocks', async () => {
        await expectGeneratedMatchesReducer(
          [
            textNode('Hello'),
            applyNode('add', [numberNode(1), numberNode(2)]),
            textNode('World'),
          ],
          undefined,
          backend
        );
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
          },
          backend
        );
      });

      it('matches reducer on control flow nodes', async () => {
        await expectGeneratedMatchesReducer(
          [
            setNode('value', numberNode(0)),
            ifNode(variableNode('true'), [textNode('A')], [textNode('B')]),
            forNode(
              'item',
              applyNode('range', [numberNode(1), numberNode(3)]),
              [variableNode('item')]
            ),
            whileNode(applyNode('lt', [variableNode('value'), numberNode(2)]), [
              setNode(
                'value',
                applyNode('add', [variableNode('value'), numberNode(1)])
              ),
              variableNode('value'),
            ]),
          ],
          undefined,
          backend
        );
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
        await expectGeneratedMatchesReducer(
          [
            setNode('fib', funNode(['n'], fibBody)),
            applyNode(variableNode('fib'), [numberNode(10)]),
          ],
          undefined,
          backend
        );
      });

      it('matches reducer when lambda parameters shadow outer values', async () => {
        await expectGeneratedMatchesReducer(
          [
            setNode('value', numberNode(40)),
            setNode(
              'bump',
              funNode(
                ['value'],
                applyNode('add', [variableNode('value'), numberNode(2)])
              )
            ),
            applyNode(variableNode('bump'), [numberNode(5)]),
          ],
          undefined,
          backend
        );
      });

      it('matches reducer on dot access from lambda parameters', async () => {
        await expectGeneratedMatchesReducer(
          [
            setNode(
              'readValue',
              funNode(
                ['record'],
                dotNode(variableNode('record'), [{ name: 'value' }])
              )
            ),
            applyNode(variableNode('readValue'), [variableNode('record')]),
          ],
          {
            record: {
              value: 12,
            },
          },
          backend
        );
      });

      it('keeps cond lazy when intrinsic path is used', async () => {
        await expectGeneratedMatchesReducer(
          [
            applyNode('cond', [
              variableNode('true'),
              stringNode('then'),
              applyNode(variableNode('missingElseBranch'), []),
            ]),
          ],
          undefined,
          backend
        );
      });

      it('matches reducer on intrinsic defaults, logicals and set', async () => {
        await expectGeneratedMatchesReducer(
          [
            applyNode('and', [variableNode('true'), variableNode('true')]),
            applyNode('or', [variableNode('false'), variableNode('true')]),
            applyNode('defaults', [
              variableNode('undefined'),
              stringNode('fallback'),
            ]),
            setNode('value', numberNode(5)),
            variableNode('value'),
          ],
          undefined,
          backend
        );
      });

      it('keeps defaults and logical intrinsics lazy when used', async () => {
        await expectGeneratedMatchesReducer(
          [
            applyNode('and', [
              variableNode('false'),
              applyNode(variableNode('missingAndBranch'), []),
            ]),
            applyNode('or', [
              variableNode('true'),
              applyNode(variableNode('missingOrBranch'), []),
            ]),
            applyNode('defaults', [
              numberNode(1),
              applyNode(variableNode('missingDefaultBranch'), []),
            ]),
          ],
          undefined,
          backend
        );
      });

      it('exposes generated expression and block functions', async () => {
        const warningLogs: FunCityWarningEntry[] = [];
        const variables = buildCandidateVariables();
        const dcodegen = createDCodegen({ backend });
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
        await expect(generatedBlock(reducerContext)).resolves.toEqual([
          undefined,
        ]);
        expect(warningLogs).toEqual([]);
      });

      it('renders text programs without building result arrays', async () => {
        const warningLogs: FunCityWarningEntry[] = [];
        const variables = buildCandidateVariables({ name: 'World' });
        const dcodegen = createDCodegen({ backend });
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

        await expect(generatedText(reducerContext)).resolves.toBe(
          'Hello World!'
        );
        expect(warningLogs).toEqual([]);
      });

      it('falls back when a specializable builtin is shadowed', async () => {
        await expectGeneratedMatchesReducer(
          [applyNode('add', [numberNode(1), numberNode(2)])],
          {
            add: (lhs: number, rhs: number) => lhs * rhs,
          },
          backend
        );
      });

      it('falls back when cond is shadowed', async () => {
        await expectGeneratedMatchesReducer(
          [
            applyNode('cond', [
              variableNode('true'),
              stringNode('then'),
              stringNode('else'),
            ]),
          ],
          {
            cond: (
              _condition: unknown,
              whenTrue: unknown,
              _whenFalse: unknown
            ) => `shadow:${String(whenTrue)}`,
          },
          backend
        );
      });

      it('matches reducer on intrinsic fun argument warnings', async () => {
        await expectGeneratedMatchesReducer(
          [
            setNode('id', funNode(['value'], variableNode('value'))),
            applyNode(variableNode('id'), [numberNode(7), numberNode(9)]),
          ],
          undefined,
          backend
        );
      });

      it('falls back when fun is shadowed', async () => {
        await expectGeneratedMatchesReducer(
          [applyNode('fun', [stringNode('lhs'), stringNode('rhs')])],
          {
            fun: (lhs: string, rhs: string) => `${lhs}:${rhs}`,
          },
          backend
        );
      });

      it('falls back when additional intrinsics are shadowed', async () => {
        await expectGeneratedMatchesReducer(
          [
            applyNode('and', [numberNode(1), numberNode(2)]),
            applyNode('defaults', [stringNode('lhs'), stringNode('rhs')]),
            applyNode('set', [variableNode('shadowedValue'), numberNode(2)]),
          ],
          {
            shadowedValue: 'seed',
            and: (lhs: number, rhs: number) => lhs + rhs,
            defaults: (lhs: string, rhs: string) => `${lhs}:${rhs}`,
            set: (lhs: unknown, rhs: unknown) =>
              `${String(lhs)}:${String(rhs)}`,
          },
          backend
        );
      });

      it('matches reducer on inlined standard builtin fast paths', async () => {
        await expectGeneratedMatchesReducer(
          [
            applyNode('toString', [numberNode(12), stringNode('x')]),
            applyNode('add', [numberNode(1), numberNode(2), numberNode(3)]),
            applyNode('sub', [numberNode(10), numberNode(3), numberNode(2)]),
            applyNode('mul', [numberNode(2), numberNode(3), numberNode(4)]),
            applyNode('lt', [numberNode(1), numberNode(2)]),
            applyNode('not', [variableNode('false')]),
            applyNode('toNumber', [stringNode('12')]),
            applyNode('toBigInt', [stringNode('12')]),
            applyNode('typeof', [numberNode(10)]),
            applyNode('trim', [stringNode(' hi ')]),
            applyNode('toUpper', [stringNode('ab')]),
            applyNode('toLower', [stringNode('AB')]),
            applyNode('length', [stringNode('abcd')]),
            applyNode('at', [numberNode(1), stringNode('abcd')]),
            applyNode('first', [stringNode('abcd')]),
            applyNode('last', [stringNode('abcd')]),
            applyNode('slice', [numberNode(1), stringNode('abcd')]),
            applyNode('slice', [
              numberNode(1),
              numberNode(3),
              stringNode('abcd'),
            ]),
          ],
          undefined,
          backend
        );
      });
    });
  }
});
