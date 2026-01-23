// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { StreamLanguage } from '@codemirror/language';
import type { StreamParser } from '@codemirror/language';
import {
  buildCandidateVariables,
  fetchVariables,
  objectVariables,
} from 'funcity';

type FunCityStreamState = {
  inExpression: boolean;
  inString: boolean;
};

const reservedKeywords = new Set([
  'fun',
  'set',
  'if',
  'else',
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
  startState() {
    return { inExpression: false, inString: false };
  },
  token(stream, state) {
    if (!state.inExpression) {
      if (stream.match('{{')) {
        state.inExpression = true;
        return 'bracket';
      }

      const nextExpr = stream.string.indexOf('{{', stream.pos);
      if (nextExpr === -1) {
        stream.skipToEnd();
      } else {
        stream.pos = nextExpr;
      }
      return null;
    }

    if (state.inString) {
      if (stream.peek() === "'") {
        stream.next();
        state.inString = false;
        return 'string';
      }
      if (stream.peek() === '\\') {
        stream.next();
        if (!stream.eol()) {
          stream.next();
        }
        return 'escape';
      }
      stream.eatWhile((ch) => ch !== "'" && ch !== '\\');
      return 'string';
    }

    if (stream.match('}}')) {
      state.inExpression = false;
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
    if (next === "'") {
      state.inString = true;
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
