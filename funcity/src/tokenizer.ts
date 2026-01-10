// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import type {
  FunCityErrorInfo,
  FunCityLocation,
  FunCityRange,
} from './scripting';

//////////////////////////////////////////////////////////////////////////////

/**
 * The string token.
 */
export interface FunCityStringToken {
  /**
   * Token kind.
   */
  readonly kind: 'string';
  /**
   * String value.
   */
  readonly value: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The number (numeric) token.
 */
export interface FunCityNumberToken {
  /**
   * Token kind.
   */
  readonly kind: 'number';
  /**
   * Numeric value.
   */
  readonly value: number;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The identity (variable name) token.
 */
export interface FunCityIdentityToken {
  /**
   * Token kind.
   */
  readonly kind: 'identity';
  /**
   * Identity.
   */
  readonly name: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Open parenthesis or bracket node.
 */
export interface FunCityOpenToken {
  /**
   * Token kind.
   */
  readonly kind: 'open';
  /**
   * Open symbol.
   */
  readonly symbol: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Close parenthesis or bracket token.
 */
export interface FunCityCloseToken {
  /**
   * Token kind.
   */
  readonly kind: 'close';
  /**
   * Close symbol.
   */
  readonly symbol: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * End of line token.
 */
export interface FunCityEndOfLineToken {
  /**
   * Token kind.
   */
  readonly kind: 'eol';
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * Free form text token.
 */
export interface FunCityTextToken {
  /**
   * Token kind.
   */
  readonly kind: 'text';
  /**
   * Text value.
   */
  readonly text: string;
  /**
   * Token range in source text.
   */
  readonly range: FunCityRange;
}

/**
 * The token.
 */
export type FunCityToken =
  | FunCityStringToken
  | FunCityNumberToken
  | FunCityIdentityToken
  | FunCityOpenToken
  | FunCityCloseToken
  | FunCityEndOfLineToken
  | FunCityTextToken;

//////////////////////////////////////////////////////////////////////////////

type LocationTypes = 'start' | 'end';

/**
 * Text cursor interface.
 */
interface TokenizerCursor {
  /**
   * Is cursor reached end of text?
   * @return True when reached end of text.
   */
  eot: () => boolean;
  /**
   * Get one char.
   * @param index - Relative index of current cursor range (default: 0)
   * @returns A char of range.
   */
  getChar: (index?: number) => string;
  /**
   * Simply skip current range.
   * @param length - Skip with this length.
   */
  skip: (length: number) => void;
  /**
   * Skip while the char.
   * @param ch - Skip char.
   * @returns False when reached end of text.
   */
  skipChars: (ch: string) => boolean;
  /**
   * Skip until the word.
   * @param word - Skip when detecting the word.
   * @returns False when reached end of text.
   */
  skipUntil: (word: string) => boolean;
  /**
   * Asserts the text.
   * @param word - The text.
   * @returns True when the text detected.
   */
  assert: (word: string) => boolean;
  /**
   * Get text and skip.
   * @param length - Text length.
   * @returns Text.
   */
  getRangeAndSkip: (length: number) => string;
  /**
   * Get text until the word.
   * @param word - Get text when detecting the word.
   * @returns Text or undefined when current cursor is already reached end of text.
   */
  getUntil: (word: string) => string | undefined;
  /**
   * Get current location object.
   * @param type - Location type.
   * @returns Location object.
   */
  location: (type: LocationTypes) => FunCityLocation;
}

/**
 * Tokenizer context.
 */
interface TokenizerContext {
  /**
   * Current tokenizer cursor.
   */
  readonly cursor: TokenizerCursor;
  /**
   * Will be stored detected warnings/errors into it
   */
  readonly errors: FunCityErrorInfo[];
}

/**
 * Tokenize the string value.
 * @param context Tokenizer context
 * @returns String token
 */
const stringEscapeMap: Readonly<Record<string, string>> = {
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  '0': '\0',
  "'": "'",
  '\\': '\\',
};

const tokenizeString = (context: TokenizerContext): FunCityStringToken => {
  const start = context.cursor.location('start');

  // Skip open quote
  context.cursor.skip(1);

  let value = '';
  let closed = false;
  while (!context.cursor.eot()) {
    const ch = context.cursor.getChar();
    if (ch === "'") {
      context.cursor.skip(1); // Skip close quote
      closed = true;
      break;
    }
    if (ch === '\\') {
      const escapeStart = context.cursor.location('start');
      context.cursor.skip(1);
      if (context.cursor.eot()) {
        context.errors.push({
          type: 'error',
          description: 'invalid escape sequence: \\\\',
          range: { start: escapeStart, end: context.cursor.location('end') },
        });
        value += '\\';
        break;
      }
      const escape = context.cursor.getChar();
      const mapped = stringEscapeMap[escape];
      if (mapped !== undefined) {
        value += mapped;
        context.cursor.skip(1);
        continue;
      }
      context.cursor.skip(1);
      context.errors.push({
        type: 'error',
        description: `invalid escape sequence: \\${escape}`,
        range: { start: escapeStart, end: context.cursor.location('end') },
      });
      value += `\\${escape}`;
      continue;
    }
    value += ch;
    context.cursor.skip(1);
  }

  if (!closed) {
    const location = context.cursor.location('start');
    context.errors.push({
      type: 'error',
      description: 'string close quote is not found',
      range: { start: location, end: location },
    });
  }

  return {
    kind: 'string',
    value,
    range: { start, end: context.cursor.location('end') },
  };
};

const firstNumericChars = '0123456789-+';
const numericCharsWithDot = '0123456789.';
const numericChars = '0123456789';

/**
 * Tokenize the number (numeric) value.
 * @param context Tokenizer context
 * @returns Number token
 */
const tokenizeNumber = (context: TokenizerContext): FunCityNumberToken => {
  const start = context.cursor.location('start');

  let index = 1;
  while (true) {
    if (context.cursor.eot()) {
      return {
        kind: 'number',
        value: Number(context.cursor.getRangeAndSkip(index)),
        range: { start, end: context.cursor.location('end') },
      };
    }

    const ch = context.cursor.getChar(index);
    if (numericCharsWithDot.indexOf(ch) < 0) {
      if (ch === '.') {
        break;
      }
      return {
        kind: 'number',
        value: Number(context.cursor.getRangeAndSkip(index)),
        range: { start, end: context.cursor.location('end') },
      };
    }
    index++;
  }

  while (true) {
    if (context.cursor.eot()) {
      return {
        kind: 'number',
        value: Number(context.cursor.getRangeAndSkip(index)),
        range: { start, end: context.cursor.location('end') },
      };
    }

    const ch = context.cursor.getChar(index);
    if (numericChars.indexOf(ch) < 0) {
      return {
        kind: 'number',
        value: Number(context.cursor.getRangeAndSkip(index)),
        range: { start, end: context.cursor.location('end') },
      };
    }
    index++;
  }
};

const firstVariableChars =
  '_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const variableChars =
  '_-.?0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Tokenize the identity (variable name).
 * @param context Tokenizer context
 * @returns Identity token
 */
const tokenizeIdentity = (context: TokenizerContext): FunCityIdentityToken => {
  const start = context.cursor.location('start');

  let index = 1;
  let lastCh = '';
  while (true) {
    if (context.cursor.eot()) {
      break;
    }

    const ch = context.cursor.getChar(index);
    if (variableChars.indexOf(ch) < 0) {
      break;
    }
    if (lastCh === '?') {
      index--;
      break;
    }

    lastCh = ch;
    index++;
  }

  return {
    kind: 'identity',
    name: context.cursor.getRangeAndSkip(index),
    range: { start, end: context.cursor.location('end') },
  };
};

/**
 * Tokenize code block.
 * @param context Tokenizer context
 * @returns The token list
 */
const tokenizeCodeBlock = (context: TokenizerContext): FunCityToken[] => {
  const openStart = context.cursor.location('start');

  // Skip open brackets '{{'
  context.cursor.skip(2);

  const tokens: FunCityToken[] = [
    {
      kind: 'open',
      symbol: '{{',
      range: { start: openStart, end: context.cursor.location('end') },
    },
  ];

  let unknownStartLocation: FunCityLocation | undefined;
  const finalizeUnknown = () => {
    if (unknownStartLocation) {
      context.errors.push({
        type: 'warning',
        description: 'unknown words',
        range: {
          start: unknownStartLocation,
          end: context.cursor.location('end'),
        },
      });
      unknownStartLocation = undefined;
    }
  };

  while (!context.cursor.eot()) {
    // Assert close brackets
    if (context.cursor.assert('}}')) {
      finalizeUnknown();
      const location = context.cursor.location('start');
      context.cursor.skip(2);
      tokens.push({
        kind: 'close',
        symbol: '}}',
        range: { start: location, end: context.cursor.location('end') },
      });
      return tokens;
    }

    const ch = context.cursor.getChar();
    if (ch === '\\') {
      const next = context.cursor.getChar(1);
      if (next === '{' || next === '}') {
        context.cursor.skip(2);
        continue;
      }
    }

    // Read string
    if (ch === "'") {
      finalizeUnknown();
      tokens.push(tokenizeString(context));
    }
    // Read number
    else if (firstNumericChars.indexOf(ch) >= 0) {
      finalizeUnknown();
      tokens.push(tokenizeNumber(context));
    }
    // Read open parentesis
    else if (ch === '(') {
      finalizeUnknown();
      const location = context.cursor.location('start');
      tokens.push({
        kind: 'open',
        symbol: '(',
        range: { start: location, end: location },
      });
      context.cursor.skip(1);
    }
    // Read close parentesis
    else if (ch === ')') {
      finalizeUnknown();
      const location = context.cursor.location('start');
      tokens.push({
        kind: 'close',
        symbol: ')',
        range: { start: location, end: location },
      });
      context.cursor.skip(1);
    }
    // Read open bracket
    else if (ch === '[') {
      finalizeUnknown();
      const location = context.cursor.location('start');
      tokens.push({
        kind: 'open',
        symbol: '[',
        range: { start: location, end: location },
      });
      context.cursor.skip(1);
    }
    // Read close bracket
    else if (ch === ']') {
      finalizeUnknown();
      const location = context.cursor.location('start');
      tokens.push({
        kind: 'close',
        symbol: ']',
        range: { start: location, end: location },
      });
      context.cursor.skip(1);
    }
    // Read identity
    else if (firstVariableChars.indexOf(ch) >= 0) {
      finalizeUnknown();
      tokens.push(tokenizeIdentity(context));
    }
    // End of line
    else if (ch === '\n') {
      finalizeUnknown();
      const location = context.cursor.location('start');
      tokens.push({
        kind: 'eol',
        range: { start: location, end: location },
      });
      context.cursor.skip(1);
    }
    // Ignored CR
    else if (ch === '\r') {
      finalizeUnknown();
      context.cursor.skip(1);
    }
    // Ignored space
    else if (ch === ' ') {
      finalizeUnknown();
      context.cursor.skip(1);
    }
    // Unknown
    else if (!unknownStartLocation) {
      unknownStartLocation = context.cursor.location('start');
      context.cursor.skip(1);
    }

    // Skip spaces
    context.cursor.skipChars(' ');
  }

  const causeLocation = context.cursor.location('start');
  context.errors.push({
    type: 'error',
    description: 'required code block closer: `}}`',
    range: { start: causeLocation, end: causeLocation },
  });
  return tokens;
};

//////////////////////////////////////////////////////////////////////////////

/**
 * Create a tonenizer cursor.
 * @param script - Input script text
 * @returns Tonenizer cursor
 */
const createTokenizerCursor = (script: string): TokenizerCursor => {
  let currentIndex = 0;
  let rawLine = 0;
  let rawColumn = 0;
  let lastLine = 0;
  let lastColumn = 0;

  const eot = () => currentIndex >= script.length;

  const getChar = (index?: number) => script[(index ?? 0) + currentIndex]!;

  const skip = (length: number) => {
    let lastch = '\0';
    while (length > 0) {
      lastColumn = rawColumn;
      lastLine = rawLine;
      const ch = script[currentIndex]!;
      if (ch === '\r') {
        rawColumn = 0;
      } else if (ch === '\n' && lastch !== '\r') {
        rawColumn = 0;
        rawLine++;
      } else {
        rawColumn++;
      }
      currentIndex++;
      length--;
      lastch = ch;
    }
  };

  const skipChars = (ch: string) => {
    while (!eot()) {
      if (getChar() !== ch) {
        return true;
      }
      skip(1);
    }
    return false;
  };

  const skipUntil = (word: string) => {
    while (!eot()) {
      const index = script.indexOf(word, currentIndex);
      if (index === currentIndex) {
        skip(word.length);
        return true;
      }
      skip(1);
    }
    return false;
  };

  const assert = (word: string) => {
    if (script.length - currentIndex < word.length) {
      return false;
    }
    if (script.substring(currentIndex, currentIndex + word.length) === word) {
      return true;
    }
    return false;
  };

  const getRangeAndSkip = (length: number) => {
    const result = script.substring(currentIndex, currentIndex + length);
    skip(result.length);
    return result;
  };

  const getUntil = (word: string) => {
    if (currentIndex >= script.length) {
      return undefined;
    }
    const index = script.indexOf(word, currentIndex);
    if (index >= 0) {
      const result = script.substring(currentIndex, index);
      skip(index - currentIndex);
      return result;
    } else {
      const result = script.substring(currentIndex, script.length);
      skip(script.length - currentIndex);
      return result;
    }
  };

  const location = (type: LocationTypes): FunCityLocation =>
    type === 'end'
      ? {
          line: lastLine + 1,
          column: lastColumn + 1,
        }
      : {
          line: rawLine + 1,
          column: rawColumn + 1,
        };

  return {
    eot,
    getChar,
    skip,
    skipChars,
    skipUntil,
    assert,
    getRangeAndSkip,
    getUntil,
    location,
  };
};

//////////////////////////////////////////////////////////////////////////////

/**
 * Run the tokenizer.
 * @param script - Input script text
 * @param errors - Will be stored detected warnings/errors into it
 * @returns The token list
 */
export const runTokenizer = (
  script: string,
  errors: FunCityErrorInfo[]
): FunCityToken[] => {
  const context: TokenizerContext = {
    cursor: createTokenizerCursor(script),
    errors,
  };

  const tokens: FunCityToken[] = [];

  const readTextBlock = () => {
    if (context.cursor.eot()) {
      return undefined;
    }
    let text = '';
    while (!context.cursor.eot()) {
      if (context.cursor.assert('{{')) {
        return text;
      }
      const ch = context.cursor.getChar();
      if (ch === '\\') {
        const next = context.cursor.getChar(1);
        if (next === '{' || next === '}') {
          text += next;
          context.cursor.skip(2);
          continue;
        }
      }
      text += ch;
      context.cursor.skip(1);
    }
    return text;
  };

  while (!context.cursor.eot()) {
    const start = context.cursor.location('start');

    // Fetch text block (before open code block)
    const text = readTextBlock();
    if (text) {
      tokens.push({
        kind: 'text',
        text,
        range: { start, end: context.cursor.location('end') },
      });
    } else {
      tokens.push(...tokenizeCodeBlock(context));
    }
  }

  return tokens;
};
