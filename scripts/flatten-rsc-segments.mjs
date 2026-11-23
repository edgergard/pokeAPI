// Next 16's static export writes per-segment RSC prefetch payloads as nested files
// (battle/__next.battle/__PAGE__.txt), but the client router requests them dot-joined
// (battle/__next.battle.__PAGE__.txt). A plain static host has no rewrites, so every
// prefetch 404s and navigation falls back to a slower full fetch. This copies each nested payload to the
// dot-joined name the client asks for. Idempotent; run after `next build`.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'out');
let copied = 0;

function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith('__next.')) copyNested(full, dir, entry.name);
    else if (entry.name !== '_next') visit(full);
  }
}

/** Copies every file under `segmentDir` into `parent` as `<segment>.<sub>.<file>`. */
function copyNested(segmentDir, parent, prefix) {
  for (const entry of fs.readdirSync(segmentDir, { withFileTypes: true })) {
    const full = path.join(segmentDir, entry.name);
    const name = `${prefix}.${entry.name}`;
    if (entry.isDirectory()) copyNested(full, parent, name);
    else {
      fs.copyFileSync(full, path.join(parent, name));
      copied += 1;
    }
  }
}

if (!fs.existsSync(OUT)) {
  console.error(`flatten-rsc-segments: ${OUT} does not exist — run next build first`);
  process.exit(1);
}
visit(OUT);
console.log(`flatten-rsc-segments: wrote ${copied} prefetch payload(s)`);
