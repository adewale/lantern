// Share pages: one small static page per step, so a link to a step previews that step.
// Link previews (Open Graph, as chat apps and social sites read them) come from the HTML a
// crawler fetches, and a static host sends the same HTML for every `?step=`; so each step gets
// its own URL, <path>/<id>/<step>, whose page names the step, carries its resting picture and
// sends a reader on to the player at that step (<path>/<id>?step=<step>). No script, no styles.
import { htmlEscape } from '../../explain/trace.ts';

/** A step of an explainer's default case, as the share pages need it. */
export interface ShareStep {
  step: string;
  title: string;
  caption: string;
  /** The resting picture in words: the preview image's alt text. */
  picture: string;
}
/** What `demos:build` writes beside each explainer as `<id>/steps.json`. */
export interface ShareManifest {
  id: string;
  title: string;
  lang: string;
  steps: ShareStep[];
}

/** Steps whose names are safe as one path segment; others get no share page. */
export const shareable = (step: string) => /^[A-Za-z0-9_-]+$/.test(step);

/** At most `max` characters, cut at a word, with an ellipsis when cut. */
export function clip(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2)).replace(/[\s,.;:–—-]+$/, '') + '…';
}

/**
 * The share page for one step. `origin` is the site's origin (https://example.org) and `path`
 * the explainers' folder on it (/projects/rayner): Open Graph needs absolute URLs.
 */
export function sharePage(m: ShareManifest, s: ShareStep, origin: string, path: string): string {
  const base = origin.replace(/\/$/, '') + path.replace(/\/$/, ''),
    url = `${base}/${m.id}/${s.step}`,
    image = `${url}.png`,
    player = `${path.replace(/\/$/, '')}/${m.id}?step=${encodeURIComponent(s.step)}`,
    title = `${s.title} · ${m.title}`,
    description = clip(s.caption),
    a = htmlEscape;
  return `<!doctype html>
<html lang="${a(m.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${a(title)}</title>
<meta name="description" content="${a(description)}">
<link rel="canonical" href="${a(base + '/' + m.id + '?step=' + encodeURIComponent(s.step))}">
<meta property="og:type" content="article">
<meta property="og:title" content="${a(title)}">
<meta property="og:description" content="${a(description)}">
<meta property="og:url" content="${a(url)}">
<meta property="og:image" content="${a(image)}">
<meta property="og:image:width" content="960">
<meta property="og:image:height" content="540">
${s.picture ? `<meta property="og:image:alt" content="${a(clip(s.picture, 420))}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${a(player)}">
</head><body><p><a href="${a(player)}">${a(title)}</a></p></body></html>
`;
}
