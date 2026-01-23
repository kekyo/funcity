// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import type { Theme } from '@mui/material/styles';
import { lighten } from '@mui/material/styles';
import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

export const createFuncityEditorTheme = (theme: Theme) =>
  EditorView.theme(
    {
      '&': {
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
      },
      '&.cm-editor': {
        backgroundColor: theme.palette.background.paper,
      },
      '.cm-scroller': {
        fontFamily: 'inherit',
        padding: '12px 0',
        backgroundColor: theme.palette.background.paper,
      },
      '.cm-content': {
        caretColor: theme.palette.text.primary,
      },
      '.cm-gutters': {
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.secondary,
        borderRight: `1px solid ${theme.palette.divider}`,
        fontFamily: 'inherit',
      },
      '.cm-placeholder': {
        color: theme.palette.text.disabled,
      },
      '.cm-line, .cm-gutterElement': {
        lineHeight: '1.6',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 12px 0 8px',
      },
      '.cm-activeLine': {
        backgroundColor: theme.palette.action.hover,
      },
      '.cm-activeLineGutter': {
        backgroundColor: theme.palette.action.hover,
      },
      '.cm-selectionBackground, .cm-focused .cm-selectionBackground': {
        backgroundColor: theme.palette.action.selected,
      },
      '.cm-cursor': {
        borderLeftColor: theme.palette.text.primary,
      },
    },
    { dark: theme.palette.mode === 'dark' }
  );

export const createFuncityHighlightStyle = (theme: Theme) => {
  const isDark = theme.palette.mode === 'dark';
  const pick = (color: { main: string; light?: string }) =>
    isDark ? lighten(color.main, 0.5) : color.main;
  const pickSoft = (color: { main: string; light?: string }) =>
    isDark ? lighten(color.main, 0.4) : color.main;

  return HighlightStyle.define([
    {
      tag: tags.keyword,
      color: pick(theme.palette.secondary),
      fontWeight: '600',
    },
    {
      tag: tags.standard(tags.variableName),
      color: pickSoft(theme.palette.primary),
    },
    {
      tag: tags.atom,
      color: pick(theme.palette.warning),
    },
    {
      tag: tags.string,
      color: pick(theme.palette.success),
    },
    {
      tag: tags.escape,
      color: pick(theme.palette.warning),
    },
    {
      tag: tags.number,
      color: pick(theme.palette.info),
    },
    {
      tag: tags.comment,
      color: isDark
        ? theme.palette.text.secondary
        : theme.palette.text.disabled,
      fontStyle: 'italic',
    },
  ]);
};
