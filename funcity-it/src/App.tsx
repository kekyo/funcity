// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { useEffect, useState } from 'react';
import type { FunCityLogEntry } from 'funcity';
import { runScriptOnceToText } from 'funcity';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { PaletteMode } from '@mui/material';
import { getInitialScript } from './query';
import { formatException, formatLogEntries } from './logs';
import FuncityCodeMirror from './components/FuncityCodeMirror';
import { candidateVariables } from './editor/funcity-language';
import { version } from './generated/packageMetadata';

type AppProps = {
  mode: PaletteMode;
  onToggleMode: () => void;
};

const App = ({ mode, onToggleMode }: AppProps) => {
  const [script, setScript] = useState(() =>
    getInitialScript(window.location.search)
  );
  const [output, setOutput] = useState('');
  const [logText, setLogText] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const handleRun = async () => {
    const logs: FunCityLogEntry[] = [];
    setIsRunning(true);
    setOutput('');
    setLogText('');

    try {
      const result = await runScriptOnceToText(script, {
        variables: candidateVariables,
        logs,
      });
      if (result !== undefined) {
        setOutput(result);
      }
      const logLines = formatLogEntries(logs);
      if (logLines.length > 0) {
        setLogText(logLines.join('\n'));
      } else {
        setLogText('(Nothing output)');
      }
    } catch (error: unknown) {
      const logLines = formatLogEntries(logs);
      logLines.push(formatException(error));
      setLogText(logLines.join('\n'));
    } finally {
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
              <Box component="span">funcity-it [{version}]</Box>
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
                  className="funcity-cm funcity-cm--editor"
                  value={output}
                  readOnly
                  language="plain"
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
    </Box>
  );
};

export default App;
