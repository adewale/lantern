import { htmlEscape } from '../../explain/trace.ts';

/** Poster frames are curated; opening a tile starts the reader at step one. */
export function galleryTile(item: { id: string; title: string; lang: string }, lead = false): string {
  const href = `${item.id}.html`;
  const lang = item.lang === 'en' ? '' : ` lang="${htmlEscape(item.lang)}"`;
  const hreflang = item.lang === 'en' ? '' : ` hreflang="${htmlEscape(item.lang)}"`;
  return `<li${lead ? ' class="lead"' : ''}><a href="${htmlEscape(href)}"${hreflang}><img src="${htmlEscape(item.id)}.png" width="960" height="540" alt="" loading="${lead ? 'eager' : 'lazy'}"><span${lang}>${htmlEscape(item.title)}</span></a></li>`;
}
