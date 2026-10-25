import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectProject } from '../tools/lib/explain-project.ts';
import type { Project } from '../tools/lib/explain-project.ts';
import { buildExplainer } from '../tools/lib/explain-build.ts';
import { trackLanguage, videoTranscript } from '../tools/lib/explain-video.ts';
import { chromeFor, caseNameIn, CHROME } from '../app/embed-strings.ts';
import { caseName } from '../explain/index.ts';
import { launch } from '../tools/lib/browser.ts';

// One scene per language: a setting, a card (so each step has a generated description) and a caption.
const scene = (lang: string, label: string, caption: string) =>
  `import{Scene}from'manim-js';import{stage,settingsOf}from'manim-js/explain';export default class L extends Scene{static meta={id:'lang-${lang}',title:'${label}',lang:'${lang}',sources:['https://example.com/source']};static settings=[{id:'n',label:'${label}',default:'1',options:[{value:'1',label:'1'},{value:'2',label:'2'}]}];async construct(){const s=stage(this);await this.step('one',{title:'${label}',caption:'${caption}'});await s.card([['${label}',settingsOf(this).n]]);}}`;
let folder: string;
const built: Record<'fr' | 'en', { project: Project; html: string; file: string }> = {} as never;
before(async () => {
  folder = await mkdtemp(join(tmpdir(), 'lantern-lang-'));
  for (const [lang, label, caption] of [
    ['fr', 'Enfants à charge', 'Un couple déclare son revenu.'],
    ['en', 'Children', 'A couple files a return.'],
  ] as const) {
    const source = join(folder, `${lang}.ts`),
      file = join(folder, `${lang}.html`);
    await writeFile(source, scene(lang, label, caption));
    const project = await collectProject(source);
    built[lang] = { project, html: (await buildExplainer(project, file)).html, file };
  }
});
after(() => rm(folder, { recursive: true, force: true }));

test('an MP4 subtitle stream for meta.lang fr is tagged fra; WebM keeps the BCP 47 tag', () => {
  assert.equal(trackLanguage('fr'), 'fra');
  assert.equal(trackLanguage('fr-CA'), 'fra');
  assert.equal(trackLanguage('en'), 'eng');
  assert.equal(trackLanguage('en-GB'), 'eng');
  assert.equal(trackLanguage('fra'), 'fra');
  assert.equal(trackLanguage('fr', true), 'fr');
  assert.throws(() => trackLanguage('de'), /No ISO 639-2 code for language de/);
});

test('page words come from a table by primary language, English when there is none', () => {
  assert.equal(chromeFor('fr').transcript, 'Transcription');
  assert.equal(chromeFor('fr-BE').next, 'Suivant');
  assert.equal(chromeFor('de'), CHROME.en);
  assert.equal(chromeFor(), CHROME.en);
  // Every language names every piece of chrome.
  for (const [lang, words] of Object.entries(CHROME)) assert.deepEqual(Object.keys(words).sort(), Object.keys(CHROME.en!).sort(), lang);
});

test('French chrome follows French typography: a narrow no-break space before : ; ! ? and inside « »', () => {
  const fr = chromeFor('fr');
  const texts = Object.values(fr).map((v) => (typeof v === 'function' ? (v as (a: string, b: string) => string)('Titre', 'étape') : v));
  for (const text of texts) {
    assert.doesNotMatch(text, /[^ ][:;!?»]/, text);
    assert.doesNotMatch(text, /«[^ ]/, text);
  }
});

test('a case name keeps English punctuation in English and takes French punctuation in French', () => {
  const { Scene } = built.en.project;
  assert.equal(caseNameIn('en', Scene, { n: '2' }), caseName(Scene, { n: '2' }));
  assert.equal(caseNameIn('fr', built.fr.project.Scene, { n: '2' }), 'Enfants à charge : 2');
});

test('a French page has French chrome, and its generated descriptions are marked lang="en"', () => {
  const { html } = built.fr;
  assert.match(html, /^<!doctype html>\n<html lang="fr">/);
  assert.match(html, /<summary>Transcription<\/summary>/);
  assert.match(html, /<h2>Sources<\/h2>/);
  assert.match(html, /<h2>Enfants à charge : 1<\/h2>/);
  // The bundle is minified to ASCII, so only the unaccented start of the message is matched.
  assert.ok(html.includes('Le lecteur interactif n'));
  assert.doesNotMatch(html, /<summary>Transcript<\/summary>/);
  // Each step's description in the transcript is the engine's English, so it is marked.
  const descriptions = [...html.matchAll(/<\/p><div( lang="en")?><ul>/g)];
  assert.equal(descriptions.length, 2); // one step in each of two cases
  assert.ok(descriptions.every((m) => m[1] === ' lang="en"'));
});

test('an English page is unchanged: English chrome and no lang attribute on its descriptions', () => {
  const { html } = built.en;
  assert.match(html, /^<!doctype html>\n<html lang="en">/);
  assert.match(html, /<summary>Transcript<\/summary><section data-case="n=1"><h2>Children: 1<\/h2>/);
  assert.match(html, /<h2>Sources<\/h2>/);
  assert.ok(html.includes('The interactive player could not start. The transcript is available below.'));
  assert.equal([...html.matchAll(/<\/p><div><ul>/g)].length, 2);
  assert.doesNotMatch(html, /<div lang="en">/);
});

test('the video transcript marks the English descriptions on a French page, and only there', () => {
  const steps = built.fr.project.variants[0]!.trace.steps;
  assert.match(videoTranscript('Titre', 'fr', steps), /^<!doctype html><html lang="fr">.*<\/p><div lang="en"><ul>/s);
  const en = videoTranscript('Title', 'en', built.en.project.variants[0]!.trace.steps);
  assert.match(en, /<\/p><ul>/);
  assert.doesNotMatch(en, /lang="en"><ul>|<div/);
});

test(
  'in Chromium, the French player speaks French and its descriptions are marked lang="en"',
  { skip: process.env.EXPLAIN_BROWSER ? false : 'set EXPLAIN_BROWSER=1 for the browser check' },
  async () => {
    const browser = await launch();
    try {
      const page = await browser.newPage();
      const read = async (lang: 'fr' | 'en') => {
        await page.goto(pathToFileURL(built[lang].file).href);
        await page.waitForSelector('[data-ready=true]');
        return page.evaluate(() => ({
          next: document.querySelector('.controls .primary span')?.textContent,
          previous: document.querySelector('.controls button')?.getAttribute('aria-label'),
          disclosure: document.querySelector('.described > summary')?.textContent,
          summaryLang: document.getElementById('picture-summary')?.getAttribute('lang'),
          pictureLang: document.querySelector('.described > div')?.getAttribute('lang'),
          summary: document.getElementById('picture-summary')?.textContent,
          transcript: document.querySelector('.transcript > summary')?.textContent,
        }));
      };
      const fr = await read('fr');
      assert.deepEqual(
        { ...fr, summary: undefined },
        {
          next: 'Suivant',
          previous: 'Étape précédente',
          disclosure: 'Ce que montre l’image',
          summaryLang: 'en',
          pictureLang: 'en',
          summary: undefined,
          transcript: 'Transcription',
        },
      );
      assert.match(fr.summary!, /^1 labelled value\./);
      const en = await read('en');
      assert.deepEqual(
        { ...en, summary: undefined },
        {
          next: 'Next',
          previous: 'Previous step',
          disclosure: 'What the picture shows',
          summaryLang: null,
          pictureLang: null,
          summary: undefined,
          transcript: 'Transcript',
        },
      );
    } finally {
      await browser.close();
    }
  },
);
