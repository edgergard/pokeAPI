// Paseo runs this once when it creates a worktree for an agent (paseo.json → worktree.setup).
// A fresh worktree has no gitignored files, so copy the project folder's local env files into it.
// Put only dev/sandbox keys there: agents run unattended. Missing files are fine (npm run check needs none).
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const source = process.env.PASEO_SOURCE_CHECKOUT_PATH;
const target = process.env.PASEO_WORKTREE_PATH || process.cwd();

if (source) {
  for (const name of ['.env.local', '.env']) {
    const from = join(source, name);
    const to = join(target, name);
    if (existsSync(from) && !existsSync(to)) {
      copyFileSync(from, to);
      console.log(`worktree-setup: copied ${name}`);
    }
  }
}
