// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FunCityFunctionContext, FunCityLogEntry } from 'funcity';
import { combineVariables, runScriptOnceToText } from 'funcity';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { PaletteMode } from '@mui/material';
import { getInitialScript } from './query';
import { formatException, formatLogEntries } from './logs';
import FuncityCodeMirror from './components/FuncityCodeMirror';
import { candidateVariables } from './editor/funcity-language';
import { consoleOutputExtensions } from './editor/console-output';
import { version } from './generated/packageMetadata';

type AppProps = {
  mode: PaletteMode;
  onToggleMode: () => void;
};

type ReadlineRequest = {
  readonly prompt: string;
  readonly resolve: (value: string) => void;
  readonly reject: (error: Error) => void;
  readonly signal?: AbortSignal;
  abortHandler?: () => void;
};

type ConsoleLevel = 'log' | 'info' | 'warn' | 'error';

type ConsoleEntry = {
  readonly level: ConsoleLevel;
  readonly text: string;
};

const consoleMarkers: Record<ConsoleLevel, string> = {
  log: '[[fc:log]]',
  info: '[[fc:info]]',
  warn: '[[fc:warn]]',
  error: '[[fc:error]]',
};

const consolePrefixes: Record<ConsoleLevel, string> = {
  log: '',
  info: 'info: ',
  warn: 'warn: ',
  error: 'error: ',
};

const App = ({ mode, onToggleMode }: AppProps) => {
  const [script, setScript] = useState(() =>
    getInitialScript(window.location.search)
  );
  const [output, setOutput] = useState('');
  const [logText, setLogText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [readlineOpen, setReadlineOpen] = useState(false);
  const [readlinePrompt, setReadlinePrompt] = useState('');
  const [readlineValue, setReadlineValue] = useState('');
  const readlineQueueRef = useRef<ReadlineRequest[]>([]);
  const activeReadlineRef = useRef<ReadlineRequest | null>(null);
  const outputExtensions = useMemo(() => [consoleOutputExtensions], []);

  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const createAbortError = useCallback(() => {
    const abortError = new Error('Aborted');
    (abortError as { name?: string }).name = 'AbortError';
    return abortError;
  }, []);

  const cleanupReadlineRequest = useCallback((request: ReadlineRequest) => {
    if (request.signal && request.abortHandler) {
      request.signal.removeEventListener('abort', request.abortHandler);
      request.abortHandler = undefined;
    }
  }, []);

  const startNextReadline = useCallback(() => {
    if (activeReadlineRef.current) {
      return;
    }
    const next = readlineQueueRef.current.shift();
    if (!next) {
      return;
    }
    activeReadlineRef.current = next;
    setReadlinePrompt(next.prompt);
    setReadlineValue('');
    setReadlineOpen(true);
  }, []);

  const resolveReadline = useCallback(
    (value: string) => {
      const current = activeReadlineRef.current;
      if (!current) {
        return;
      }
      activeReadlineRef.current = null;
      cleanupReadlineRequest(current);
      setReadlineOpen(false);
      current.resolve(value);
      setTimeout(startNextReadline, 0);
    },
    [cleanupReadlineRequest, startNextReadline]
  );

  const rejectReadline = useCallback(
    (request: ReadlineRequest, error: Error) => {
      cleanupReadlineRequest(request);
      request.reject(error);
    },
    [cleanupReadlineRequest]
  );

  const abortReadline = useCallback(
    (request: ReadlineRequest) => {
      const abortError = createAbortError();
      if (activeReadlineRef.current === request) {
        activeReadlineRef.current = null;
        setReadlineOpen(false);
        rejectReadline(request, abortError);
        setTimeout(startNextReadline, 0);
        return;
      }
      const queue = readlineQueueRef.current;
      const index = queue.indexOf(request);
      if (index >= 0) {
        queue.splice(index, 1);
      }
      rejectReadline(request, abortError);
    },
    [createAbortError, rejectReadline, startNextReadline]
  );

  const readline = useCallback(
    async function (this: FunCityFunctionContext, prompt?: unknown) {
      const question = prompt === undefined ? '' : this.convertToString(prompt);
      const signal = this.abortSignal;

      if (signal?.aborted) {
        throw createAbortError();
      }

      return await new Promise<string>((resolve, reject) => {
        const request: ReadlineRequest = {
          prompt: question,
          resolve,
          reject,
          signal,
        };

        if (signal) {
          const onAbort = () => {
            abortReadline(request);
          };
          request.abortHandler = onAbort;
          signal.addEventListener('abort', onAbort, { once: true });
        }

        readlineQueueRef.current.push(request);
        startNextReadline();
      });
    },
    [abortReadline, createAbortError, startNextReadline]
  );

  const runtimeVariables = useMemo(
    () =>
      combineVariables(candidateVariables, {
        readline,
        console,
      }),
    [readline]
  );

  const formatConsoleValue = useCallback((value: unknown) => {
    if (typeof value === 'string') {
      return value;
    }
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (value === null || value === undefined) {
      return String(value);
    }
    if (value instanceof Error) {
      const detail = value.message ? `: ${value.message}` : '';
      return `${value.name}${detail}`;
    }

    const visited = new WeakSet<object>();
    try {
      return JSON.stringify(value, (_key, val) => {
        if (val && typeof val === 'object') {
          if (visited.has(val)) {
            return '[Circular]';
          }
          visited.add(val);
        }
        return val;
      });
    } catch (_error) {
      return String(value);
    }
  }, []);

  const formatConsoleArgs = useCallback(
    (args: readonly unknown[]) =>
      args.map((arg) => formatConsoleValue(arg)).join(' '),
    [formatConsoleValue]
  );

  const hookConsole = useCallback(
    (onEntry: (entry: ConsoleEntry) => void) => {
      const methods: ConsoleLevel[] = ['log', 'info', 'warn', 'error'];
      const original = new Map<ConsoleLevel, (...args: unknown[]) => void>();

      methods.forEach((method) => {
        original.set(method, console[method].bind(console));
        console[method] = (...args: unknown[]) => {
          onEntry({
            level: method,
            text: formatConsoleArgs(args),
          });
          original.get(method)?.(...args);
        };
      });

      return () => {
        methods.forEach((method) => {
          const origin = original.get(method);
          if (origin) {
            console[method] = origin;
          }
        });
      };
    },
    [formatConsoleArgs]
  );

  const mergeOutput = useCallback(
    (result: string | undefined, entries: ConsoleEntry[]) => {
      const resultText = result ?? '';
      const consoleText = entries
        .map((entry) => {
          const marker = consoleMarkers[entry.level];
          const prefix = consolePrefixes[entry.level];
          return `${marker}${prefix}${entry.text}`;
        })
        .join('\n');
      if (resultText && consoleText) {
        return `${resultText}\n${consoleText}`;
      }
      return resultText || consoleText;
    },
    []
  );

  const handleRun = async () => {
    const logs: FunCityLogEntry[] = [];
    const consoleEntries: ConsoleEntry[] = [];
    setIsRunning(true);
    setOutput('');
    setLogText('');

    let result: string | undefined;
    let caughtError: unknown;
    const restoreConsole = hookConsole((entry) => {
      consoleEntries.push(entry);
    });

    try {
      result = await runScriptOnceToText(
        script,
        {
          variables: runtimeVariables,
          logs,
        },
        new AbortController().signal
      );
    } catch (error: unknown) {
      caughtError = error;
    } finally {
      restoreConsole();
      const logLines = formatLogEntries(logs);
      if (caughtError) {
        logLines.push(formatException(caughtError));
      }
      if (logLines.length > 0) {
        setLogText(logLines.join('\n'));
      } else {
        setLogText('(Nothing output)');
      }
      setOutput(mergeOutput(result, consoleEntries));
      setIsRunning(false);
    }
  };

  return (
    <Box minHeight="100vh">
      <AppBar position="sticky" color="primary">
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{ textTransform: 'none' }}
          >
            <Link
              href="https://github.com/kekyo/funcity/"
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              color="inherit"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
            >
              <Box
                component="img"
                src="/images/funcity.120.png"
                alt="funcity icon"
                sx={{ width: 33, height: 32 }}
              />
              <Box component="span">funcity Play ground [{version}]</Box>
            </Link>
          </Typography>
          <Box flexGrow={1} />
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="contained"
              color="secondary"
              onClick={handleRun}
              disabled={isRunning}
            >
              {isRunning ? 'Running...' : 'Run'}
            </Button>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption">
                {mode === 'dark' ? 'Dark' : 'Light'}
              </Typography>
              <Switch
                checked={mode === 'dark'}
                onChange={onToggleMode}
                slotProps={{
                  input: {
                    'aria-label': 'Toggle theme',
                  },
                }}
              />
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth={false} sx={{ py: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Stack spacing={1.5}>
              <Typography>Input - Type funcity script here</Typography>
              <Paper square>
                <FuncityCodeMirror
                  className="funcity-cm funcity-cm--editor"
                  value={script}
                  onChange={(value) => setScript(value)}
                  placeholder="Type funcity script here"
                />
              </Paper>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Stack spacing={1.5}>
              <Typography>Result</Typography>
              <Paper square variant="outlined">
                <FuncityCodeMirror
                  className="funcity-cm funcity-cm--editor funcity-cm--output"
                  value={output}
                  readOnly
                  language="plain"
                  extraExtensions={outputExtensions}
                />
              </Paper>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Stack spacing={1.5}>
              <Typography>Logs</Typography>
              <Paper square variant="outlined">
                <FuncityCodeMirror
                  className="funcity-cm funcity-cm--log"
                  value={logText}
                  readOnly
                  language="plain"
                />
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
      <Dialog open={readlineOpen} onClose={() => {}} disableEscapeKeyDown>
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            resolveReadline(readlineValue);
          }}
        >
          <DialogTitle>Input</DialogTitle>
          <DialogContent>
            {readlinePrompt && (
              <DialogContentText>{readlinePrompt}</DialogContentText>
            )}
            <TextField
              fullWidth
              margin="dense"
              label="Input"
              value={readlineValue}
              onChange={(event) => setReadlineValue(event.target.value)}
              autoFocus
            />
          </DialogContent>
          <DialogActions>
            <Button type="submit" variant="contained">
              OK
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default App;
