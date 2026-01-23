// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useTheme } from '@mui/material/styles';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting } from '@codemirror/language';
import { funcityLanguage } from '../editor/funcity-language';
import {
  createFunCityEditorTheme,
  createFunCityHighlightStyle,
} from '../editor/funcity-theme';

type FunCityCodeMirrorProps = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  language?: 'funcity' | 'plain';
  extraExtensions?: Extension[];
};

export const FunCityCodeMirror = ({
  value,
  onChange,
  readOnly = false,
  placeholder,
  className,
  language = 'funcity',
  extraExtensions,
}: FunCityCodeMirrorProps) => {
  const theme = useTheme();

  const extensions = useMemo(() => {
    const items = [
      syntaxHighlighting(createFunCityHighlightStyle(theme)),
      EditorView.lineWrapping,
    ];

    if (language === 'funcity') {
      items.unshift(funcityLanguage);
    }

    if (readOnly) {
      items.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    }

    if (extraExtensions && extraExtensions.length > 0) {
      items.push(...extraExtensions);
    }

    items.push(createFunCityEditorTheme(theme));

    return items;
  }, [theme, language, readOnly, extraExtensions]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      placeholder={placeholder}
      className={className}
      basicSetup={{ lineNumbers: true, highlightActiveLineGutter: true }}
      theme="none"
    />
  );
};
