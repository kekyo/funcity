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
  type FunCityDynamicCodeGeneratorOptions,
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

const expectGeneratedMatchesReducerWithOptions = async (
  nodes: readonly FunCityBlockNode[],
  options: FunCityDynamicCodeGeneratorOptions,
  extra?: Record<string, unknown>
) => {
  const reducerWarnings: FunCityWarningEntry[] = [];
  const reduced = await runReducer(
    nodes,
    buildCandidateVariables(extra ?? {}),
    reducerWarnings
  );
  const warningLogs: FunCityWarningEntry[] = [];
  const variables = buildCandidateVariables(extra ?? {});
  const dcodegen = createDCodegen(options);
  const reducerContext = createReducerContext(
    variables,
    warningLogs,
    dcodegen.createExecutor()
  );
  const generated = dcodegen.generateProgram(nodes);
  const result = await generated(reducerContext);
  expect(result).toEqual(reduced);
  expect(warningLogs).toEqual(reducerWarnings);
};

const runGeneratedWithOptions = async (
  nodes: readonly FunCityBlockNode[],
  options: FunCityDynamicCodeGeneratorOptions,
  extra?: Record<string, unknown>
) => {
  const warningLogs: FunCityWarningEntry[] = [];
  const variables = buildCandidateVariables(extra ?? {});
  const dcodegen = createDCodegen(options);
  const reducerContext = createReducerContext(
    variables,
    warningLogs,
    dcodegen.createExecutor()
  );
  const generated = dcodegen.generateProgram(nodes);
  const result = await generated(reducerContext);
  return { result, warningLogs };
};

describe('dynamic code generator test', () => {
  for (const backend of ['closure', 'source'] as const) {
    describe(`${backend} backend`, () => {
      if (backend === 'source') {
        it('accepts aggressiveOptimize without changing semantics by default', async () => {
          await expectGeneratedMatchesReducerWithOptions(
            [
              setNode(
                'fib',
                funNode(
                  ['n'],
                  applyNode('cond', [
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
                  ])
                )
              ),
              applyNode(variableNode('fib'), [numberNode(8)]),
            ],
            {
              backend,
              aggressiveOptimize: true,
            }
          );
        });

        it('uses non-shadowable core symbols when aggressiveOptimize is enabled', async () => {
          const generated = await runGeneratedWithOptions(
            [
              variableNode('true'),
              variableNode('false'),
              variableNode('null'),
              variableNode('undefined'),
              applyNode('cond', [
                variableNode('true'),
                stringNode('then'),
                stringNode('else'),
              ]),
              setNode('value', numberNode(5)),
              variableNode('value'),
              setNode('id', funNode(['n'], variableNode('n'))),
              applyNode(variableNode('id'), [numberNode(4)]),
            ],
            {
              backend: 'source',
              aggressiveOptimize: true,
            },
            {
              true: false,
              false: true,
              null: 'shadowed',
              undefined: 'shadowed',
              cond: () => 'shadowed',
              set: () => 'shadowed',
              fun: () => 'shadowed',
            }
          );

          expect(generated.result).toEqual([true, false, null, 'then', 5, 4]);
          expect(generated.warningLogs).toEqual([]);
        });

        it('uses non-shadowable numeric and logical symbols when aggressiveOptimize is enabled', async () => {
          const generated = await runGeneratedWithOptions(
            [
              setNode('adder', variableNode('add')),
              applyNode('add', [numberNode(1), numberNode(2), numberNode(3)]),
              applyNode(variableNode('adder'), [numberNode(4), numberNode(5)]),
              applyNode('lt', [numberNode(1), numberNode(2)]),
              applyNode('not', [variableNode('false')]),
              applyNode('and', [
                variableNode('true'),
                applyNode('lt', [numberNode(1), numberNode(2)]),
                variableNode('false'),
              ]),
              applyNode('and', [
                variableNode('false'),
                applyNode(variableNode('explode'), []),
              ]),
              applyNode('or', [variableNode('false'), variableNode('true')]),
              applyNode('or', [
                variableNode('true'),
                applyNode(variableNode('explode'), []),
              ]),
            ],
            {
              backend: 'source',
              aggressiveOptimize: true,
            },
            {
              true: false,
              false: true,
              add: () => 'shadowed',
              lt: () => false,
              not: () => false,
              and: () => 'shadowed',
              or: () => 'shadowed',
              explode: () => {
                throw new Error('explode should not run');
              },
            }
          );

          expect(generated.result).toEqual([
            6,
            9,
            true,
            true,
            false,
            false,
            true,
            true,
          ]);
          expect(generated.warningLogs).toEqual([]);
        });

        it('uses non-shadowable collection symbols when aggressiveOptimize is enabled', async () => {
          const generated = await runGeneratedWithOptions(
            [
              setNode('makeRange', variableNode('range')),
              setNode('mapper', variableNode('map')),
              applyNode('range', [numberNode(1), numberNode(4)]),
              applyNode(variableNode('makeRange'), [
                numberNode(2),
                numberNode(3),
              ]),
              applyNode(variableNode('mapper'), [
                funNode(
                  ['x'],
                  applyNode('mul', [variableNode('x'), numberNode(2)])
                ),
                applyNode('range', [numberNode(1), numberNode(4)]),
              ]),
              applyNode('filter', [
                funNode(
                  ['x'],
                  applyNode('eq', [
                    applyNode('mod', [variableNode('x'), numberNode(2)]),
                    numberNode(0),
                  ])
                ),
                applyNode('range', [numberNode(1), numberNode(6)]),
              ]),
              applyNode('reduce', [
                numberNode(0),
                funNode(
                  ['acc', 'v'],
                  applyNode('add', [variableNode('acc'), variableNode('v')])
                ),
                applyNode('range', [numberNode(1), numberNode(4)]),
              ]),
            ],
            {
              backend: 'source',
              aggressiveOptimize: true,
            },
            {
              range: () => ['shadowed'],
              map: async () => ['shadowed'],
              filter: async () => ['shadowed'],
              reduce: async () => 'shadowed',
              mul: () => 0,
              mod: () => 0,
              eq: () => false,
              add: () => 0,
            }
          );

          expect(generated.result).toEqual([
            [1, 2, 3, 4],
            [2, 3, 4],
            [2, 4, 6, 8],
            [2, 4, 6],
            10,
          ]);
          expect(generated.warningLogs).toEqual([]);
        });
      }

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
