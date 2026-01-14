// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { FunCityFunctionContext } from './types';

//////////////////////////////////////////////////////////////////////////////

type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

const getFetch = (): FetchFunction => {
  const fetchFn = (globalThis as { fetch?: FetchFunction }).fetch;
  if (!fetchFn) {
    throw new Error('fetch is not available in this environment');
  }
  return fetchFn;
};

const combineAbortSignal = (
  init: RequestInit,
  signal: AbortSignal | undefined
) => {
  const _init: RequestInit = init
    ? {
        ...init,
        signal,
      }
    : {
        signal,
      };
  return _init;
};

async function _fetch(
  this: FunCityFunctionContext,
  input: unknown,
  init: unknown
) {
  const _init = combineAbortSignal(init as any, this.abortSignal);
  const fetchFn = getFetch();
  const res = await fetchFn(input as any, _init);
  return res;
}

async function _fetchText(
  this: FunCityFunctionContext,
  input: unknown,
  init: unknown
) {
  const _init = combineAbortSignal(init as any, this.abortSignal);
  const fetchFn = getFetch();
  const res = await fetchFn(input as any, _init);
  return await res.text();
}

async function _fetchJson(
  this: FunCityFunctionContext,
  input: unknown,
  init: unknown
) {
  const _init = combineAbortSignal(init as any, this.abortSignal);
  const fetchFn = getFetch();
  const res = await fetchFn(input as any, _init);
  return await res.json();
}

async function _fetchBlob(
  this: FunCityFunctionContext,
  input: unknown,
  init: unknown
) {
  const _init = combineAbortSignal(init as any, this.abortSignal);
  const fetchFn = getFetch();
  const res = await fetchFn(input as any, _init);
  return await res.blob();
}

//////////////////////////////////////////////////////////////////////////////

/**
 * Built-in fetch API variables and functions.
 */
export const fetchVariables = Object.freeze({
  fetch: _fetch,
  fetchText: _fetchText,
  fetchJson: _fetchJson,
  fetchBlob: _fetchBlob,
} as const);
