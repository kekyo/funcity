// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { RangeSetBuilder, type Extension, Text } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

const consoleMarkerPattern = /^\[\[fc:(log|info|warn|error)\]\]/;

const buildConsoleDecorations = (doc: Text): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>();

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const match = consoleMarkerPattern.exec(line.text);
    if (!match) {
      continue;
    }

    const level = match[1] ?? 'log';
    const markerLength = match[0].length;
    builder.add(
      line.from,
      line.from,
      Decoration.line({
        class: `cm-console-line cm-console-line--${level}`,
      })
    );
    if (markerLength > 0) {
      builder.add(
        line.from,
        line.from + markerLength,
        Decoration.mark({
          class: 'cm-console-marker',
        })
      );
    }
  }

  return builder.finish();
};

class ConsoleOutputPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildConsoleDecorations(view.state.doc);
  }

  update(update: ViewUpdate) {
    if (update.docChanged) {
      this.decorations = buildConsoleDecorations(update.state.doc);
    }
  }
}

export const consoleOutputExtensions: Extension = ViewPlugin.fromClass(
  ConsoleOutputPlugin,
  {
    decorations: (view) => view.decorations,
  }
);
