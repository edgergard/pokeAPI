// Stop: if this session edited TypeScript (format.mjs leaves a marker), make sure it still compiles before
// Claude finishes. Exit 2 sends the errors back to Claude; after two failed fix rounds it lets the stop through
// so an unattended agent never loops. Skips when nothing was edited or dependencies aren't installed.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_BLOCKS = 2;

let input = '';
for await (const chunk of process.stdin) input += chunk;
let data = {};
try {
  data = JSON.parse(input);
} catch {
  process.exit(0);
}
const root = process.env.CLAUDE_PROJECT_DIR || data.cwd || process.cwd();
const marker = data.session_id ? join(tmpdir(), `claude-typecheck-${data.session_id}`) : null;

if (!marker || !existsSync(marker)) process.exit(0); // no TypeScript edited since the last pass
if (!existsSync(join(root, 'node_modules'))) process.exit(0);

const run = spawnSync('npm run -s typecheck', {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  timeout: 170000,
});
if (run.status === 0 || run.error) {
  rmSync(marker, { force: true }); // pass (or couldn't run): don't check again until the next edit
  process.exit(0);
}

const blocks = Number(readFileSync(marker, 'utf8')) || 0;
if (blocks >= MAX_BLOCKS) {
  rmSync(marker, { force: true });
  process.exit(0); // give up quietly; npm run check and CI still catch it
}
writeFileSync(marker, String(blocks + 1));
const out = `${run.stdout || ''}${run.stderr || ''}`.trim().split('\n');
process.stderr.write(
  `npm run typecheck fails — fix these before finishing:\n${out.slice(-40).join('\n')}\n`,
);
process.exit(2);
