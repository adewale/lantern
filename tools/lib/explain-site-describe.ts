// What `site:export` publishes for agents: each explainer's describeExplainer object as <id>.json
// beside its page, and one llms.txt at the site root that lists them (https://llmstxt.org). Lantern's
// Worker served the same facts at /index.json, /trace.json and /text; these are static files.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describeExplainer } from '../../explain/describe.ts';
import type { ExplainerDescription } from '../../explain/describe.ts';
import { collectProject, ROOT } from './explain-project.ts';

export interface SiteItem {
  id: string;
  group: 'topic' | 'toolchain';
}

const TITLE = '# Rayner explainers';
const GROUPS = { topic: 'Explainers', toolchain: 'How these are made' } as const;

/** The explainer as `rayner describe` prints it, drawings included, from its pinned snapshots. */
export async function describeById(id: string): Promise<ExplainerDescription> {
  const project = await collectProject(join(ROOT, 'scenes/explainers', id), { write: false });
  return describeExplainer(project.Scene, { snapshots: project.store });
}

/** The explainer's opening words: the first sentence of the default case's first caption. */
export function summaryOf(d: ExplainerDescription): string {
  const c = d.cases.find((c) => d.settings.every((s) => c.values[s.id] === s.default)) ?? d.cases[0],
    caption = (c?.steps[0]?.caption ?? '').replace(/\s+/g, ' ').trim();
  return /^.+?[.!?](?=\s+\p{Lu}|$)/u.exec(caption)?.[0] ?? caption;
}

const linkText = (text: string) => text.replace(/[[\]\\]/g, '\\$&');

/** llms.txt: an H1, a one-line blockquote, then each explainer's page, opening sentence and JSON, by group. `base` prefixes every link. */
export function llmsTxt(entries: { item: SiteItem; d: ExplainerDescription }[], base: string): string {
  const sections = (Object.keys(GROUPS) as SiteItem['group'][])
    .map((group) => {
      const lines = entries
        .filter((e) => e.item.group === group)
        .map(({ item: { id }, d }) => `- [${linkText(d.title)}](${base}/${id}): ${summaryOf(d)} JSON: [${id}.json](${base}/${id}.json)`);
      return lines.length ? `## ${GROUPS[group]}\n\n${lines.join('\n')}\n` : '';
    })
    .filter(Boolean);
  return [
    TITLE,
    '',
    "> Step-through explainers made with Rayner. Each page has a JSON file beside it, from `describeExplainer`: every case and step, with its title, caption, the state the scene recorded, what the step changed, and the resting picture in words and drawn as text.",
    '',
    'Each item links the page, gives the first sentence of its first caption, and links its JSON.',
    '',
    sections.join('\n'),
  ].join('\n');
}

/**
 * Write <siteRoot><path>/<id>.json for each explainer and <siteRoot>/llms.txt, and return their sizes in
 * bytes. Links are absolute with `origin`, else root-relative. An llms.txt that this did not write is the
 * site's own, so it is left alone and the export fails.
 */
export async function writeDescriptions(
  siteRoot: string,
  path: string,
  items: readonly SiteItem[],
  origin?: string,
): Promise<{ json: number; llms: number }> {
  const llmsFile = join(siteRoot, 'llms.txt'),
    existing = await readFile(llmsFile, 'utf8').catch(() => null);
  if (existing != null && !existing.startsWith(TITLE + '\n'))
    throw new Error(`${llmsFile} is not one site:export wrote; merge the explainers into it by hand or remove it`);
  const entries: { item: SiteItem; d: ExplainerDescription }[] = [];
  let json = 0;
  for (const item of items) {
    const d = await describeById(item.id),
      body = JSON.stringify(d);
    await writeFile(join(siteRoot, path, item.id + '.json'), body);
    json += Buffer.byteLength(body);
    entries.push({ item, d });
  }
  const llms = llmsTxt(entries, (origin ?? '').replace(/\/$/, '') + path);
  await writeFile(llmsFile, llms);
  return { json, llms: Buffer.byteLength(llms) };
}
