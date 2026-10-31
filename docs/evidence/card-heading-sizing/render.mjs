// Render the same fixture with a selected checkout's production renderer.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(process.argv[2]);
const out = resolve(process.argv[3]);
const fixture = join(dirname(fileURLToPath(import.meta.url)), 'scene.ts');
const moduleAt = (path) => import(pathToFileURL(join(root, path)).href);
const { collectProject } = await moduleAt('tools/lib/explain-project.ts');
const { stillPng } = await moduleAt('tools/lib/explain-shots.ts');
const { restingTime } = await moduleAt('explain/trace.ts');
const project = await collectProject(fixture, { write: false });
const v = project.variants[0];
const png = await stillPng(v.Scene, restingTime(v.trace.steps[0], v.trace.fps), 1280);
await writeFile(out, png);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
console.log(JSON.stringify({
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  fixtureSha256: hash(await readFile(fixture)),
  imageSha256: hash(png),
  width: 1280,
  node: process.version,
}, null, 2));
