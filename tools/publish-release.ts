#!/usr/bin/env node
// Called only by the protected npm-publish job after the reusable CI workflow succeeds.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';
import assert from 'node:assert/strict';

const directory = 'out/release';
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'publish only from GitHub Actions');
assert.equal(process.env.GITHUB_REPOSITORY, 'adewale/rayner');
assert.equal(manifest.name, 'rayner');
assert.equal(process.env.GITHUB_REF, `refs/tags/v${manifest.version}`);
assert.equal(manifest.sourceCommit, process.env.GITHUB_SHA);
assert.equal(manifest.dirty, false, 'release archive must come from a clean checkout');
assert.ok(manifest.gates.package && manifest.gates.browser && manifest.gates.letteringCapture);
assert.ok(['next', 'latest'].includes(process.env.NPM_DIST_TAG ?? ''));
assert.equal(basename(manifest.filename), manifest.filename);
const archive = join(directory, manifest.filename);
assert.equal('sha512-' + createHash('sha512').update(await readFile(archive)).digest('base64'), manifest.integrity);
const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim().split('.').map(Number);
assert.ok(npmVersion[0]! > 11 || npmVersion[0] === 11 && (npmVersion[1]! > 5 || npmVersion[1] === 5 && npmVersion[2]! >= 1), 'trusted publishing requires npm >=11.5.1');
execFileSync('npm', ['publish', archive, '--tag', process.env.NPM_DIST_TAG!], { stdio: 'inherit' });
