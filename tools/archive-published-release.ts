// Retrospectively validate and preserve an already-public npm version. This
// command never publishes npm bytes or moves a tag. Run by the manual archive job.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename, join, resolve} from 'node:path';

const version = process.env.ARCHIVE_VERSION ?? '';
assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_REPOSITORY, 'adewale/rayner');
const source = resolve(process.env.ARCHIVE_SOURCE ?? '.');
const run = (command: string, args: string[]) => execFileSync(command, args, {cwd: source, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
const tag = `v${version}`;
const sourceCommit = run('git', ['rev-parse', 'HEAD']).trim();
assert.equal(run('git', ['rev-parse', `${tag}^{commit}`]).trim(), sourceCommit);
assert.equal(run('git', ['status', '--porcelain']).trim(), '');
const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
assert.equal(pkg.name, 'rayner'); assert.equal(pkg.version, version);
const registry = JSON.parse(run('npm', ['view', `rayner@${version}`, 'dist', '--json']));
const directory = join(source, 'out/published-release');
await mkdir(directory, {recursive: true});
const [packed] = JSON.parse(run('npm', ['pack', `rayner@${version}`, '--ignore-scripts', '--json', '--pack-destination', directory]));
assert.equal(basename(packed.filename), packed.filename);
const archive = join(directory, packed.filename);
const integrity = 'sha512-' + createHash('sha512').update(await readFile(archive)).digest('base64');
assert.equal(integrity, registry.integrity, 'retain the original npm bytes');
const output = run(process.execPath, [join(source, 'tools/explain-package-smoke.ts'), '--archive', archive]);
process.stdout.write(output);
assert.equal('sha512-' + createHash('sha512').update(await readFile(archive)).digest('base64'), integrity);
assert.equal(run('git', ['status', '--porcelain']).trim(), '');
const validationLog = join(directory, 'package-validation.log');
await writeFile(validationLog, output);
const manifest = join(directory, 'published-manifest.json');
await writeFile(manifest, JSON.stringify({
  name: 'rayner', version, filename: packed.filename, integrity, registry, tag, taggedSourceCommit: sourceCommit,
  node: process.version, validatedAt: new Date().toISOString(),
  validationTiming: 'Retrospective validation of the public npm archive, after publication; not original publication provenance.',
  validationGates: {package: true, browser: process.env.EXPLAIN_BROWSER === '1', letteringCapture: process.env.EXPLAIN_LETTERING === '1'},
  workflow: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
}, null, 2) + '\n');
assert.equal(process.env.EXPLAIN_BROWSER, '1'); assert.equal(process.env.EXPLAIN_LETTERING, '1');
const notes = join(directory, 'release-notes.md');
await writeFile(notes, `Rayner ${version}: TypeScript models become reader-paced technical explainers. Install with \`npm install --save-dev rayner@${version}\`.\n\nThe archive attached here is the exact public npm tarball, verified against its registry SHA-512. The manifest and log record retrospective installed-package, browser and lettering-capture validation. They do not claim original publishing-workflow provenance. The existing tag and npm bytes are preserved.\n\n[Examples](https://oshineye.dev/projects/rayner) · [Tutorial](https://github.com/adewale/rayner/blob/${tag}/docs/TUTORIAL.md)\n`);
let release: {draft: boolean; assets: unknown[]};
try { release = JSON.parse(run('gh', ['api', `repos/adewale/rayner/releases/tags/${tag}`])); }
catch (error) {
  assert.match(String((error as {stderr?: string}).stderr), /HTTP 404/, 'release lookup must succeed or report a missing release');
  run('gh', ['release', 'create', tag, '--verify-tag', '--draft', '--title', `Rayner ${version}`, '--notes-file', notes]);
  release = {draft: true, assets: []};
}
assert.equal(release.draft, true, 'do not alter an existing public release');
assert.equal(release.assets.length, 0, 'do not overwrite previously retained release evidence');
run('gh', ['release', 'upload', tag, archive, manifest, validationLog]);
run('gh', ['release', 'edit', tag, '--draft=false', '--notes-file', notes, '--title', `Rayner ${version}`]);
console.log(`Preserved and published the release record for ${tag}`);
