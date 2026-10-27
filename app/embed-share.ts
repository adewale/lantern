// Share pages (tools/lib/explain-share.ts, written by `site:export --origin`): one static page per
// step of the default case, at <path>/<id>/<step>, whose link preview is that step. The exported
// player carries SHARE_META, whose content is <origin><path>/<id>/, so Copy link can give that URL.

/** The meta tag `site:export --origin` adds to a page whose steps have share pages. */
export const SHARE_META = 'rayner:share';

/** Steps whose names are safe as one path segment; others get no share page. */
export const shareable = (step: string) => /^[A-Za-z0-9_-]+$/.test(step);
