// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useTheme } from '@mui/material/styles';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting } from '@codemirror/language';
import { funcityLanguage } from '../editor/funcity-language';
import {
  createFuncityEditorTheme,
  createFuncityHighlightStyle,
} from '../editor/funcity-theme';

type FuncityCodeMirrorProps = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  language?: 'funcity' | 'plain';
};

const FuncityCodeMirror = ({
  value,
  onChange,
  readOnly = false,
  placeholder,
  className,
  language = 'funcity',
}: FuncityCodeMirrorProps) => {
  const theme = useTheme();

  const extensions = useMemo(() => {
    const items = [
      syntaxHighlighting(createFuncityHighlightStyle(theme)),
      EditorView.lineWrapping,
    ];

    if (language === 'funcity') {
      items.unshift(funcityLanguage);
    }

    if (readOnly) {
      items.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    }

    items.push(createFuncityEditorTheme(theme));

    return items;
  }, [theme, language, readOnly]);

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

export default FuncityCodeMirror;
