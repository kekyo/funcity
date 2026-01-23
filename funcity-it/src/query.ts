// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { DEFAULT_SCRIPT } from './default-script';

export const extractScriptFromSearch = (search: string): string | undefined => {
  if (!search) {
    return undefined;
  }
  const params = new URLSearchParams(search);
  const script = params.get('script');
  if (!script) {
    return undefined;
  }
  return script;
};

export const getInitialScript = (search: string): string => {
  const script = extractScriptFromSearch(search);
  if (!script || script.trim().length === 0) {
    return DEFAULT_SCRIPT;
  }
  return script;
};
