// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import {
  emptyRange,
  widerRange,
  type FunCityErrorInfo,
  type FunCityRange,
} from './utils';
import type {
  FunCityNumberToken,
  FunCityStringToken,
  FunCityToken,
  FunCityIdentityToken,
} from './tokenizer';

//////////////////////////////////////////////////////////////////////////////

/**
 * String expression node.
 */
export interface FunCityStringNode {
  /**
   * Node kind.
   */
  readonly kind: 'string';
  /**
   * String value.
   */
  readonly value: string;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Number (numeric) expression node.
 */
export interface FunCityNumberNode {
  /**
   * Node kind.
   */
  readonly kind: 'number';
  /**
   * Numeric value.
   */
  readonly value: number;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Variable (identity) expression node.
 */
export interface FunCityVariableNode {
  /**
   * Node kind.
   */
  readonly kind: 'variable';
  /**
   * Variable name.
   */
  readonly name: string;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Application expression node.
 */
export interface FunCityApplyNode {
  /**
   * Node kind.
   */
  readonly kind: 'apply';
  /**
   * Application target node.
   */
  readonly func: FunCityExpressionNode;
  /**
   * Application arguments.
   */
  readonly args: readonly FunCityExpressionNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Lambda expression node.
 */
export interface FunCityLambdaNode {
  /**
   * Node kind.
   */
  readonly kind: 'lambda';
  /**
   * Parameter names.
   */
  readonly names: readonly FunCityVariableNode[];
  /**
   * Lambda body expression.
   */
  readonly body: FunCityExpressionNode;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Expression list (array) node.
 */
export interface FunCityListNode {
  /**
   * Node kind.
   */
  readonly kind: 'list';
  /**
   * List item nodes.
   */
  readonly items: readonly FunCityExpressionNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Variable setter node.
 */
export interface FunCitySetNode {
  /**
   * Node kind.
   */
  readonly kind: 'set';
  /**
   * Target variable name.
   */
  readonly name: FunCityVariableNode;
  /**
   * Will be set the value from reduced expression.
   */
  readonly expr: FunCityExpressionNode;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Evaluate child scope node.
 */
export interface FunCityScopeNode {
  /**
   * Node kind.
   */
  readonly kind: 'scope';
  /**
   * Scoped node list.
   * @remarks Reduced each nodes, but takes last one reduced value.
   */
  readonly nodes: readonly FunCityExpressionNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The expression node.
 */
export type FunCityExpressionNode =
  | FunCityNumberNode
  | FunCityStringNode
  | FunCityVariableNode
  | FunCityApplyNode
  | FunCityLambdaNode
  | FunCityListNode
  | FunCitySetNode
  | FunCityScopeNode;

/**
 * Text block node.
 */
export interface FunCityTextNode {
  /**
   * Node kind.
   */
  readonly kind: 'text';
  /**
   * Text body.
   */
  readonly text: string;
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Conditional branch (`if`) block node contains else block.
 */
export interface FunCityIfNode {
  /**
   * Node kind.
   */
  readonly kind: 'if';
  /**
   * Condition expression node.
   */
  readonly condition: FunCityExpressionNode;
  /**
   * Then (true) block node.
   */
  readonly then: readonly FunCityBlockNode[];
  /**
   * Else (false) block node.
   */
  readonly else: readonly FunCityBlockNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Conditional repeats (`while`) block node contains else block.
 */
export interface FunCityWhileNode {
  /**
   * Node kind.
   */
  readonly kind: 'while';
  /**
   * Condition expression node.
   */
  readonly condition: FunCityExpressionNode;
  /**
   * Repeat block node.
   */
  readonly repeat: readonly FunCityBlockNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Item iteration (`for`) block node contains else block.
 */
export interface FunCityForNode {
  /**
   * Node kind.
   */
  readonly kind: 'for';
  /**
   * Bind variable node in each iteration.
   */
  readonly bind: FunCityVariableNode;
  /**
   * Iteration target expression node.
   */
  readonly iterable: FunCityExpressionNode;
  /**
   * Repeat block node.
   */
  readonly repeat: readonly FunCityBlockNode[];
  /**
   * Node range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The block node.
 */
export type FunCityBlockNode =
  | FunCityExpressionNode
  | FunCityTextNode
  | FunCityIfNode
  | FunCityWhileNode
  | FunCityForNode;

//////////////////////////////////////////////////////////////////////////////

interface ParserCursor {
  /**
   * Peek one token.
   * @returns A token or undefined when reached end of token.
   */
  peekToken: () => FunCityToken | undefined;
  /**
   * Get one token and advance.
   * @returns A token or undefined when reached end of token.
   */
  takeToken: () => FunCityToken | undefined;
  /**
   * Skip one token.
   */
  skipToken: () => void;
}

const parseNumber = (
  cursor: ParserCursor,
  _errors: FunCityErrorInfo[]
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
  _errors: FunCityErrorInfo[]
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
  _errors: FunCityErrorInfo[]
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

const parseLambdaExpression = (
  cursor: ParserCursor,
  errors: FunCityErrorInfo[]
): FunCityLambdaNode | undefined => {
  const funToken = cursor.takeToken() as FunCityIdentityToken;
  const namesPartial = parsePartialExpression(cursor, errors);
  const bodyPartial = namesPartial
    ? parsePartialExpression(cursor, errors)
    : undefined;
  if (!namesPartial || !bodyPartial) {
    const ranges = [funToken.range];
    if (namesPartial) {
      ranges.push(namesPartial.range);
    }
    if (bodyPartial) {
      ranges.push(bodyPartial.range);
    }
    errors.push({
      type: 'error',
      description: 'Required `fun` parameter identity and expression',
      range: widerRange(...ranges),
    });
    return undefined;
  }

  const namesNode = normalizePartialUnitNode(namesPartial, errors);
  if (namesNode.kind !== 'variable' && namesNode.kind !== 'list') {
    errors.push({
      type: 'error',
      description: 'Required `fun` parameter identity',
      range: namesNode.range,
    });
    return undefined;
  }
  const nameNodes = extractParameterArguments(namesNode, errors);
  if (!nameNodes) {
    return undefined;
  }

  const bodyNode = normalizePartialUnitNode(bodyPartial, errors);
  return {
    kind: 'lambda',
    names: nameNodes,
    body: bodyNode,
    range: widerRange(funToken.range, namesNode.range, bodyNode.range),
  };
};

const parsePartialExpression = (
  cursor: ParserCursor,
  errors: FunCityErrorInfo[]
): PartialParsedExpressionNode | undefined => {
  const token = cursor.peekToken()!;
  switch (token.kind) {
    case 'number': {
      const node = parseNumber(cursor, errors);
      return node;
    }
    case 'string': {
      const node = parseString(cursor, errors);
      return node;
    }
    case 'identity': {
      if (token.name === 'fun') {
        const node = parseLambdaExpression(cursor, errors);
        return node;
      }
      const node = parseIdentity(cursor, errors);
      return node;
    }
    case 'open': {
      cursor.skipToken();
      switch (token.symbol) {
        // Parenthesis surrounding expression list `( ... )` (Scope)
        case '(': {
          const innerNodes = parseMultipleApplicationExpressions(
            cursor,
            errors
          );
          const closeToken = cursor.peekToken();
          let range: FunCityRange;
          if (!closeToken) {
            range = widerRange(
              token.range,
              ...innerNodes.map((node) => node.range)
            );
            errors.push({
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
              errors.push({
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
          const itemNodes = parseListExpression(cursor, errors);
          const closeToken = cursor.peekToken();
          let range: FunCityRange;
          if (!closeToken) {
            range = widerRange(
              token.range,
              ...itemNodes.map((node) => node.range)
            );
            errors.push({
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
              errors.push({
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
          errors.push({
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
  errors: FunCityErrorInfo[]
): FunCityExpressionNode => {
  if (node.kind === unitKind) {
    errors.push({
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
  errors: FunCityErrorInfo[]
): FunCityExpressionNode | undefined => {
  // Empty inputs
  if (partialNodes.length === 0) {
    return;
  }
  // Single variable
  if (partialNodes.length === 1) {
    return normalizePartialUnitNode(partialNodes[0]!, errors);
  }
  // Application
  const func = partialNodes[0]!;
  if (func.kind !== 'variable' && func.kind !== 'lambda') {
    errors.push({
      type: 'error',
      description: `Invalid ${func.kind} at this location`,
      range: func.range,
    });
    return undefined;
  }
  const arg0 = partialNodes[1]!;
  if (arg0.kind === unitKind) {
    return {
      kind: 'apply',
      func,
      args: [], // Unit application: `foobar ()`
      range: widerRange(func.range, arg0.range),
    };
  }
  const args = partialNodes
    .slice(1)
    .map((node) => normalizePartialUnitNode(node, errors));
  return {
    kind: 'apply',
    func: func,
    args,
    range: widerRange(func.range, ...args.map((node) => node.range)),
  };
};

const parseMultipleApplicationExpressions = (
  cursor: ParserCursor,
  errors: FunCityErrorInfo[]
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
        const expr = finalizeApplicationException(partialNodes, errors);
        if (expr) {
          expressionList.push(expr);
        }
        partialNodes.length = 0;
        continue;
      }
    }
    const partialNode = parsePartialExpression(cursor, errors);
    if (!partialNode) {
      break;
    }
    partialNodes.push(partialNode);
  }

  const expr = finalizeApplicationException(partialNodes, errors);
  if (expr) {
    expressionList.push(expr);
  }
  return expressionList;
};

const parseListExpression = (
  cursor: ParserCursor,
  errors: FunCityErrorInfo[]
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

    const partialNode = parsePartialExpression(cursor, errors);
    if (!partialNode) {
      break;
    }

    itemNodes.push(normalizePartialUnitNode(partialNode, errors));
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
 * @param errors - Will be stored detected warnings/errors into it
 * @returns Parsed expression node when available
 */
export const parseExpression = (
  cursor: ParserCursor,
  errors: FunCityErrorInfo[]
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
    const partialNode = parsePartialExpression(cursor, errors);
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
  const expr = finalizeApplicationException(partialNodes, errors);
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
  errors: FunCityErrorInfo[]
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

    const partialNode = parsePartialExpression(cursor, errors);
    if (!partialNode) {
      break;
    }

    args.push(normalizePartialUnitNode(partialNode, errors));
  }

  return args;
};

const extractParameterArguments = (
  namesNode: FunCityExpressionNode,
  errors: FunCityErrorInfo[]
): FunCityVariableNode[] | undefined => {
  switch (namesNode.kind) {
    case 'variable': {
      return [namesNode];
    }
    case 'list': {
      const nameNodes: FunCityVariableNode[] = [];
      for (const nameNode of namesNode.items) {
        if (nameNode.kind !== 'variable') {
          errors.push({
            type: 'error',
            description: 'Required lambda parameter identity',
            range: nameNode.range,
          });
        } else {
          nameNodes.push(nameNode);
        }
      }
      return nameNodes;
    }
    default: {
      errors.push({
        type: 'error',
        description: 'Required lambda parameter identity',
        range: namesNode.range,
      });
      return undefined;
    }
  }
};

/**
 * Parse blocks.
 * @param cursor - Parser cursor
 * @param errors - Will be stored detected warnings/errors into it
 * @returns Parsed block nodes
 */
export const parseBlock = (
  cursor: ParserCursor,
  errors: FunCityErrorInfo[]
): FunCityBlockNode[] => {
  // Logical statement state is started at 'root' state.
  // All block node will be aggregated into it.
  const rootState: RootStatementState = {
    kind: 'root',
    startRange: emptyRange,
    branch: createBranchState(),
  };
  const statementStates: LogicalStatementState[] = [rootState];
  let isInExpressionBlock = false;

  while (true) {
    const token = drainEndOfLineAndPeek(cursor);
    if (!token) {
      break;
    }

    switch (token.kind) {
      case 'text': {
        cursor.skipToken();
        if (isInExpressionBlock) {
          errors.push({
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
          if (isInExpressionBlock) {
            errors.push({
              type: 'error',
              description: `Already opened expression block`,
              range: token.range,
            });
          }
          isInExpressionBlock = true;
        } else {
          const node = parseExpression(cursor, errors);
          if (node) {
            pushNode(statementStates, node);
          }
        }
        break;
      }
      case 'close': {
        // Check closing.
        cursor.skipToken();
        if (!isInExpressionBlock) {
          errors.push({
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
          errors.push({
            type: 'error',
            description: `Invalid identity (tokenizer bug?)`,
            range: token.range,
          });
          break;
        }
        switch (token.name) {
          case 'if': {
            cursor.skipToken();
            const args = parseStatementArguments(cursor, errors);
            if (args.length !== 1) {
              errors.push({
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
            const args = parseStatementArguments(cursor, errors);
            if (args.length !== 0) {
              errors.push({
                type: 'error',
                description: 'Could not take any arguments in `else` statement',
                range: widerRange(
                  token.range,
                  ...args.map((node) => node.range)
                ),
              });
            }
            if (statementStates.length <= 1) {
              errors.push({
                type: 'error',
                description: 'Cound not find pair of `if` statement',
                range: token.range,
              });
              break;
            }
            const lastState = statementStates[statementStates.length - 1]!;
            if (lastState.kind !== 'if') {
              errors.push({
                type: 'error',
                description: 'Cound not find pair of `if` statement',
                range: token.range,
              });
              break;
            }
            if (lastState.currentBlock === 'else') {
              errors.push({
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
            const args = parseStatementArguments(cursor, errors);
            if (args.length !== 1) {
              errors.push({
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
            const args = parseStatementArguments(cursor, errors);
            if (args.length !== 2) {
              errors.push({
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
              errors.push({
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
            const args = parseStatementArguments(cursor, errors);
            if (args.length !== 0) {
              errors.push({
                type: 'error',
                description: 'Could not take any arguments in `end` statement',
                range: widerRange(
                  token.range,
                  ...args.map((node) => node.range)
                ),
              });
            }
            if (statementStates.length <= 1) {
              errors.push({
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
          case 'set': {
            // `set foo 123`
            cursor.skipToken();
            const args = parseStatementArguments(cursor, errors);
            if (args.length !== 2) {
              errors.push({
                type: 'error',
                description: 'Required `set` bind identity and expression',
                range: widerRange(
                  token.range,
                  ...args.map((node) => node.range)
                ),
              });
              break;
            }
            const bindNode = args[0]!;
            if (bindNode.kind !== 'variable') {
              errors.push({
                type: 'error',
                description: 'Required `set` bind identity',
                range: bindNode.range,
              });
              break;
            }
            const exprNode = args[1]!;
            pushNode(statementStates, {
              kind: 'set',
              name: bindNode,
              expr: exprNode,
              range: widerRange(token.range, bindNode.range, exprNode.range),
            });
            break;
          }
          default: {
            const node = parseExpression(cursor, errors);
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
          errors.push({
            type: 'error',
            description: `Invalid ${token.kind} (tokenizer bug?)`,
            range: token.range,
          });
          break;
        }
        const node = parseExpression(cursor, errors);
        if (node) {
          pushNode(statementStates, node);
        }
        break;
      }
    }
  }

  flushStatementState(rootState);
  if (statementStates.length !== 1) {
    errors.push({
      type: 'error',
      description: `Could not find statement closing`,
      range: widerRange(...statementStates.map((state) => state.startRange)),
    });
  }
  return rootState.branch.blocks;
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
 * Run the parser.
 * @param tokens - Token list
 * @param errors - Will be stored detected warnings/errors into it
 * @returns Parsed node list
 */
export const runParser = (
  tokens: readonly FunCityToken[],
  errors: FunCityErrorInfo[]
): FunCityBlockNode[] => {
  const cursor = createParserCursor(tokens);

  const blockNodes = parseBlock(cursor, errors);
  return blockNodes;
};
