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
  nodeJsVariables,
  fetchVariables,
  outputErrors,
  parseExpressions,
  reduceExpressionNode,
  reduceNode,
  runCodeTokenizer,
  runScriptOnceToText,
} from 'funcity';

//////////////////////////////////////////////////////////////////////////////

const continuationPromptText = '? ';

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
}

export interface ReplSession {
  evaluateLine: (
    line: string,
    signal: AbortSignal
  ) => Promise<ReplEvaluationResult>;
  getPrompt: () => Promise<string>;
}

export const createReplSession = (): ReplSession => {
  const variables = buildCandidateVariables(fetchVariables, nodeJsVariables, {
    prompt: 'funcity> ',
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
      const output =
        results.length > 0
          ? results.map((result) => convertToString(result)).join('\n')
          : '';
      return {
        output,
        logs: [...warningLogs],
      };
    } catch (error: unknown) {
      if (error instanceof FunCityReducerError) {
        const logs: FunCityLogEntry[] = [...warningLogs];
        logs.push(error.info);
        return {
          output: undefined,
          logs,
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

const runRepl = async (): Promise<void> => {
  const session = createReplSession();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: await session.getPrompt(),
  });

  let bufferedLine = '';

  const setPrompt = async (isContinuation: boolean) => {
    rl.setPrompt(
      isContinuation ? continuationPromptText : await session.getPrompt()
    );
  };

  const hasLineContinuation = (line: string): boolean => line.endsWith('\\');

  const evaluateAndPrint = async (line: string, signal: AbortSignal) => {
    try {
      const { output, logs } = await session.evaluateLine(line, signal);
      if (logs.length > 0) {
        outputErrors('<repl>', logs, console);
      }
      if (output) {
        console.log(output);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
    }
  };

  await setPrompt(false);
  rl.prompt();

  // TODO: interruption control
  const abortController = new AbortController();

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
    await evaluateAndPrint(logicalLine, abortController.signal);
    await setPrompt(false);
    rl.prompt();
  }

  if (bufferedLine) {
    await evaluateAndPrint(bufferedLine, abortController.signal);
  }

  rl.close();
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
