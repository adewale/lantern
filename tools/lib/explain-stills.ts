// A page of resting pictures and no engine: each step of each case as the SVG the
// player would come to rest on, its title, line and caption, a stepper, and the same
// transcript and sources as the full page. For an explanation whose pictures carry it
// without motion, this is the whole reader at a fraction of the bytes; the full page
// remains the one with animation, zoom, close-ups and a receipt per case.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SnapshotSink, renderAt } from '../../src/index.ts';
import { chromeFor, caseNameIn, descriptionLang } from '../../app/embed-strings.ts';
import { restingTime, pictureHtml, pictureSummary, htmlEscape, stepWords, wordsHtml } from '../../explain/trace.ts';
import { ROOT, hash, scriptEscape, sceneSlug, baseReceipt, caseValues } from './explain-project.ts';
import { isDial } from '../../explain/index.ts';
import type { Project } from './explain-project.ts';
import { useProjectLettering } from './explain-lettering.ts';
import { transcriptHtml, sourcesHtml, licenceNotices } from './explain-build.ts';

/**
 * Share path data between stills. Text is glyph outlines, and a step's picture repeats most of
 * the step before: the axes, the labels, the scenery. Every `d` that occurs more than once moves
 * to one `<defs>` block and each occurrence becomes a `<use>`, which inherits the paint set on it.
 */
export function sharePaths(svgs: string[]): { defs: string; svgs: string[] } {
  const counts = new Map<string, number>();
  const path = /<path\b([^>]*?)\sd="([^"]+)"([^>]*?)\/>/g;
  for (const svg of svgs) for (const m of svg.matchAll(path)) counts.set(m[2]!, (counts.get(m[2]!) ?? 0) + 1);
  const ids = new Map<string, string>();
  for (const [d, n] of counts) if (n > 1 && d.length > 24) ids.set(d, `p${ids.size.toString(36)}`);
  const shared = svgs.map((svg) =>
    svg.replace(path, (whole, before: string, d: string, after: string) => {
      const id = ids.get(d);
      return id ? `<use href="#${id}"${before}${after}/>` : whole;
    }),
  );
  const defs = ids.size
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${[...ids].map(([d, id]) => `<path id="${id}" d="${d}"/>`).join('')}</defs></svg>`
    : '';
  return { defs, svgs: shared };
}

const STILLS_CSS = `
.stills .still{margin:0}
.stills .still+.still{margin-top:32px}
.stills.live .still[hidden]{display:none}
.stills .words{margin:16px 0 0;max-width:68ch}
.stills .words .lede{display:block;margin:0 0 6px}
.stills .words .caption{margin:0}
.stills .steps{margin-top:16px}
.stills .controls{justify-content:space-between}
.stills .case-section[hidden]{display:none}
.stills:not(.live) .controls,.stills:not(.live) .steps{display:none}
`;

/** The reader's script: show one step of one case at a time, with the full page's address scheme. */
const STILLS_JS = `(()=>{const root=document.getElementById('content');root.classList.add('live');
const sections=[...root.querySelectorAll('.case-section')];
const groups=[...root.querySelectorAll('.case input')];
const q=new URLSearchParams(location.search);
let caseKey='',stepName=q.get('step')||'';
function keyOf(values){return new URLSearchParams(values).toString()}
function current(){return sections.find(s=>s.dataset.case===caseKey)||sections[0]}
function stills(){return [...current().querySelectorAll('.still')]}
function settingsFromInputs(){const v={};for(const i of groups)if(i.checked)v[i.name]=i.value;return v}
function show(name,push){const list=stills();let i=list.findIndex(s=>s.dataset.step===name);if(i<0)i=0;
for(const s of sections)s.hidden=s!==current();
list.forEach((s,k)=>{s.hidden=k!==i});stepName=list[i].dataset.step;
const section=current();section.querySelectorAll('.steps button').forEach(b=>b.setAttribute('aria-current',b.dataset.step===stepName?'step':'false'));
section.querySelector('.prev').disabled=i===0;section.querySelector('.next').disabled=i===list.length-1;
const url=new URL(location.href);for(const[k,v]of Object.entries(settingsFromInputs()))url.searchParams.set(k,v);url.searchParams.set('step',stepName);
(push?history.pushState:history.replaceState).call(history,null,'',url)}
function choose(){caseKey=keyOf(settingsFromInputs());show(stepName,true)}
for(const i of groups){if(q.has(i.name))i.checked=i.value===q.get(i.name);i.addEventListener('change',choose)}
if(!groups.some(i=>i.checked)){}
caseKey=keyOf(settingsFromInputs());
for(const s of sections){s.querySelector('.prev').onclick=()=>{const l=stills();const i=l.findIndex(x=>x.dataset.step===stepName);show(l[Math.max(0,i-1)].dataset.step,true)};
s.querySelector('.next').onclick=()=>{const l=stills();const i=l.findIndex(x=>x.dataset.step===stepName);show(l[Math.min(l.length-1,i+1)].dataset.step,true)};
for(const b of s.querySelectorAll('.steps button'))b.onclick=()=>show(b.dataset.step,true)}
document.addEventListener('keydown',e=>{if(['INPUT','BUTTON','A','SUMMARY','SELECT','TEXTAREA'].includes(e.target.tagName)||e.ctrlKey||e.metaKey)return;
if(e.key==='ArrowRight'){current().querySelector('.next').click();e.preventDefault()}if(e.key==='ArrowLeft'){current().querySelector('.prev').click();e.preventDefault()}});
window.addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);for(const i of groups)if(p.has(i.name))i.checked=i.value===p.get(i.name);caseKey=keyOf(settingsFromInputs());show(p.get('step')||'',false)});
show(stepName,false)})();`;

export async function buildStills(project: Project, out: string): Promise<{ out: string; bytes: number; gzipBytes: number; stills: number }> {
  const title = project.Scene.meta?.title ?? sceneSlug(project),
    lang = project.Scene.meta?.lang ?? 'en',
    t = chromeFor(lang);
  await useProjectLettering(project);
  // One still per step of each case: the resting picture, as the player draws it, culled.
  const pictures: string[] = [];
  const index: { caseKey: string; name: string; values: Record<string, string>; steps: { step: string; svg: number; words: ReturnType<typeof stepWords>; after: unknown; before: unknown }[] }[] = [];
  for (const v of project.variants) {
    const shown = caseValues(project.Scene, v.values),
      caseKey = new URLSearchParams(shown).toString();
    const steps = [];
    for (const [i, s] of v.trace.steps.entries()) {
      const sink = new SnapshotSink({ cull: true });
      await renderAt(v.Scene, restingTime(s, v.trace.fps), sink);
      pictures.push(sink.svg);
      steps.push({ step: s.step, svg: pictures.length - 1, words: stepWords(s), after: s.after, before: v.trace.steps[i - 1]?.after });
    }
    index.push({ caseKey, name: caseNameIn(lang, project.Scene, shown), values: shown, steps });
  }
  const { defs, svgs } = sharePaths(pictures);
  const settings = (project.Scene.settings ?? []).filter((s) => !isDial(s));
  const defaults = project.variants[0]!.values;
  const cases = settings
    .map((s) => `<fieldset class="case"><legend>${htmlEscape(s.label)}</legend><div class="segments">${s.options
      .map((o) => `<label><input type="radio" name="${htmlEscape(s.id)}" value="${htmlEscape(o.value)}"${defaults[s.id] === o.value ? ' checked' : ''}><span>${htmlEscape(o.label)}</span></label>`)
      .join('')}</div></fieldset>`)
    .join('');
  const sections = index
    .map(({ caseKey, name, steps }) => {
      const figures = steps
        .map(({ step, svg, words, after, before }, i) => {
          const shows = pictureHtml(after, before),
            summary = pictureSummary(after);
          return `<figure class="still" data-step="${htmlEscape(step)}"><div class="stage" role="img" aria-label="${htmlEscape(`${title}. ${words.title}${words.line ? '. ' + words.line : ''}`)}"${summary ? ` aria-description="${htmlEscape(summary)}"` : ''}>${svgs[svg]}</div><figcaption class="words"><p class="lede"><strong>${i + 1}. ${htmlEscape(words.title)}</strong>${words.line ? `<span>${htmlEscape(words.line)}</span>` : ''}</p><p class="caption">${htmlEscape(words.caption)}</p>${shows ? `<details class="described"><summary>${htmlEscape(t.picture)}</summary><div${descriptionLang(lang)}>${shows}</div></details>` : ''}</figcaption></figure>`;
        })
        .join('');
      const list = steps.map(({ step, words }) => `<li><button type="button" data-step="${htmlEscape(step)}"><span>${htmlEscape(words.title)}</span></button></li>`).join('');
      return `<section class="case-section" data-case="${htmlEscape(caseKey)}">${name ? `<h2>${htmlEscape(name)}</h2>` : ''}<nav class="controls" aria-label="${htmlEscape(t.controls)}"><button type="button" class="button prev">${htmlEscape(t.previous)}</button><button type="button" class="button primary next">${htmlEscape(t.next)}</button></nav>${figures}<ol class="steps" aria-label="${htmlEscape(t.stepList)}">${list}</ol></section>`;
    })
    .join('');
  const css = (await readFile(join(ROOT, 'app/embed.css'), 'utf8')) + STILLS_CSS;
  const transcript = transcriptHtml(project, lang),
    sources = sourcesHtml(project),
    licenses = await licenceNotices(project);
  const js = scriptEscape(STILLS_JS);
  const html = `<!doctype html>\n<html lang="${htmlEscape(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><meta name="generator" content="Rayner stills"><style>${css}</style></head><body><main id="content" class="stills"><header class="head"><h1>${htmlEscape(title)}</h1>${cases}</header>${defs}${sections}<details class="transcript"><summary>${htmlEscape(t.transcript)}</summary>${transcript}${sources ? `<h2>${htmlEscape(t.sources)}</h2><ul>${sources}</ul>` : ''}</details></main><template id="licenses"><pre>${htmlEscape(licenses)}</pre></template><script>${js}</script></body></html>\n`;
  out = resolve(out.replace(/\.html?$/, '') + '.stills.html');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  const bytes = Buffer.byteLength(html),
    gzipBytes = gzipSync(html, { level: 9 }).length;
  await writeFile(out + '.receipt.json', JSON.stringify({ ...baseReceipt(project), title, kind: 'stills', artifactHash: hash(html), stills: pictures.length, bytes, gzipBytes, variants: project.variants.map((v) => ({ settings: v.values, steps: v.trace.steps.length })) }, null, 2) + '\n');
  return { out, bytes, gzipBytes, stills: pictures.length };
}
