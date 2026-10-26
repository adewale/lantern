import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sharePage, clip, shareable } from '../tools/lib/explain-share.ts';
import type { ShareManifest } from '../tools/lib/explain-share.ts';

const manifest: ShareManifest = {
  id: 'token-bucket',
  title: 'A token bucket refills when a request arrives',
  lang: 'en',
  steps: [{ step: 'burst', title: 'Six at once: five 200s, then a 429', caption: 'R1–R5 take "the" five tokens & R6 finds none.', picture: 'The bucket, empty.' }],
};
const meta = (html: string, key: string) =>
  new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)">`).exec(html)?.[1];

test('a share page names the step, previews its picture by absolute URL and sends readers to the player at that step', () => {
  const html = sharePage(manifest, manifest.steps[0]!, 'https://example.org/', '/projects/rayner/');
  assert.equal(meta(html, 'og:image'), 'https://example.org/projects/rayner/token-bucket/burst.png');
  assert.equal(meta(html, 'og:url'), 'https://example.org/projects/rayner/token-bucket/burst');
  assert.equal(meta(html, 'og:title'), 'Six at once: five 200s, then a 429 · A token bucket refills when a request arrives');
  // Quotes and ampersands in a caption cannot break out of the attribute.
  assert.equal(meta(html, 'og:description'), 'R1–R5 take &quot;the&quot; five tokens &amp; R6 finds none.');
  assert.equal(meta(html, 'og:image:alt'), 'The bucket, empty.');
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  assert.match(html, /<meta http-equiv="refresh" content="0; url=\/projects\/rayner\/token-bucket\?step=burst">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.org\/projects\/rayner\/token-bucket\?step=burst">/);
  assert.match(html, /<html lang="en">/);
  // Nothing a CSP would have to allow.
  assert.doesNotMatch(html, /<script|<style|style=/);
});

test('a step with no picture description gets no empty alt text', () => {
  const html = sharePage(manifest, { ...manifest.steps[0]!, picture: '' }, 'https://example.org', '/x');
  assert.equal(meta(html, 'og:image:alt'), undefined);
});

test('descriptions are cut at a word, and only path-safe step names get a page', () => {
  assert.equal(clip('short caption'), 'short caption');
  const long = 'word '.repeat(80);
  const cut = clip(long, 50);
  assert.ok(cut.length <= 50 && cut.endsWith('…') && !cut.includes('wor…'), cut);
  assert.ok(shareable('other-rule') && shareable('v22'));
  assert.ok(!shareable('a/b') && !shareable('a b') && !shareable(''));
});
