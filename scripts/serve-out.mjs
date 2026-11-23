// Serves the static export (out/) like the real hosts: dir → index.html, unknown → 404.html, and the
// GitHub Pages basePath (/trainer-studio) stripped, so `npm run preview` works after a plain `npm run build`.
// `next start` does not work with `output: 'export'`. Usage: npm run preview -- [port] (default 3000).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('out');
const port = Number(process.argv[2] ?? process.env.PORT ?? 3000);
const BASE = '/trainer-studio';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

if (!fs.existsSync(dir)) {
  console.error('out/ not found: run `npm run build` first');
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel === BASE || rel.startsWith(`${BASE}/`)) rel = rel.slice(BASE.length) || '/';
    let file = path.join(dir, rel);
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!rel.endsWith('/')) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        return res.end();
      }
      file = path.join(file, 'index.html');
    }
    let status = 200;
    if (!fs.existsSync(file)) {
      status = 404;
      file = path.join(dir, '404.html');
    }
    res.writeHead(status, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () =>
    console.log(`preview: http://localhost:${port}${BASE}/ (and http://localhost:${port}/)`),
  );
