#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_TARGET_DIR = path.join(REPO_ROOT, 'apps');

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  'build',
  '.dart_tool',
  '.venv',
  '__pycache__',
  '.pytest_cache',
  '.git',
  'coverage',
  'checkpoints',
  'models',
  'reports',
  'media',
  'data',
  'android',
  'ios',
  'public',
  'assets',
  'migrations',
  '.gradle',
  'Pods',
  'ephemeral',
  '.symlinks',
  '.plugin_symlinks',
]);

const TEST_DIRS = new Set(['test', 'tests', 'integration_test']);

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.dart',
  '.py',
  '.css',
  '.scss',
]);

const GENERATED_SUFFIXES = [
  '.g.dart',
  '.freezed.dart',
  '.gr.dart',
  '.mocks.dart',
  '.d.ts',
  '.min.js',
  '.min.css',
];

function printHelp() {
  const helpText = `Usage: node scripts/check-file-lines.mjs [options]

Scan source files under apps/ (or --dir) and list files exceeding AGENTS.md line limits.

Options:
  --dir <path>      Target directory to scan (default: apps)
  --limit <number>  Override all threshold rules with a single custom line limit
  --hard-only       Show only files exceeding the hard limit (ERROR)
  --no-tests        Exclude test directories and test files
  --abs             Print absolute file paths instead of workspace-relative paths
  --json            Print structured JSON output
  --fail-on-error   Exit with code 1 if any ERROR violation is found
  -h, --help        Show this help message

Threshold Rules (from .agents/AGENTS.md):
  1. NestJS Controllers (apps/backend/.../*.controller.ts)     : soft 300 / hard 300
  2. NestJS Services    (apps/backend/.../*.service.ts)        : soft 600 / hard 800
  3. Next.js Pages/UI   (apps/web-frontend/src/**/*.tsx|.jsx)  : soft 500 / hard 800
  4. Config/Seed/Types  (*.types.ts, types.ts, seed*.ts, ...)  : soft 800 / hard 1300
  5. General Source     (all other matched source files)       : soft 800 / hard 1000
`;
  process.stdout.write(helpText);
}

function parseArgs(argv) {
  const options = {
    dir: DEFAULT_TARGET_DIR,
    limit: null,
    hardOnly: false,
    noTests: false,
    abs: false,
    json: false,
    failOnError: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '--hard-only') {
      options.hardOnly = true;
    } else if (arg === '--no-tests') {
      options.noTests = true;
    } else if (arg === '--abs') {
      options.abs = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--fail-on-error') {
      options.failOnError = true;
    } else if (arg === '--dir') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --dir');
      }
      options.dir = path.resolve(process.cwd(), value);
      i += 1;
    } else if (arg.startsWith('--dir=')) {
      const value = arg.slice('--dir='.length);
      if (!value) {
        throw new Error('Missing value for --dir');
      }
      options.dir = path.resolve(process.cwd(), value);
    } else if (arg === '--limit') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --limit');
      }
      options.limit = parsePositiveInt(value, '--limit');
      i += 1;
    } else if (arg.startsWith('--limit=')) {
      const value = arg.slice('--limit='.length);
      options.limit = parsePositiveInt(value, '--limit');
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function parsePositiveInt(raw, flagName) {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Invalid positive integer for ${flagName}: ${raw}`);
  }
  return num;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function isTestFile(posixPath) {
  const segments = posixPath.split('/');
  if (segments.some((seg) => TEST_DIRS.has(seg))) {
    return true;
  }
  const baseName = path.posix.basename(posixPath);
  return (
    /\.(spec|test)\.[^.]+$/.test(baseName) ||
    baseName.endsWith('_test.dart') ||
    (baseName.startsWith('test_') && baseName.endsWith('.py'))
  );
}

function isIncludedSourceFile(fileName) {
  const lower = fileName.toLowerCase();
  if (GENERATED_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return false;
  }
  const ext = path.posix.extname(lower);
  return SOURCE_EXTENSIONS.has(ext);
}

function isStaticConfigSeedOrTypes(baseName) {
  const lower = baseName.toLowerCase();
  return (
    lower.endsWith('.types.ts') ||
    lower === 'types.ts' ||
    (lower.startsWith('seed') && lower.endsWith('.ts')) ||
    lower.endsWith('.seed.ts') ||
    /\.config\.[^.]+$/.test(lower) ||
    lower.endsWith('.data.ts') ||
    lower.endsWith('.constants.ts') ||
    lower === 'constants.ts'
  );
}

function resolveThreshold(posixRelPath, customLimit) {
  if (customLimit !== null) {
    return {
      category: 'Custom Limit',
      soft: customLimit,
      hard: customLimit,
    };
  }

  const baseName = path.posix.basename(posixRelPath);

  if (posixRelPath.startsWith('apps/backend/') && baseName.endsWith('.controller.ts')) {
    return {
      category: 'NestJS Controller',
      soft: 300,
      hard: 300,
    };
  }

  if (posixRelPath.startsWith('apps/backend/') && baseName.endsWith('.service.ts')) {
    return {
      category: 'NestJS Service',
      soft: 600,
      hard: 800,
    };
  }

  if (
    posixRelPath.startsWith('apps/web-frontend/src/') &&
    (baseName.endsWith('.tsx') || baseName.endsWith('.jsx'))
  ) {
    return {
      category: 'Next.js Component/Page',
      soft: 500,
      hard: 800,
    };
  }

  if (isStaticConfigSeedOrTypes(baseName)) {
    return {
      category: 'Config/Seed/Types',
      soft: 800,
      hard: 1300,
    };
  }

  return {
    category: 'General',
    soft: 800,
    hard: 1000,
  };
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.length === 0) {
    return 0;
  }
  const trimmedTrailingNewline = content.replace(/\r?\n$/, '');
  return trimmedTrailingNewline.split(/\r?\n/).length;
}

function collectFiles(rootDir, options) {
  const results = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) {
          continue;
        }
        if (options.noTests && TEST_DIRS.has(entry.name)) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        if (!isIncludedSourceFile(entry.name)) {
          continue;
        }
        const relPath = toPosix(path.relative(REPO_ROOT, fullPath));
        if (options.noTests && isTestFile(relPath)) {
          continue;
        }
        results.push({ fullPath, relPath });
      }
    }
  }

  walk(rootDir);
  return results;
}

function getAppBucket(posixRelPath) {
  const match = posixRelPath.match(/^apps\/([^/]+)\//);
  return match ? match[1] : 'other';
}

function formatLimitLabel(rule) {
  if (rule.soft === rule.hard) {
    return `max ${rule.hard} (${rule.category})`;
  }
  return `soft ${rule.soft} / hard ${rule.hard} (${rule.category})`;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  if (!fs.existsSync(options.dir) || !fs.statSync(options.dir).isDirectory()) {
    process.stderr.write(`Error: Target directory not found: ${toPosix(options.dir)}\n`);
    process.exitCode = 1;
    return;
  }

  const files = collectFiles(options.dir, options);
  const violations = [];

  for (const file of files) {
    const lines = countLines(file.fullPath);
    const rule = resolveThreshold(file.relPath, options.limit);

    let severity = null;
    if (lines > rule.hard) {
      severity = 'ERROR';
    } else if (lines > rule.soft) {
      severity = 'WARN';
    }

    if (!severity) {
      continue;
    }

    if (options.hardOnly && severity !== 'ERROR') {
      continue;
    }

    const displayPath = options.abs ? toPosix(file.fullPath) : file.relPath;
    violations.push({
      severity,
      lines,
      softLimit: rule.soft,
      hardLimit: rule.hard,
      category: rule.category,
      app: getAppBucket(file.relPath),
      path: displayPath,
    });
  }

  violations.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'ERROR' ? -1 : 1;
    }
    if (a.lines !== b.lines) {
      return b.lines - a.lines;
    }
    return a.path.localeCompare(b.path);
  });

  const errorCount = violations.filter((v) => v.severity === 'ERROR').length;
  const warnCount = violations.filter((v) => v.severity === 'WARN').length;

  const byApp = {};
  for (const v of violations) {
    if (!byApp[v.app]) {
      byApp[v.app] = { error: 0, warn: 0, total: 0 };
    }
    if (v.severity === 'ERROR') {
      byApp[v.app].error += 1;
    } else {
      byApp[v.app].warn += 1;
    }
    byApp[v.app].total += 1;
  }

  if (options.json) {
    const payload = {
      targetDir: toPosix(options.dir),
      scannedFiles: files.length,
      summary: {
        totalViolations: violations.length,
        errors: errorCount,
        warnings: warnCount,
        byApp,
      },
      violations,
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    const targetDisplay = toPosix(path.relative(REPO_ROOT, options.dir) || '.');
    process.stdout.write(`Scanning: ${targetDisplay} (${files.length} source files)\n\n`);

    if (violations.length === 0) {
      process.stdout.write('No files exceed the configured line limits.\n');
    } else {
      const maxLinesWidth = Math.max(
        ...violations.map((v) => `${v.lines.toLocaleString('en-US')} lines`.length),
      );
      const maxRuleWidth = Math.max(
        ...violations.map((v) =>
          formatLimitLabel({
            category: v.category,
            soft: v.softLimit,
            hard: v.hardLimit,
          }).length,
        ),
      );

      for (const v of violations) {
        const tag = v.severity === 'ERROR' ? '[ERROR]' : '[WARN ]';
        const linesText = `${v.lines.toLocaleString('en-US')} lines`.padStart(maxLinesWidth);
        const ruleText = formatLimitLabel({
          category: v.category,
          soft: v.softLimit,
          hard: v.hardLimit,
        }).padEnd(maxRuleWidth);
        process.stdout.write(`${tag}  ${linesText}  ${ruleText}  ${v.path}\n`);
      }

      process.stdout.write('\nSummary:\n');
      process.stdout.write(`  Scanned files : ${files.length}\n`);
      process.stdout.write(`  Hard exceeded : ${errorCount} (ERROR)\n`);
      process.stdout.write(`  Soft exceeded : ${warnCount} (WARN)\n`);
      process.stdout.write('  By app        :\n');
      for (const appName of ['backend', 'ml', 'mobile', 'web-frontend', 'other']) {
        const stats = byApp[appName];
        if (!stats) {
          continue;
        }
        process.stdout.write(
          `    - ${appName.padEnd(13)} total=${stats.total} (ERROR=${stats.error}, WARN=${stats.warn})\n`,
        );
      }
    }
  }

  if (options.failOnError && errorCount > 0) {
    process.exitCode = 1;
  }
}

main();
