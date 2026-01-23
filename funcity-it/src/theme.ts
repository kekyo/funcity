// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: '#925e5e',
      },
      secondary: {
        main: '#108710',
      },
      background: {
        default: mode === 'dark' ? '#313131' : '#f9f4f4',
        paper: mode === 'dark' ? '#24292E' : '#ffffff',
      },
    },
    typography: {
      fontFamily: ['"Space Grotesk"', '"Segoe UI"', 'sans-serif'].join(','),
      h6: {
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'none',
      },
    },
    shape: {
      borderRadius: 12,
    },
  });
