// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

import { readFile } from 'fs/promises';
import { Command, Option } from 'commander';
import readline from 'readline';

import {
  description,
  git_commit_hash,
  name,
  version,
} from './generated/packageMetadata';
import {
  buildCandidateVariables,
  convertToString,
  createReducerContext,
  outputErrors,
  parseExpressions,
  reduceNode,
  runParser,
  runReducer,
  runTokenizer,
  runCodeTokenizer,
  type FunCityBlockNode,
  type FunCityErrorInfo,
  type FunCityReducerContext,
} from 'funcity';

const promptText = 'funcity> ';

const readStdin = async (): Promise<string> => {
  return await new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', (error) => {
      reject(error);
    });
  });
};

const collectResults = async (
  context: FunCityReducerContext,
  nodes: readonly FunCityBlockNode[]
): Promise<unknown[]> => {
  const resultList: unknown[] = [];
  for (const node of nodes) {
    const results = await reduceNode(context, node);
    for (const result of results) {
      if (result !== undefined) {
        resultList.push(result);
      }
    }
  }
  return resultList;
};

const runRepl = async (): Promise<void> => {
  const variables = buildCandidateVariables();
  const errors: FunCityErrorInfo[] = [];
  const context = createReducerContext(variables, errors);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: promptText,
  });

  rl.prompt();

  for await (const line of rl) {
    errors.length = 0;
    let results: unknown[] = [];
    try {
      const tokens = runCodeTokenizer(line, errors);
      const nodes = parseExpressions(tokens, errors);
      results = await collectResults(context, nodes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
    } finally {
      if (errors.length > 0) {
        outputErrors('<repl>', errors);
      }
      if (results.length > 0) {
        console.log(
          results.map((result) => convertToString(result)).join('\n')
        );
      }
    }
    rl.prompt();
  }

  rl.close();
};

const runScript = async (input: string): Promise<void> => {
  const isStdin = input === '-';
  const source = isStdin ? '<stdin>' : input;
  const script = isStdin ? await readStdin() : await readFile(input, 'utf8');

  const errors: FunCityErrorInfo[] = [];
  const variables = buildCandidateVariables();
  const tokens = runTokenizer(script, errors);
  const nodes = runParser(tokens, errors);
  const results = await runReducer(nodes, variables, errors);
  const output = results.map((result) => convertToString(result)).join('');
  const hasError = outputErrors(source, errors);

  if (results.length > 0) {
    process.stdout.write(output);
  }
  if (hasError) {
    process.exitCode = 1;
  }
};

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

const program = new Command();

program.name(name);
program.version(`${version}-${git_commit_hash}`);
program.summary(description);
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

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

program
  .parseAsync(injectDefaultCommand(process.argv))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
