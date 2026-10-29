// Local static host for built explainers. Applies each HTML artifact's generated header recipe.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt',
};
/** Serve `root` on 127.0.0.1 (port 0 picks a free one); `/` redirects to `index`. */
export async function serve(root: string, port: number, index: string): Promise<{ url: string; close(): void }> {
  root = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, 'http://127.0.0.1');
      if (url.pathname === '/') {
        res.writeHead(302, { location: '/' + index });
        res.end();
        return;
      }
      const path = decodeURIComponent(url.pathname);
      const file = resolve(root, '.' + path + (path.endsWith('/') ? 'index.html' : ''));
      if (!file.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
      res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (file.endsWith('.html')) {
        try {
          const headers = JSON.parse(await readFile(file + '.headers.json', 'utf8'));
          for (const [k, v] of Object.entries(headers)) res.setHeader(k, String(v));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      let start = 0,
        end = info.size - 1;
      if (req.headers.range) {
        const match = req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
          res.end();
          return;
        }
        if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
        else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(end, Number(match[2]));
        }
        if (start > end || start >= info.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', end - start + 1);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      createReadStream(file, { start, end })
        .on('error', () => res.destroy())
        .pipe(res);
    } catch (error) {
      res.statusCode = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 400;
      res.end('Not found');
    }
  });
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      done();
    });
  });
  return {
    url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    close: () => server.close(),
  };
}
