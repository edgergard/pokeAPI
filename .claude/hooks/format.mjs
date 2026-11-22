// PostToolUse (Edit|Write): format the edited file with the project's own Prettier, and remember that this
// session touched TypeScript (typecheck-on-stop.mjs only runs when it did).
// Silent and never blocking: no Prettier installed, an ignored file or a parse error leaves the file as it is.
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';

let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const data = JSON.parse(input);
  const file = data?.tool_input?.file_path || data?.tool_response?.filePath;
  const root = process.env.CLAUDE_PROJECT_DIR || data?.cwd || process.cwd();
  const rel = file ? relative(root, file) : '';
  const inProject = rel && !rel.startsWith('..') && !isAbsolute(rel);

  if (inProject && /\.(ts|tsx|mts|cts)$/.test(rel) && data.session_id) {
    const marker = join(tmpdir(), `claude-typecheck-${data.session_id}`);
    if (!existsSync(marker)) writeFileSync(marker, '0');
  }

  const prettier = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  if (inProject && existsSync(prettier)) {
    spawnSync(
      process.execPath,
      [prettier, '--write', '--ignore-unknown', '--log-level', 'silent', rel],
      { cwd: root, timeout: 20000, stdio: 'ignore' },
    );
  }
} catch {
  // never block an edit because of the formatter
}
