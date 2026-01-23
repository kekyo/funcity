// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { render, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import App from '../src/App';
import { createAppTheme } from '../src/theme';

const renderApp = () =>
  render(
    <ThemeProvider theme={createAppTheme('light')}>
      <App mode="light" onToggleMode={() => {}} />
    </ThemeProvider>
  );

describe('funcity-it App', () => {
  it('renders three CodeMirror editors with line numbers', async () => {
    const { container } = renderApp();

    await waitFor(() => {
      expect(container.querySelectorAll('.cm-editor')).toHaveLength(3);
    });

    expect(container.querySelectorAll('.cm-lineNumbers')).toHaveLength(3);
  });

  it('marks output and logs as read-only editors', async () => {
    const { container } = renderApp();

    await waitFor(() => {
      expect(container.querySelectorAll('.cm-content')).toHaveLength(3);
    });

    const readOnlyCount = Array.from(
      container.querySelectorAll('.cm-content')
    ).filter((node) => node.getAttribute('contenteditable') === 'false').length;

    expect(readOnlyCount).toBe(2);
  });

  it('renders editor surfaces without rounded Paper corners', async () => {
    const { container } = renderApp();

    await waitFor(() => {
      expect(container.querySelectorAll('.funcity-cm')).toHaveLength(3);
    });

    const paperNodes = Array.from(container.querySelectorAll('.funcity-cm'))
      .map((node) => node.closest('.MuiPaper-root'))
      .filter((node): node is HTMLElement => node !== null);

    expect(paperNodes).toHaveLength(3);

    const roundedCount = paperNodes.filter((node) =>
      node.classList.contains('MuiPaper-rounded')
    ).length;

    expect(roundedCount).toBe(0);
  });
});
