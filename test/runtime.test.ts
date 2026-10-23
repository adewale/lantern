// The library claims to run anywhere JS runs (Workers, Node, browsers). This
// bundles the library and every scene, then evaluates the bundle in a context
// that has only ECMAScript globals plus TextEncoder, TextDecoder and atob
// (which Workers provide): no setTimeout, no console, no process, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import type { BareResult } from './lib/bare-entry.ts';

test('library + scenes run in a bare ECMAScript context (no Node, no DOM globals)', async () => {
  const r = await build({
    entryPoints: [new URL('./lib/bare-entry.ts', import.meta.url).pathname],
    bundle: true, format: 'iife', globalName: 'bare', platform: 'neutral', target: 'es2022', write: false, logLevel: 'silent',
  });
  const code = r.outputFiles[0]!.text;
  // What the bundle may reference; anything else is a ReferenceError
  const sandbox = { TextEncoder, TextDecoder, atob };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(code + '\nglobalThis.__result = bare.run();', ctx, { filename: 'bare-bundle.js' });
  const out = await (ctx.__result as Promise<Record<string, BareResult>>);
  for (const [name, v] of Object.entries(out)) {
    assert.ok(v.steps >= 3 && v.svgBytes > 1000 && v.text > 100, `${name}: ${JSON.stringify(v)}`);
  }
  assert.ok(Object.keys(out).length >= 8);
  // and the bundle itself never mentions a host global in a way that would run at load
  for (const g of ['process.', 'require(', 'document.', 'window.']) assert.ok(!code.includes(g), `bundle references ${g}`);
});
