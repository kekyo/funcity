// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

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

const _fetch = async (input: unknown, init?: unknown) => {
  const fetchFn = getFetch();
  return await fetchFn(input as any, init as any);
};

const _fetchText = async (input: unknown, init?: unknown) => {
  const res = await _fetch(input, init);
  return await res.text();
};

const _fetchJson = async (input: unknown, init?: unknown) => {
  const res = await _fetch(input, init);
  return await res.json();
};

const _fetchBlob = async (input: unknown, init?: unknown) => {
  const res = await _fetch(input, init);
  return await res.blob();
};

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
