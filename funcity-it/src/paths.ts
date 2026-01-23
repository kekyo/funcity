// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

const normalizeBaseUrl = (baseUrl: string) => {
  if (!baseUrl) {
    return '/';
  }
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

export const resolveBasePath = (
  assetPath: string,
  baseUrl: string = import.meta.env.BASE_URL
) => {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  if (!assetPath) {
    return normalizedBase;
  }
  const normalizedPath = assetPath.startsWith('/')
    ? assetPath.slice(1)
    : assetPath;
  return `${normalizedBase}${normalizedPath}`;
};
