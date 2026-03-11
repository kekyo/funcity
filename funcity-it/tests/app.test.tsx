// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import App from '../src/App';
import { createAppTheme } from '../src/theme';

const runScriptOnceToTextMock = vi.hoisted(() => vi.fn());

vi.mock('funcity', async () => {
  const actual = await vi.importActual<typeof import('funcity')>('funcity');
  return {
    ...actual,
    runScriptOnceToText: runScriptOnceToTextMock,
  };
});

const defaultSampleText = `---
title: Default Sample
---
{{add 1 2}}`;

const createFetchMock = (text: string) =>
  vi.fn().mockResolvedValue({
    ok: true,
    text: async () => text,
  } as Response);

const renderApp = () =>
  render(
    <ThemeProvider theme={createAppTheme('light')}>
      <App mode="light" onToggleMode={() => {}} />
    </ThemeProvider>
  );

const selectExecutionBackend = async (
  getByRole: ReturnType<typeof renderApp>['getByRole'],
  findByRole: ReturnType<typeof renderApp>['findByRole'],
  optionName: string
) => {
  fireEvent.mouseDown(getByRole('combobox', { name: 'Execution backend' }));
  fireEvent.click(await findByRole('option', { name: optionName }));
};

const toggleAggressiveOptimize = (
  getByRole: ReturnType<typeof renderApp>['getByRole']
) => {
  fireEvent.click(getByRole('checkbox', { name: 'Aggressive optimize' }));
};

describe('funcity-it App', () => {
  beforeEach(() => {
    runScriptOnceToTextMock.mockReset();
    globalThis.fetch = createFetchMock(defaultSampleText) as typeof fetch;
  });

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

  it('aligns app title contents with flex centering', async () => {
    const { getByRole } = renderApp();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    const titleLink = getByRole('link', { name: /funcity Playground/i });

    expect(titleLink).toHaveStyle({ display: 'flex' });
    expect(titleLink).toHaveStyle({ alignItems: 'center' });
  });

  it('shows an execution backend dropdown in the toolbar', async () => {
    const { getByRole } = renderApp();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(getByRole('combobox', { name: 'Execution backend' })).toBeTruthy();
  });

  it('shows an aggressiveOptimize checkbox in the toolbar', async () => {
    const { getByRole } = renderApp();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(getByRole('checkbox', { name: 'Aggressive optimize' })).toBeTruthy();
  });

  it('captures console output into Logs', async () => {
    runScriptOnceToTextMock.mockImplementation(async () => {
      console.log('console output');
      return 'script output';
    });

    const { container, getByRole } = renderApp();

    fireEvent.click(getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(runScriptOnceToTextMock).toHaveBeenCalled();
      const editors = container.querySelectorAll('.funcity-cm');
      const outputEditor = editors[1];
      const logEditor = container.querySelector('.funcity-cm--log');
      const outputText =
        outputEditor?.querySelector('.cm-content')?.textContent ?? '';
      const logText =
        logEditor?.querySelector('.cm-content')?.textContent ?? '';
      expect(outputText).toContain('script output');
      expect(logText).toContain('console output');
    });
  });

  it('passes the selected execution backend to funcity', async () => {
    runScriptOnceToTextMock.mockResolvedValue('script output');

    const { getByRole, findByRole } = renderApp();

    await selectExecutionBackend(getByRole, findByRole, 'Reducer');
    fireEvent.click(getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(runScriptOnceToTextMock).toHaveBeenCalled();
      expect(runScriptOnceToTextMock.mock.calls[0]?.[1]).toMatchObject({
        backend: 'reducer',
      });
    });
  });

  it('passes aggressiveOptimize to funcity when enabled', async () => {
    runScriptOnceToTextMock.mockResolvedValue('script output');

    const { getByRole } = renderApp();

    toggleAggressiveOptimize(getByRole);
    fireEvent.click(getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(runScriptOnceToTextMock).toHaveBeenCalled();
      expect(runScriptOnceToTextMock.mock.calls[0]?.[1]).toMatchObject({
        aggressiveOptimize: true,
      });
    });
  });

  it('disables aggressiveOptimize when reducer backend is selected', async () => {
    const { getByRole, findByRole } = renderApp();

    const checkbox = getByRole('checkbox', { name: 'Aggressive optimize' });
    expect(checkbox).toBeEnabled();

    await selectExecutionBackend(getByRole, findByRole, 'Reducer');

    expect(
      getByRole('checkbox', { name: 'Aggressive optimize' })
    ).toBeDisabled();
  });

  it('adds prefixes and styles for console levels', async () => {
    runScriptOnceToTextMock.mockImplementation(async () => {
      console.info('info output');
      console.warn('warn output');
      console.error('error output');
      console.log('log output');
      return '';
    });

    const { container, getByRole } = renderApp();

    fireEvent.click(getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      const logEditor = container.querySelector('.funcity-cm--log');
      const logText =
        logEditor?.querySelector('.cm-content')?.textContent ?? '';

      expect(logText).toContain('info: info output');
      expect(logText).toContain('warn: warn output');
      expect(logText).toContain('error: error output');
      expect(logText).toContain('log output');
      expect(logText).not.toContain('log:');

      expect(
        logEditor?.querySelectorAll('.cm-line.cm-console-line--info').length
      ).toBeGreaterThan(0);
      expect(
        logEditor?.querySelectorAll('.cm-line.cm-console-line--warn').length
      ).toBeGreaterThan(0);
      expect(
        logEditor?.querySelectorAll('.cm-line.cm-console-line--error').length
      ).toBeGreaterThan(0);
      expect(
        logEditor?.querySelectorAll('.cm-line.cm-console-line--log').length
      ).toBeGreaterThan(0);
    });
  });

  it('appends elapsed time as the last log line', async () => {
    runScriptOnceToTextMock.mockImplementation(async () => {
      console.log('console output');
      return 'script output';
    });

    const { container, getByRole } = renderApp();

    fireEvent.click(getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      const logEditor = container.querySelector('.funcity-cm--log');
      const logText =
        logEditor?.querySelector('.cm-content')?.textContent ?? '';

      expect(logText).toContain('console output');
      expect(logText).toMatch(
        /Elapsed: [0-9]+(?:\.[0-9]+)? ms \(backend: source\)$/
      );
    });
  });

  it('accepts readline input via dialog', async () => {
    runScriptOnceToTextMock.mockImplementation(async (_script, props) => {
      const readline = props.variables.get('readline') as (
        this: {
          convertToString: (value: unknown) => string;
          abortSignal?: AbortSignal;
        },
        prompt?: unknown
      ) => Promise<string>;
      const context = {
        convertToString: (value: unknown) => String(value),
        abortSignal: undefined,
      };
      const answer = await readline.call(context, 'Your name?');
      return `Hello ${answer}`;
    });

    const { container, getByRole, findByRole } = renderApp();

    fireEvent.click(getByRole('button', { name: 'Run' }));

    const dialog = await findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Your name?')).toBeTruthy();

    const input = within(dialog).getByRole('textbox', { name: 'Input' });
    fireEvent.change(input, { target: { value: 'Alice' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      const editors = container.querySelectorAll('.funcity-cm');
      const outputEditor = editors[1];
      const outputText =
        outputEditor?.querySelector('.cm-content')?.textContent ?? '';
      expect(outputText).toContain('Hello Alice');
    });
  });

  it('aborts running script when Abort is clicked', async () => {
    let capturedSignal: AbortSignal | undefined;

    runScriptOnceToTextMock.mockImplementation(
      async (_script, _props, signal) => {
        capturedSignal = signal;
        return await new Promise<string>((_resolve, reject) => {
          if (!signal) {
            reject(new Error('Missing AbortSignal'));
            return;
          }
          if (signal.aborted) {
            const error = new Error('Aborted');
            (error as { name?: string }).name = 'AbortError';
            reject(error);
            return;
          }
          signal.addEventListener(
            'abort',
            () => {
              const error = new Error('Aborted');
              (error as { name?: string }).name = 'AbortError';
              reject(error);
            },
            { once: true }
          );
        });
      }
    );

    const { getByRole, findByRole } = renderApp();

    fireEvent.click(getByRole('button', { name: 'Run' }));

    const abortButton = await findByRole('button', { name: 'Abort' });
    expect(abortButton).toBeEnabled();

    fireEvent.click(abortButton);

    await waitFor(() => {
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(true);
    });

    await waitFor(() => {
      expect(getByRole('button', { name: 'Run' })).toBeEnabled();
    });
  });

  it('loads sample scripts from the menu and replaces the input', async () => {
    const sampleText = `---
title: Sample Title
---
{{add 10 32}}`;
    const fetchMock = createFetchMock(sampleText);
    globalThis.fetch = fetchMock as typeof fetch;

    const { container, getByRole, findAllByRole } = renderApp();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    fireEvent.click(getByRole('button', { name: 'Samples' }));

    const menuItems = await findAllByRole('menuitem', {
      name: 'Sample Title',
    });
    fireEvent.click(menuItems[0]);

    await waitFor(() => {
      const editors = container.querySelectorAll('.funcity-cm');
      const inputEditor = editors[0];
      const inputText =
        inputEditor?.querySelector('.cm-content')?.textContent ?? '';
      expect(inputText).toContain('{{add 10 32}}');
    });
  });
});
