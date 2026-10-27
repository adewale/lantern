import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sharePage, publishedPage, checkCards, clip, shareable, pngSize, CARD, CARD_TAGS } from '../tools/lib/explain-share.ts';
import type { ShareManifest } from '../tools/lib/explain-share.ts';
import { cardPng } from '../tools/lib/explain-shots.ts';
import { rasterize } from '../tools/lib/explain-video.ts';
import { Scene, Text, FadeIn } from '../src/index.ts';
import { stage } from '../explain/index.ts';

const manifest: ShareManifest = {
  id: 'token-bucket',
  title: 'A token bucket refills when a request arrives',
  lang: 'en',
  cover: 'burst',
  steps: [{ step: 'burst', title: 'Six at once: five 200s, then a 429', caption: 'R1–R5 take "the" five tokens & R6 finds none.', picture: 'The bucket, empty.' }],
};
const meta = (html: string, key: string) =>
  new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)">`).exec(html)?.[1];

test('a share page names the step, previews its picture by absolute URL and sends readers to the player at that step', () => {
  const html = sharePage(manifest, manifest.steps[0]!, 'https://example.org/', '/projects/rayner/');
  assert.equal(meta(html, 'og:image'), 'https://example.org/projects/rayner/token-bucket/burst.png');
  assert.equal(meta(html, 'twitter:image'), 'https://example.org/projects/rayner/token-bucket/burst.png');
  assert.equal(meta(html, 'og:url'), 'https://example.org/projects/rayner/token-bucket/burst');
  assert.equal(meta(html, 'og:title'), 'Six at once: five 200s, then a 429 · A token bucket refills when a request arrives');
  // X cuts a title at 70 characters; this one is cut at a word first.
  assert.equal(meta(html, 'twitter:title'), 'Six at once: five 200s, then a 429 · A token bucket refills when a…');
  // Quotes and ampersands in a caption cannot break out of the attribute.
  assert.equal(meta(html, 'og:description'), 'R1–R5 take &quot;the&quot; five tokens &amp; R6 finds none.');
  assert.equal(meta(html, 'twitter:description'), meta(html, 'og:description'));
  assert.equal(meta(html, 'og:image:alt'), 'The bucket, empty.');
  assert.equal(meta(html, 'twitter:image:alt'), 'The bucket, empty.');
  assert.equal(meta(html, 'og:image:width'), String(CARD.width));
  assert.equal(meta(html, 'og:image:height'), String(CARD.height));
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  assert.match(html, /<meta http-equiv="refresh" content="0; url=\/projects\/rayner\/token-bucket\?step=burst">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.org\/projects\/rayner\/token-bucket\?step=burst">/);
  assert.match(html, /<html lang="en">/);
  // Nothing a CSP would have to allow.
  assert.doesNotMatch(html, /<script|<style|style=/);
});

test('a step with no picture description is named by its title in the alt text, never left empty', () => {
  const html = sharePage(manifest, { ...manifest.steps[0]!, picture: '' }, 'https://example.org', '/x');
  assert.equal(meta(html, 'og:image:alt'), 'Six at once: five 200s, then a 429');
  assert.equal(meta(html, 'twitter:image:alt'), 'Six at once: five 200s, then a 429');
  // X takes at most 420 characters of alt text.
  const long = sharePage(manifest, { ...manifest.steps[0]!, picture: 'a picture '.repeat(100) }, 'https://example.org', '/x');
  assert.ok(meta(long, 'twitter:image:alt')!.length <= 420);
});

test('descriptions are cut at a word, and only path-safe step names get a page', () => {
  assert.equal(clip('short caption'), 'short caption');
  const long = 'word '.repeat(80);
  const cut = clip(long, 50);
  assert.ok(cut.length <= 50 && cut.endsWith('…') && !cut.includes('wor…'), cut);
  assert.ok(shareable('other-rule') && shareable('v22'));
  assert.ok(!shareable('a/b') && !shareable('a b') && !shareable(''));
});

// A site:export --origin folder in miniature: one explainer page, one share page, one picture.
const folder = await mkdtemp(join(tmpdir(), 'rayner-share-'));
after(() => rm(folder, { recursive: true, force: true }));
const origin = 'https://example.org',
  path = '/projects/rayner',
  dir = join(folder, path);
/** A PNG header of the given size: all checkCards reads. */
function png(width: number, height: number) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(b);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
const page = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>T</title><style>a{}</style></head><body><script>1</script></body></html>\n';
async function exported(edit: { page?: (html: string) => string; share?: (html: string) => string; picture?: Buffer | null } = {}) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, manifest.id), { recursive: true });
  const id = (html: string) => html;
  await writeFile(join(dir, manifest.id + '.html'), (edit.page ?? id)(publishedPage(page, manifest, origin, path)));
  await writeFile(join(dir, manifest.id, 'burst.html'), (edit.share ?? id)(sharePage(manifest, manifest.steps[0]!, origin, path)));
  if (edit.picture !== null) await writeFile(join(dir, manifest.id, 'burst.png'), edit.picture ?? png(CARD.width, CARD.height));
  return (await checkCards(folder, origin, path, [manifest.id])).problems;
}

test('an exported explainer page keeps its page and adds the cover step\'s preview tags, with its own URL and title', async () => {
  const html = publishedPage(page, manifest, origin, path);
  assert.equal(html.replace(/<meta (?:property|name)="[^"]+" content="[^"]*">\n?/g, ''), page);
  assert.equal(meta(html, 'og:url'), 'https://example.org/projects/rayner/token-bucket');
  assert.equal(meta(html, 'twitter:title'), manifest.title);
  assert.equal(meta(html, 'twitter:image'), 'https://example.org/projects/rayner/token-bucket/burst.png');
  // Where its share pages are, for the player's Copy link.
  assert.equal(meta(html, 'rayner:share'), 'https://example.org/projects/rayner/token-bucket/');
  assert.equal(meta(sharePage(manifest, manifest.steps[0]!, origin, path), 'rayner:share'), undefined);
  assert.throws(() => publishedPage(page, { ...manifest, cover: 'gone' }, origin, path), /cover step gone/);
  assert.deepEqual(await exported(), []);
  assert.deepEqual(pngSize(await readFile(join(dir, manifest.id, 'burst.png'))), { width: CARD.width, height: CARD.height });
});

test('checkCards finds a missing tag on either page, a page with no share marker, a non-https or off-site URL, and a missing or mis-sized picture', async () => {
  // This protocol inventory is independent of the implementation's CARD_TAGS.
  const required = ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt',
    'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt'];
  assert.deepEqual([...CARD_TAGS], required);
  for (const key of required) {
    const drop = (html: string) => html.replace(new RegExp(`<meta (?:property|name)="${key}" content="[^"]*">`), '');
    for (const [where, edit] of [['token-bucket/burst.html', { share: drop }], ['token-bucket.html', { page: drop }]] as const) {
      const problems = await exported(edit);
      assert.ok(problems.includes(`${where}: 0 ${key} tags`), `${where} without ${key}: ${problems.join('; ')}`);
      assert.ok(problems.every((p) => p.startsWith(where + ':')), problems.join('; '));
    }
  }
  const unmarked = (html: string) => html.replace(/<meta name="rayner:share" content="[^"]*">/, '');
  assert.deepEqual(await exported({ page: unmarked }), ['token-bucket.html: rayner:share is not https://example.org/projects/rayner/token-bucket/']);
  const http = (html: string) => html.replaceAll('content="https://example.org/', 'content="http://example.org/');
  assert.ok((await exported({ share: http })).some((p) => /og:image http:\/\/example\.org\S+ is not an https URL/.test(p)));
  const elsewhere = (html: string) => html.replaceAll('https://example.org/', 'https://cdn.example.net/');
  assert.ok((await exported({ page: elsewhere })).some((p) => /twitter:image https:\/\/cdn\.example\.net\S+ is not an https URL under/.test(p)));
  assert.deepEqual(await exported({ picture: null }), [
    'token-bucket.html: https://example.org/projects/rayner/token-bucket/burst.png is missing',
    'token-bucket/burst.html: https://example.org/projects/rayner/token-bucket/burst.png is missing',
  ]);
  assert.deepEqual(await exported({ picture: png(960, 540) }), [
    'token-bucket.html: https://example.org/projects/rayner/token-bucket/burst.png is 960 × 540, not the declared 1080 × 540',
    'token-bucket/burst.html: https://example.org/projects/rayner/token-bucket/burst.png is 960 × 540, not the declared 1080 × 540',
  ]);
});

test('a preview picture is the 16:9 still on a 2:1 canvas of the stage\'s paper colour', async () => {
  class Card extends Scene {
    override async construct() {
      stage(this);
      await this.step('one', { caption: 'A word.' });
      await this.play(new FadeIn(new Text('one')));
    }
  }
  const png = await cardPng(Card, 1);
  assert.deepEqual(pngSize(png), { width: CARD.width, height: CARD.height });
  // The bands are the paper's colour, as the still's own edge is: a 2:1 crop shows no seam.
  const { pixels } = await rasterize(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}"><image width="${CARD.width}" height="${CARD.height}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`);
  const at = (x: number, y: number) => [...pixels.subarray((y * CARD.width + x) * 4, (y * CARD.width + x) * 4 + 4)].join(',');
  const inside = (CARD.width - CARD.inner) / 2 + 2;
  assert.equal(at(2, 270), at(inside, 270));
  assert.equal(at(CARD.width - 3, 10), at(CARD.width - inside - 1, 10));
  assert.notEqual(at(2, 270), '26,26,26,255', 'the paper, not the fallback background');
});
