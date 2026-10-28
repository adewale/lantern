import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Inputs shared by page, gallery and review builds. Output and documentation are excluded. */
export async function buildInputs(root: string) {
  const files: string[] = ['package.json', 'LICENSE'];
  const directories = ['src', 'explain', 'integrations', 'app', 'tools', 'vendor'];
  // Installed commands execute compiled JS; checkout commands execute the sources.
  if (import.meta.url.endsWith('.js')) directories.push('dist');
  for (const directory of directories) {
    for (const entry of await readdir(join(root, directory), { recursive: true, withFileTypes: true }))
      if (entry.isFile()) files.push(directory + '/' + join(entry.parentPath, entry.name).slice(join(root, directory).length + 1).replaceAll('\\', '/'));
  }
  // The lockfile and catalog belong to checkouts, not installed authoring packages.
  for (const name of ['package-lock.json', 'scenes/explainers/catalog.ts']) {
    try { await readFile(join(root, name)); files.push(name); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  const inputs = await Promise.all(files.sort().map(async (name) => ({
    file: name,
    sha256: createHash('sha256').update(await readFile(join(root, name))).digest('hex'),
  })));
  return { version: 1, inputs, hash: createHash('sha256').update(JSON.stringify(inputs)).digest('hex') };
}
