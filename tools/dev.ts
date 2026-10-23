// Dev server: serves the source tree as native ES modules (no bundle), and
// reloads the page when src/, app/ or scenes/ change. The player keeps
// ?scene=&step= in the URL, so a reload lands on the step you were watching.
// TypeScript files are served as JavaScript, types stripped per file by
// esbuild's transform; the page's ./main.js is app/main.ts.
//   npm run dev [-- --port 5173]
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { transform } from 'esbuild';

const root = new URL('../', import.meta.url).pathname;
const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || 5173;
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ts': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const RELOAD = `<script type="module">new EventSource('/__reload').onmessage = () => location.reload();</script>`;
const clients = new Set<ServerResponse>();
// What tsc and Node assume: define-semantics class fields, imports kept as written
const TSCONFIG = { compilerOptions: { useDefineForClassFields: true, verbatimModuleSyntax: true } };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  // "/" is the player; every other path is a file in the repo
  const rel = url.pathname === '/' ? 'app/index.html' : decodeURIComponent(url.pathname).slice(1);
  let file = normalize(join(root, rel));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  // A .js that is not there is its .ts source (index.html loads ./main.js)
  if (file.endsWith('.js') && !existsSync(file) && existsSync(file.slice(0, -3) + '.ts')) file = file.slice(0, -3) + '.ts';
  try {
    if ((await stat(file)).isDirectory()) throw new Error('dir');
    let body: Buffer | string = await readFile(file);
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    if (rel === 'app/index.html') {
      // Served from "/", so point the page's relative URLs at app/; the guide's API
      // examples point at the deployed Worker, since this server has no API
      body = body.toString().replace('<head>', '<head>\n<base href="/app/">\n<meta name="lantern:api" content="https://lantern.ivar.workers.dev">').replace('</body>', `${RELOAD}\n</body>`);
    }
    if (file.endsWith('.ts')) {
      // Imports keep their .ts specifiers: the browser requests them, and they come back here
      body = (await transform(body.toString(), { loader: 'ts', format: 'esm', target: 'es2022', sourcemap: 'inline', sourcefile: rel, tsconfigRaw: TSCONFIG })).code;
    }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end(`not found: ${rel}`);
  }
}).listen(port, () => console.log(`dev: http://localhost:${port}/?scene=pyex-limits  (reloads on save)`));

let pending: ReturnType<typeof setTimeout> | undefined;
for (const dir of ['src', 'app', 'scenes']) {
  watch(join(root, dir), { recursive: true }, (_, name) => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      console.log(`changed ${dir}/${name}: reloading ${clients.size} page(s)`);
      for (const c of clients) c.write('data: reload\n\n');
    }, 50);
  });
}
