// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import type {
  FunCityLogEntry,
  FunCityRange,
  FunCityNumberToken,
  FunCityStringToken,
  FunCityToken,
  FunCityIdentityToken,
  FunCityNumberNode,
  FunCityStringNode,
  FunCityVariableNode,
  FunCityExpressionNode,
  FunCityBlockNode,
  ParserCursor,
} from './types';
import { emptyRange, widerRange } from './utils';

//////////////////////////////////////////////////////////////////////////////

const parseNumber = (
  cursor: ParserCursor,
  _errors: FunCityLogEntry[]
): FunCityNumberNode => {
  const token = cursor.takeToken() as FunCityNumberToken;
  return {
    kind: 'number',
    value: token.value,
    range: token.range,
  };
};

const parseString = (
  cursor: ParserCursor,
  _errors: FunCityLogEntry[]
): FunCityStringNode => {
  const token = cursor.takeToken() as FunCityStringToken;
  return {
    kind: 'string',
    value: token.value,
    range: token.range,
  };
};

const parseIdentity = (
  cursor: ParserCursor,
  _errors: FunCityLogEntry[]
): FunCityVariableNode => {
  const token = cursor.takeToken() as FunCityIdentityToken;
  return {
    kind: 'variable',
    name: token.name,
    range: token.range,
  };
};

const unitKind = "'()'";
interface PartialUnitExpressionNode {
  kind: "'()'";
  range: FunCityRange;
}

type PartialParsedExpressionNode =
  | FunCityExpressionNode
  | PartialUnitExpressionNode;

const combineIntoScopeMultipleExpressions = (
  expressionList: readonly FunCityExpressionNode[],
  ...outerRanges: FunCityRange[]
): FunCityExpressionNode | undefined => {
  switch (expressionList.length) {
    case 0: {
      return undefined;
    }
    case 1: {
      return expressionList[0]!;
    }
    default: {
      return {
        kind: 'scope',
        nodes: expressionList,
        range: widerRange(
          ...expressionList.map((node) => node.range),
          ...outerRanges
        ),
      };
    }
  }
};

const parsePartialExpression = (
  cursor: ParserCursor,
  logs: FunCityLogEntry[]
): PartialParsedExpressionNode | undefined => {
  const token = cursor.peekToken();
  if (!token) {
    return undefined;
  }
  switch (token.kind) {
    case 'number': {
      const node = parseNumber(cursor, logs);
      return node;
    }
    case 'string': {
      const node = parseString(cursor, logs);
      return node;
    }
    case 'identity': {
      const node = parseIdentity(cursor, logs);
      return node;
    }
    case 'open': {
      cursor.skipToken();
      switch (token.symbol) {
        // Parenthesis surrounding expression list `( ... )` (Scope)
        case '(': {
          const innerNodes = parseMultipleApplicationExpressions(cursor, logs);
          const closeToken = cursor.peekToken();
          let range: FunCityRange;
          if (!closeToken) {
            range = widerRange(
              token.range,
              ...innerNodes.map((node) => node.range)
            );
            logs.push({
              type: 'error',
              description: 'Could not find close parenthesis',
              range: widerRange(
                token.range,
                ...innerNodes.map((node) => node.range)
              ),
            });
          } else {
            cursor.skipToken();
            range = widerRange(
              token.range,
              ...innerNodes.map((node) => node.range),
              closeToken.range
            );
            if (closeToken.kind !== 'close' || closeToken.symbol !== ')') {
              logs.push({
                type: 'error',
                description: `Mismatched close parenthesis`,
                range,
              });
            }
          }
          // Specialized unit node '()' is made by empty nodes
          if (innerNodes.length === 0) {
            return {
              kind: unitKind,
              range,
            };
          } else {
            // When multiple expressions exist, they must be grouped into a single expression within a scope.
            const node = combineIntoScopeMultipleExpressions(innerNodes, range);
            return node;
          }
        }
        // Bracket surrounding expression list `[ ... ]` (Iterable list)
        case '[': {
          const itemNodes = parseListExpression(cursor, logs);
          const closeToken = cursor.peekToken();
          let range: FunCityRange;
          if (!closeToken) {
            range = widerRange(
              token.range,
              ...itemNodes.map((node) => node.range)
            );
            logs.push({
              type: 'error',
              description: 'Could not find close bracket',
              range,
            });
          } else {
            cursor.skipToken();
            range = widerRange(
              token.range,
              ...itemNodes.map((node) => node.range),
              closeToken.range
            );
            if (closeToken.kind !== 'close' || closeToken.symbol !== ']') {
              logs.push({
                type: 'error',
                description: `Mismatched close bracket`,
                range,
              });
            }
          }
          return {
            kind: 'list',
            items: itemNodes,
            range,
          };
        }
        default: {
          logs.push({
            type: 'error',
            description: `Invalid open parenthesis/bracket`,
            range: token.range,
          });
          return undefined;
        }
      }
    }
  }
  return undefined;
};

const normalizePartialUnitNode = (
  node: PartialParsedExpressionNode,
  logs: FunCityLogEntry[]
): FunCityExpressionNode => {
  if (node.kind === unitKind) {
    logs.push({
      type: 'error',
      description: `Invalid ${unitKind} at this location`,
      range: node.range,
    });
    return {
      kind: 'variable',
      name: 'undefined',
      range: node.range,
    };
  } else {
    return node;
  }
};

const finalizeApplicationException = (
  partialNodes: readonly PartialParsedExpressionNode[],
  logs: FunCityLogEntry[]
): FunCityExpressionNode | undefined => {
  // Empty inputs
  if (partialNodes.length === 0) {
    return;
  }
  // Single variable
  if (partialNodes.length === 1) {
    return normalizePartialUnitNode(partialNodes[0]!, logs);
  }
  // Application
  const func = partialNodes[0]!;
  if (func.kind === unitKind) {
    logs.push({
      type: 'error',
      description: `Invalid ${unitKind} at this location`,
      range: func.range,
    });
    return undefined;
  }
  const arg0 = partialNodes[1]!;
  if (arg0.kind === unitKind) {
    return {
      kind: 'apply',
      func: func as FunCityExpressionNode,
      args: [], // Unit application: `foobar ()`
      range: widerRange(func.range, arg0.range),
    };
  }
  const args = partialNodes
    .slice(1)
    .map((node) => normalizePartialUnitNode(node, logs));
  return {
    kind: 'apply',
    func: func as FunCityExpressionNode,
    args,
    range: widerRange(func.range, ...args.map((node) => node.range)),
  };
};

const parseMultipleApplicationExpressions = (
  cursor: ParserCursor,
  logs: FunCityLogEntry[]
): FunCityExpressionNode[] => {
  const expressionList: FunCityExpressionNode[] = [];
  const partialNodes: PartialParsedExpressionNode[] = [];

  while (true) {
    const token = cursor.peekToken();
    if (!token) {
      break;
    }
    switch (token.kind) {
      case 'eol': {
        cursor.skipToken();
        const expr = finalizeApplicationException(partialNodes, logs);
        if (expr) {
          expressionList.push(expr);
        }
        partialNodes.length = 0;
        continue;
      }
    }
    const partialNode = parsePartialExpression(cursor, logs);
    if (!partialNode) {
      break;
    }
    partialNodes.push(partialNode);
  }

  const expr = finalizeApplicationException(partialNodes, logs);
  if (expr) {
    expressionList.push(expr);
  }
  return expressionList;
};

const parseListExpression = (
  cursor: ParserCursor,
  logs: FunCityLogEntry[]
): FunCityExpressionNode[] => {
  const itemNodes: FunCityExpressionNode[] = [];

  while (true) {
    const token = cursor.peekToken();
    if (!token) {
      break;
    }

    switch (token.kind) {
      case 'eol': {
        // Ignore in the list
        continue;
      }
    }

    const partialNode = parsePartialExpression(cursor, logs);
    if (!partialNode) {
      break;
    }

    itemNodes.push(normalizePartialUnitNode(partialNode, logs));
  }

  return itemNodes;
};

const drainEndOfLineAndPeek = (
  cursor: ParserCursor
): FunCityToken | undefined => {
  let token = cursor.peekToken();
  while (token) {
    if (token.kind === 'eol') {
      cursor.skipToken();
    } else {
      break;
    }
    token = cursor.peekToken();
  }
  return token;
};

/**
 * Parse expression in the single line.
 * @param cursor - Parser cursor
 * @param logs - Will be stored detected warnings/logs into it
 * @returns Parsed expression node when available
 */
export const parseExpression = (
  cursor: ParserCursor,
  logs: FunCityLogEntry[]
): FunCityExpressionNode | undefined => {
  // Ignored when reached end of line or end of cursor.
  let token = drainEndOfLineAndPeek(cursor);
  if (!token) {
    return undefined;
  }

  // Parse (might be an application) an expression.
  const partialNodes: PartialParsedExpressionNode[] = [];

  while (true) {
    // Parse current cursor location.
    const partialNode = parsePartialExpression(cursor, logs);
    if (!partialNode) {
      // Exit when failed (finished stacking nodes)
      break;
    }
    partialNodes.push(partialNode);

    // Peek next token.
    token = cursor.peekToken();

    // Reached end of cursor.
    if (!token) {
      break;
    }

    // Reached end of line.
    if (token.kind === 'eol') {
      cursor.skipToken();
      token = cursor.peekToken();
      break;
    }
  }

  // Consume trailing garbage eol
  drainEndOfLineAndPeek(cursor);

  // Finalize nodes into apply expression when available multiple expressions.
  const expr = finalizeApplicationException(partialNodes, logs);
  return expr;
};

//////////////////////////////////////////////////////////////////////////////

interface BranchState {
  blocks: FunCityBlockNode[];
  exprBuffer: FunCityExpressionNode[];
}

const createBranchState = (): BranchState => ({
  blocks: [],
  exprBuffer: [],
});

interface RootStatementState {
  readonly kind: 'root';
  readonly startRange: FunCityRange;
  readonly branch: BranchState;
}

interface IfStatementState {
  readonly kind: 'if';
  readonly startRange: FunCityRange;
  readonly condition: FunCityExpressionNode;
  readonly then: BranchState;
  readonly else: BranchState;
  currentBlock: 'then' | 'else';
}

interface WhileStatementState {
  readonly kind: 'while';
  readonly startRange: FunCityRange;
  readonly condition: FunCityExpressionNode;
  readonly repeat: BranchState;
}

interface ForStatementState {
  readonly kind: 'for';
  readonly startRange: FunCityRange;
  readonly bind: FunCityVariableNode;
  readonly iterable: FunCityExpressionNode;
  readonly repeat: BranchState;
}

type LogicalStatementState =
  | RootStatementState
  | IfStatementState
  | WhileStatementState
  | ForStatementState;

const getBranchState = (statementState: LogicalStatementState): BranchState => {
  switch (statementState.kind) {
    case 'root': {
      return statementState.branch;
    }
    case 'if': {
      return statementState.currentBlock === 'then'
        ? statementState.then
        : statementState.else;
    }
    case 'while':
    case 'for': {
      return statementState.repeat;
    }
  }
};

const flushExpressions = (branch: BranchState) => {
  if (branch.exprBuffer.length === 0) {
    return;
  }
  if (branch.exprBuffer.length === 1) {
    branch.blocks.push(branch.exprBuffer[0]!);
  } else {
    branch.blocks.push({
      kind: 'scope',
      nodes: branch.exprBuffer,
      range: widerRange(...branch.exprBuffer.map((node) => node.range)),
    });
  }
  branch.exprBuffer = [];
};

const flushCurrentBranch = (statementStates: LogicalStatementState[]) => {
  const statementState = statementStates[statementStates.length - 1]!;
  flushExpressions(getBranchState(statementState));
};

const flushStatementState = (statementState: LogicalStatementState) => {
  switch (statementState.kind) {
    case 'root': {
      flushExpressions(statementState.branch);
      break;
    }
    case 'if': {
      flushExpressions(statementState.then);
      flushExpressions(statementState.else);
      break;
    }
    case 'while':
    case 'for': {
      flushExpressions(statementState.repeat);
      break;
    }
  }
};

const pushExpressionNode = (
  statementStates: LogicalStatementState[],
  node: FunCityExpressionNode
) => {
  const statementState = statementStates[statementStates.length - 1]!;
  const branch = getBranchState(statementState);
  branch.exprBuffer.push(node);
};

const pushBlockNode = (
  statementStates: LogicalStatementState[],
  node: FunCityBlockNode
) => {
  const statementState = statementStates[statementStates.length - 1]!;
  const branch = getBranchState(statementState);
  flushExpressions(branch);
  branch.blocks.push(node);
};

const pushNode = (
  statementStates: LogicalStatementState[],
  node: FunCityBlockNode
) => {
  switch (node.kind) {
    case 'text':
    case 'if':
    case 'while':
    case 'for': {
      pushBlockNode(statementStates, node);
      break;
    }
    default: {
      pushExpressionNode(statementStates, node);
      break;
    }
  }
};

const parseStatementArguments = (
  cursor: ParserCursor,
  logs: FunCityLogEntry[]
): FunCityExpressionNode[] => {
  const args: FunCityExpressionNode[] = [];

  while (true) {
    const token = cursor.peekToken();
    if (!token) {
      break;
    }

    if (token.kind === 'eol') {
      cursor.skipToken();
      break;
    }

    const partialNode = parsePartialExpression(cursor, logs);
    if (!partialNode) {
      break;
    }

    args.push(normalizePartialUnitNode(partialNode, logs));
  }

  return args;
};

type ParseMode = 'script' | 'code';

const parseBlockCore = (
  cursor: ParserCursor,
  logs: FunCityLogEntry[],
  mode: ParseMode
): FunCityBlockNode[] => {
  // Logical statement state is started at 'root' state.
  // All block node will be aggregated into it.
  const rootState: RootStatementState = {
    kind: 'root',
    startRange: emptyRange,
    branch: createBranchState(),
  };
  const statementStates: LogicalStatementState[] = [rootState];
  const isCodeMode = mode === 'code';
  let isInExpressionBlock = isCodeMode;

  while (true) {
    const token = drainEndOfLineAndPeek(cursor);
    if (!token) {
      break;
    }

    switch (token.kind) {
      case 'text': {
        cursor.skipToken();
        if (isInExpressionBlock) {
          logs.push({
            type: 'error',
            description: `Already opened expression block (tokenizer bug?)`,
            range: token.range,
          });
          break;
        }
        pushNode(statementStates, {
          kind: 'text',
          text: token.text,
          range: token.range,
        });
        break;
      }
      case 'open': {
        // Beginnig expression block.
        if (token.symbol === '{{') {
          cursor.skipToken();
          if (!isCodeMode) {
            if (isInExpressionBlock) {
              logs.push({
                type: 'error',
                description: `Already opened expression block`,
                range: token.range,
              });
            }
            isInExpressionBlock = true;
          }
        } else {
          const node = parseExpression(cursor, logs);
          if (node) {
            pushNode(statementStates, node);
          }
        }
        break;
      }
      case 'close': {
        // Check closing.
        cursor.skipToken();
        if (token.symbol === '}}' && isCodeMode) {
          flushCurrentBranch(statementStates);
          break;
        }
        if (!isInExpressionBlock) {
          logs.push({
            type: 'error',
            description: `Mismatched close bracket`,
            range: token.range,
          });
          break;
        }
        if (isCodeMode) {
          logs.push({
            type: 'error',
            description: `Mismatched close bracket`,
            range: token.range,
          });
          break;
        }
        flushCurrentBranch(statementStates);
        isInExpressionBlock = false;
        break;
      }
      case 'identity': {
        if (!isInExpressionBlock) {
          logs.push({
            type: 'error',
            description: `Invalid identity (tokenizer bug?)`,
            range: token.range,
          });
          break;
        }
        switch (token.name) {
          case 'if': {
            cursor.skipToken();
            const args = parseStatementArguments(cursor, logs);
            if (args.length !== 1) {
              logs.push({
                type: 'error',
                description: 'Required `if` condition',
                range: widerRange(
                  token.range,
                  ...args.map((node) => node.range)
                ),
              });
              break;
            }
            const conditionNode = args[0]!;
            statementStates.push({
              kind: 'if',
              startRange: token.range,
              condition: conditionNode,
              then: createBranchState(),
              else: createBranchState(),
              currentBlock: 'then',
            });
            break;
          }
          case 'else': {
            cursor.skipToken();
            const args = parseStatementArguments(cursor, logs);
            if (args.length !== 0) {
              logs.push({
                type: 'error',
                description: 'Could not take any arguments in `else` statement',
                range: widerRange(
                  token.range,
                  ...args.map((node) => node.range)
                ),
              });
            }
            if (statementStates.length <= 1) {
              logs.push({
                type: 'error',
                description: 'Cound not find pair of `if` statement',
                range: token.range,
              });
              break;
            }
            const lastState = statementStates[statementStates.length - 1]!;
            if (lastState.kind !== 'if') {
              logs.push({
                type: 'error',
                description: 'Cound not find pair of `if` statement',
                range: token.range,
              });
              break;
            }
            if (lastState.currentBlock === 'else') {
              logs.push({
                type: 'error',
                description: 'Duplicated `else` statement',
                range: token.range,
              });
              break;
            }
            flushExpressions(lastState.then);
            lastState.currentBlock = 'else';
            break;
          }
          case 'while': {
            cursor.skipToken();
            const args = parseStatementArguments(cursor, logs);
            if (args.length !== 1) {
              logs.push({
                type: 'error',
                description: 'Required `while` condition',
                range: widerRange(
                  token.range,
                  ...args.map((node) => node.range)
                ),
              });
              break;
            }
            const conditionNode = args[0]!;
            statementStates.push({
              kind: 'while',
              startRange: token.range,
              condition: conditionNode,
              repeat: createBranchState(),
            });
            break;
          }
          case 'for': {
            cursor.skipToken();
            const args = parseStatementArguments(cursor, logs);
            if (args.length !== 2) {
              logs.push({
                type: 'error',
                description:
                  'Required `for` bind identity and iterable expression',
                range: widerRange(
                  token.range,
                  ...args.map((node) => node.range)
                ),
              });
              break;
            }
            const bindNode = args[0]!;
            if (bindNode.kind !== 'variable') {
              logs.push({
                type: 'error',
                description: 'Required `for` bind identity',
                range: bindNode.range,
              });
              break;
            }
            const iterableNode = args[1]!;
            statementStates.push({
              kind: 'for',
              startRange: token.range,
              bind: bindNode,
              iterable: iterableNode,
              repeat: createBranchState(),
            });
            break;
          }
          case 'end': {
            cursor.skipToken();
            const args = parseStatementArguments(cursor, logs);
            if (args.length !== 0) {
              logs.push({
                type: 'error',
                description: 'Could not take any arguments in `end` statement',
                range: widerRange(
                  token.range,
                  ...args.map((node) => node.range)
                ),
              });
            }
            if (statementStates.length <= 1) {
              logs.push({
                type: 'error',
                description:
                  'Cound not find pair of `if`,`while` or `for` statement',
                range: token.range,
              });
              break;
            }
            const lastState = statementStates.pop()!;
            flushStatementState(lastState);
            switch (lastState.kind) {
              case 'if': {
                pushNode(statementStates, {
                  kind: 'if',
                  condition: lastState.condition,
                  then: lastState.then.blocks,
                  else: lastState.else.blocks,
                  range: widerRange(
                    lastState.startRange,
                    lastState.condition.range,
                    ...lastState.then.blocks.map((node) => node.range),
                    ...lastState.else.blocks.map((node) => node.range),
                    token.range
                  ),
                });
                break;
              }
              case 'while': {
                pushNode(statementStates, {
                  kind: 'while',
                  condition: lastState.condition,
                  repeat: lastState.repeat.blocks,
                  range: widerRange(
                    lastState.startRange,
                    lastState.condition.range,
                    ...lastState.repeat.blocks.map((node) => node.range),
                    token.range
                  ),
                });
                break;
              }
              case 'for': {
                pushNode(statementStates, {
                  kind: 'for',
                  bind: lastState.bind,
                  iterable: lastState.iterable,
                  repeat: lastState.repeat.blocks,
                  range: widerRange(
                    lastState.startRange,
                    lastState.bind.range,
                    ...lastState.repeat.blocks.map((node) => node.range),
                    token.range
                  ),
                });
                break;
              }
            }
            break;
          }
          default: {
            const node = parseExpression(cursor, logs);
            if (node) {
              pushNode(statementStates, node);
            }
            break;
          }
        }
        break;
      }
      default: {
        if (!isInExpressionBlock) {
          logs.push({
            type: 'error',
            description: `Invalid ${token.kind} (tokenizer bug?)`,
            range: token.range,
          });
          break;
        }
        const node = parseExpression(cursor, logs);
        if (node) {
          pushNode(statementStates, node);
        }
        break;
      }
    }
  }

  flushStatementState(rootState);
  if (statementStates.length !== 1) {
    logs.push({
      type: 'error',
      description: `Could not find statement closing`,
      range: widerRange(...statementStates.map((state) => state.startRange)),
    });
  }
  return rootState.branch.blocks;
};

/**
 * Parse blocks.
 * @param cursor - Parser cursor
 * @param logs - Will be stored detected warnings/logs into it
 * @returns Parsed block nodes
 */
export const parseBlock = (
  cursor: ParserCursor,
  logs: FunCityLogEntry[]
): FunCityBlockNode[] => {
  return parseBlockCore(cursor, logs, 'script');
};

//////////////////////////////////////////////////////////////////////////////

/**
 * Create a parser cursor.
 * @param tokens - Target tokens
 * @returns Parser cursor
 */
export const createParserCursor = (
  tokens: readonly FunCityToken[]
): ParserCursor => {
  let index = 0;

  const peekToken = () => {
    return tokens[index];
  };
  const takeToken = () => {
    if (index >= tokens.length) {
      return undefined;
    }
    const token = tokens[index];
    index++;
    return token;
  };
  const skipToken = () => {
    if (index >= tokens.length) {
      return;
    }
    index++;
  };

  return {
    peekToken,
    takeToken,
    skipToken,
  };
};

//////////////////////////////////////////////////////////////////////////////

/**
 * Parse expressions in code block.
 * @param tokens - Token list
 * @param logs - Will be stored detected warnings/logs into it
 * @returns Parsed node list
 */
export const parseExpressions = (
  tokens: readonly FunCityToken[],
  logs: FunCityLogEntry[]
): FunCityBlockNode[] => {
  const cursor = createParserCursor(tokens);
  return parseBlockCore(cursor, logs, 'code');
};

//////////////////////////////////////////////////////////////////////////////

/**
 * Run the parser.
 * @param tokens - Token list
 * @param logs - Will be stored detected warnings/logs into it
 * @returns Parsed node list
 */
export const runParser = (
  tokens: readonly FunCityToken[],
  logs: FunCityLogEntry[]
): FunCityBlockNode[] => {
  const cursor = createParserCursor(tokens);

  const blockNodes = parseBlock(cursor, logs);
  return blockNodes;
};
