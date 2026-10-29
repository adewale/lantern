import assert from 'node:assert/strict';
import test from 'node:test';
import { galleryTile } from '../tools/lib/explain-gallery.ts';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';

test('catalog tiles open the beginning of every lesson without changing curated posters', () => {
  for (const item of EXPLAINERS) {
    const tile = galleryTile({ id: item.id, title: item.id, lang: 'en' });
    assert.match(tile, new RegExp(`href="${item.id}\\.html"`), item.id);
    assert.ok(!tile.includes('?step='), `${item.id}: the poster step ${item.step} must not become the entry step`);
    assert.match(tile, new RegExp(`src="${item.id}\\.png"`), item.id);
  }
  assert.match(galleryTile({ id: 'quotient-familial', title: 'Le quotient familial', lang: 'fr' }, true), /hreflang="fr".*loading="eager".*lang="fr"/);
});
