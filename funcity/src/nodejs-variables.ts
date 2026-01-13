// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import process from 'process';

//////////////////////////////////////////////////////////////////////////////

/**
 * Built-in Node.js variables and functions.
 */
export const nodeJsVariables = Object.freeze({
  fs: fsPromises,
  path,
  os,
  crypto,
  process,
} as const);
