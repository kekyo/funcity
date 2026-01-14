// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { readFile } from 'fs/promises';
import readline from 'readline';
import { Command, Option } from 'commander';

import * as packageMetadata from './generated/packageMetadata';
import {
  FunCityBlockNode,
  FunCityFunctionContext,
  FunCityLogEntry,
  FunCityReducerError,
  FunCityReducerContext,
  FunCityWarningEntry,
} from 'funcity';
import {
  buildCandidateVariables,
  convertToString,
  createReducerContext,
  emptyRange,
  fetchVariables,
  outputErrors,
  parseExpressions,
  reduceExpressionNode,
  reduceNode,
  runCodeTokenizer,
  runScriptOnceToText,
} from 'funcity';
import { nodeJsVariables } from 'funcity/node';

//////////////////////////////////////////////////////////////////////////////

const continuationPromptText = '? ';

let replReadlineInterface: readline.Interface | undefined;

const createReplReadline = () => {
  const fallbackReadline = nodeJsVariables.readline as (
    this: FunCityFunctionContext,
    prompt?: unknown
  ) => Promise<string>;

  return async function (this: FunCityFunctionContext, prompt?: unknown) {
    if (!replReadlineInterface) {
      return await fallbackReadline.call(this, prompt);
    }

    const question = prompt === undefined ? '' : this.convertToString(prompt);
    const signal = this.abortSignal;

    if (signal?.aborted) {
      const abortError = new Error('Aborted');
      (abortError as { name?: string }).name = 'AbortError';
      throw abortError;
    }

    return await new Promise<string>((resolve, reject) => {
      const rl = replReadlineInterface!;
      let settled = false;

      const cleanup = () => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const finishResolve = (value: string) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      };

      const finishReject = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };

      const onAbort = () => {
        const abortError = new Error('Aborted');
        (abortError as { name?: string }).name = 'AbortError';
        finishReject(abortError);
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
        rl.question(question, { signal }, (answer) => {
          finishResolve(answer);
        });
      } else {
        rl.question(question, (answer) => {
          finishResolve(answer);
        });
      }
    });
  };
};

const readStream = async (stream: NodeJS.ReadableStream): Promise<string> => {
  return await new Promise((resolve, reject) => {
    let data = '';
    if (typeof stream.setEncoding === 'function') {
      stream.setEncoding('utf8');
    }
    stream.on('data', (chunk) => {
      data += String(chunk);
    });
    stream.on('end', () => {
      resolve(data);
    });
    stream.on('error', (error) => {
      reject(error);
    });
  });
};

const reduceAndCollectResults = async (
  context: FunCityReducerContext,
  nodes: readonly FunCityBlockNode[],
  signal: AbortSignal
): Promise<unknown[]> => {
  const resultList: unknown[] = [];
  for (const node of nodes) {
    const results = await reduceNode(context, node, signal);
    for (const result of results) {
      if (result !== undefined) {
        resultList.push(result);
      }
    }
  }
  return resultList;
};

//////////////////////////////////////////////////////////////////////////////

export interface ReplEvaluationResult {
  readonly output: string | undefined;
  readonly logs: FunCityLogEntry[];
  readonly shouldExit: boolean;
}

export interface ReplSession {
  evaluateLine: (
    line: string,
    signal: AbortSignal
  ) => Promise<ReplEvaluationResult>;
  getPrompt: () => Promise<string>;
}

export const createReplSession = (): ReplSession => {
  const exitSymbol = Symbol('exit');
  const replReadline = createReplReadline();
  const variables = buildCandidateVariables(fetchVariables, nodeJsVariables, {
    prompt: 'funcity> ',
    exit: exitSymbol,
    readline: replReadline,
  });

  const warningLogs: FunCityWarningEntry[] = [];
  const reducerContext = createReducerContext(variables, warningLogs);

  const evaluateLine = async (
    line: string,
    signal: AbortSignal
  ): Promise<ReplEvaluationResult> => {
    // Tokenize and parse step
    const logs: FunCityLogEntry[] = [];
    const tokens = runCodeTokenizer(line, logs);
    const nodes = parseExpressions(tokens, logs);
    if (logs.length >= 1) {
      return {
        output: undefined,
        logs,
        shouldExit: false,
      };
    }

    // Reduce step
    try {
      warningLogs.length = 0;
      const results = await reduceAndCollectResults(
        reducerContext,
        nodes,
        signal
      );
      const shouldExit = results.some((result) => result === exitSymbol);
      const outputResults = results.filter((result) => result !== exitSymbol);
      const output =
        outputResults.length > 0
          ? outputResults.map((result) => convertToString(result)).join('\n')
          : '';
      return {
        output,
        logs: [...warningLogs],
        shouldExit,
      };
    } catch (error: unknown) {
      if (error instanceof FunCityReducerError) {
        const logs: FunCityLogEntry[] = [...warningLogs];
        logs.push(error.info);
        return {
          output: undefined,
          logs,
          shouldExit: false,
        };
      }
      throw error;
    }
  };

  const getPrompt = async () => {
    const prompt = await reduceExpressionNode(reducerContext, {
      kind: 'variable',
      name: 'prompt',
      range: emptyRange,
    });
    return reducerContext.convertToString(prompt);
  };

  return { evaluateLine, getPrompt };
};

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const errorRecord = error as { name?: string; code?: string };
  return errorRecord.name === 'AbortError' || errorRecord.code === 'ABORT_ERR';
};

const runRepl = async (): Promise<void> => {
  console.log(
    `${packageMetadata.name} [${packageMetadata.version}-${packageMetadata.git_commit_hash}]`
  );
  console.log(`Copyright (c) kouji Matsui (@kekyo@mi.kekyo.net)`);
  console.log(`${packageMetadata.repository_url}`);
  console.log(`Type 'exit' to exit CLI`);
  console.log('');

  const session = createReplSession();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: await session.getPrompt(),
  });
  replReadlineInterface = rl;

  let bufferedLine = '';
  let isEvaluating = false;
  let abortController = new AbortController();

  const setPrompt = async (isContinuation: boolean) => {
    rl.setPrompt(
      isContinuation ? continuationPromptText : await session.getPrompt()
    );
  };

  const hasLineContinuation = (line: string): boolean => line.endsWith('\\');

  const evaluateAndPrint = async (line: string, signal: AbortSignal) => {
    try {
      const { output, logs, shouldExit } = await session.evaluateLine(
        line,
        signal
      );
      if (logs.length > 0) {
        outputErrors('<repl>', logs, console);
      }
      if (output) {
        console.log(output);
      }
      return shouldExit;
    } catch (error) {
      if (isAbortError(error)) {
        return false;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      return false;
    }
  };

  await setPrompt(false);
  rl.prompt();

  const handleInterrupt = async () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
    abortController = new AbortController();
    bufferedLine = '';
    process.stdout.write('\nInterrupted\n');
    if (!isEvaluating) {
      await setPrompt(false);
      rl.prompt();
    }
  };

  rl.on('SIGINT', () => {
    void handleInterrupt();
  });

  let shouldExit = false;

  for await (const line of rl) {
    if (bufferedLine) {
      bufferedLine += `\n${line}`;
    } else {
      bufferedLine = line;
    }

    if (hasLineContinuation(line)) {
      await setPrompt(true);
      rl.prompt();
      continue;
    }

    const logicalLine = bufferedLine;
    bufferedLine = '';
    isEvaluating = true;
    try {
      shouldExit = await evaluateAndPrint(logicalLine, abortController.signal);
    } finally {
      isEvaluating = false;
    }
    if (shouldExit) {
      bufferedLine = '';
      break;
    }
    await setPrompt(false);
    rl.prompt();
  }

  if (!shouldExit && bufferedLine) {
    isEvaluating = true;
    try {
      await evaluateAndPrint(bufferedLine, abortController.signal);
    } finally {
      isEvaluating = false;
    }
  }

  rl.close();
  replReadlineInterface = undefined;
};

//////////////////////////////////////////////////////////////////////////////

export const runScriptToText = async (script: string) => {
  const variables = buildCandidateVariables(fetchVariables, nodeJsVariables);
  const logs: FunCityLogEntry[] = [];
  const output = await runScriptOnceToText(script, { variables, logs });
  return { output, logs };
};

const runScript = async (input: string): Promise<void> => {
  const isStdin = input === '-';
  const source = isStdin ? '<stdin>' : input;
  const script = isStdin
    ? await readStream(process.stdin)
    : await readFile(input, 'utf8');

  const { output, logs } = await runScriptToText(script);

  const hasError = outputErrors(source, logs, console);
  if (hasError) {
    process.exitCode = 1;
  }

  if (output) {
    process.stdout.write(output);
  }
};

//////////////////////////////////////////////////////////////////////////////

const findExplicitCommand = (
  args: readonly string[]
): 'repl' | 'run' | undefined => {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--') {
      const next = args[index + 1];
      if (next === 'repl' || next === 'run') {
        return next;
      }
      return undefined;
    }
    if (arg === '-i' || arg === '--input') {
      index += 1;
      continue;
    }
    if (arg.startsWith('--input=')) {
      continue;
    }
    if (arg.startsWith('-')) {
      continue;
    }
    return arg === 'repl' || arg === 'run' ? arg : undefined;
  }
  return undefined;
};

const hasInputOption = (args: readonly string[]): boolean => {
  for (const arg of args) {
    if (arg === '--') {
      break;
    }
    if (arg === '-i' || arg === '--input' || arg.startsWith('--input=')) {
      return true;
    }
  }
  return false;
};

const injectDefaultCommand = (argv: string[]): string[] => {
  const args = argv.slice(2);
  const explicitCommand = findExplicitCommand(args);
  if (explicitCommand) {
    return argv;
  }

  const hasHelp = args.some(
    (arg) =>
      arg === '-h' || arg === '--help' || arg === '-V' || arg === '--version'
  );
  if (hasHelp) {
    return argv;
  }

  const command = hasInputOption(args) ? 'run' : 'repl';
  const [execPath = 'node', scriptPath = 'funcity'] = argv;
  return [execPath, scriptPath, command, ...args];
};

export const runMain = async (argv: string[] = process.argv): Promise<void> => {
  const program = new Command();

  program.name(packageMetadata.name);
  program.summary(packageMetadata.description);
  program.addHelpText(
    'beforeAll',
    `${packageMetadata.name}\n${packageMetadata.description}\n`
  );
  program.version(
    `${packageMetadata.version}-${packageMetadata.git_commit_hash}`
  );
  program.showHelpAfterError(true);

  program
    .command('repl')
    .summary('Start an interactive REPL session')
    .action(async () => {
      await runRepl();
    });

  program
    .command('run')
    .summary('Run a script from a file or stdin')
    .addOption(
      new Option(
        '-i, --input <path>',
        'Input file path or "-" for stdin'
      ).default('-')
    )
    .action(async (options: { input: string }) => {
      await runScript(options.input);
    });

  await program.parseAsync(injectDefaultCommand(argv));
};
