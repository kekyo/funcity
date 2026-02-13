// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { StreamLanguage } from '@codemirror/language';
import type { StreamParser } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
  buildCandidateVariables,
  fetchVariables,
  objectVariables,
} from 'funcity';

type FunCityStreamMode =
  | { kind: 'text' }
  | { kind: 'expr'; braceLength: number }
  | { kind: 'string'; quote: string }
  | { kind: 'stringExpr'; quote: string; braceLength: number };

type FunCityStreamState = {
  stack: FunCityStreamMode[];
};

const reservedKeywords = new Set([
  'fun',
  'set',
  'if',
  'else',
  'elseif',
  'while',
  'for',
  'end',
]);
const builtinNames = new Set<string>();
const builtinAtoms = new Set<string>();

export const candidateVariables = buildCandidateVariables(
  objectVariables,
  fetchVariables,
  {
    // Dummy, will be detected highlight entry.
    console,
    readline: async () => '',

    // Inject browser globals.
    // This is a definition for learning purposes.
    // If you don't understand what it achieves, you should not apply it to your project.
    window,
    document,
  }
);

candidateVariables.forEach((value, key) => {
  if (reservedKeywords.has(key)) {
    return;
  }

  if (value === null || value === undefined || typeof value === 'boolean') {
    builtinAtoms.add(key);
    return;
  }

  builtinNames.add(key);
});

export const funcityStreamParser: StreamParser<FunCityStreamState> = {
  tokenTable: {
    interpolation: tags.special(tags.bracket),
  },
  startState() {
    return { stack: [{ kind: 'text' }] };
  },
  token(stream, state) {
    const mode = state.stack[state.stack.length - 1]!;
    const countBraceRun = (ch: string) => {
      let index = stream.pos;
      while (index < stream.string.length && stream.string[index] === ch) {
        index++;
      }
      return index - stream.pos;
    };
    const consumeBraceRun = (length: number) => {
      stream.pos += length;
    };
    const openExpression = (braceLength: number) => {
      state.stack.push({ kind: 'expr', braceLength });
    };
    const openString = (quote: string) => {
      state.stack.push({ kind: 'string', quote });
    };
    const openStringExpression = (quote: string, braceLength: number) => {
      state.stack.push({ kind: 'stringExpr', quote, braceLength });
    };
    const closeMode = () => {
      if (state.stack.length > 1) {
        state.stack.pop();
      }
    };

    if (mode.kind === 'text') {
      const openLength = countBraceRun('{');
      if (openLength >= 2) {
        consumeBraceRun(openLength);
        openExpression(openLength);
        return 'interpolation';
      }

      const nextExpr = stream.string.indexOf('{{', stream.pos);
      if (nextExpr === -1) {
        stream.skipToEnd();
      } else {
        stream.pos = nextExpr;
      }
      return null;
    } else if (mode.kind === 'string') {
      if (stream.peek() === '\\') {
        stream.next();
        if (!stream.eol()) {
          stream.next();
        }
        return 'escape';
      }

      const openLength = countBraceRun('{');
      if (openLength >= 2) {
        consumeBraceRun(openLength);
        openStringExpression(mode.quote, openLength);
        return 'interpolation';
      }
      if (openLength === 1) {
        stream.next();
        return 'string';
      }

      if (stream.peek() === mode.quote) {
        stream.next();
        closeMode();
        return 'string';
      }

      stream.eatWhile((ch) => ch !== mode.quote && ch !== '\\' && ch !== '{');
      return 'string';
    }

    const braceLength = mode.braceLength;
    const closeLength = countBraceRun('}');
    if (closeLength >= braceLength) {
      consumeBraceRun(braceLength);
      closeMode();
      return 'interpolation';
    }

    if (closeLength > 0) {
      stream.next();
      return 'bracket';
    }

    if (stream.eatSpace()) {
      return null;
    }

    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    const next = stream.peek();
    if (next === "'" || next === '"' || next === '`') {
      openString(next);
      stream.next();
      return 'string';
    }

    if (stream.match(/^-?\d+(?:\.\d+)?/)) {
      return 'number';
    }

    if (stream.match(/^[A-Za-z_][\w$]*/)) {
      const word = stream.current();
      if (reservedKeywords.has(word)) {
        return 'keyword';
      }
      if (builtinAtoms.has(word)) {
        return 'atom';
      }
      if (builtinNames.has(word)) {
        return 'builtin';
      }
      return null;
    }

    if (stream.match(/[\[\]{}()]/)) {
      return 'bracket';
    }

    stream.next();
    return null;
  },
};

export const funcityLanguage = StreamLanguage.define(funcityStreamParser);
