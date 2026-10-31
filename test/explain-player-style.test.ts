import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Browser, Page} from 'playwright-core';
import {collectProject} from '../tools/lib/explain-project.ts';
import {buildExplainer} from '../tools/lib/explain-build.ts';
import {serve} from '../tools/lib/explain-serve.ts';
import {launch} from '../tools/lib/browser.ts';

const enabled = !!process.env.EXPLAIN_BROWSER;
const options = {skip: enabled ? false : 'set EXPLAIN_BROWSER=1 for served player-style checks'};
let folder: string, browser: Browser, server: Awaited<ReturnType<typeof serve>>;
const cases = [
  {id: 'ext4-space', heading: '1 TiB ext4', labels: ['1 GiB', '1 TiB', '20 TiB', '-m 5 (default)', '-m 1', '-m 0']},
  {id: 'send-sync', heading: 'Arc<T> is Send and Sync', labels: ['Arc<T>', 'Mutex<T>', 'Arc<Mutex<T>>', 'i32', 'Cell<i32>', 'Rc<i32>']},
  {id: 'isdigit', heading: 'str.isdigit()', labels: ['٣ Arabic-Indic three', '² superscript two', '½ one half', 'Ⅻ Roman twelve', '三 Chinese three', 'isdecimal()', 'isdigit()', 'isnumeric()']},
];
before(async () => {
  if (!enabled) return;
  folder = await mkdtemp(join(tmpdir(), 'rayner-player-style-'));
  for (const {id} of cases) {
    const project = await collectProject(`scenes/explainers/${id}`, {write: false});
    await buildExplainer(project, join(folder, `${id}.html`));
  }
  server = await serve(folder, 0, 'send-sync.html');
  browser = await launch();
});
after(async () => {
  if (!enabled) return;
  await browser?.close();
  server?.close();
  if (folder) await rm(folder, {recursive: true, force: true});
});
async function settled(page: Page) {
  await page.waitForSelector('[data-ready=true]');
  await page.waitForFunction(() => !document.querySelector('#content.loading') && !document.querySelector('svg.leaving'));
}

test('visible headings and setting values preserve command switches, units and code identifier casing', options, async () => {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'});
  try {
    let checked = 0;
    for (const {id, heading, labels} of cases) {
      await page.goto(`${server.url}/${id}.html`);
      await settled(page);
      assert.ok((await page.locator('h1').innerText()).includes(heading), `${id}: preserve authored heading case`);
      assert.deepEqual(await page.locator('.segments label span').allInnerTexts(), labels, `${id}: preserve authored setting case`);
      checked += labels.length;
    }
    assert.equal(checked, 20, 'six ext4, six Rust and eight Python setting labels');
  } finally { await page.close(); }
});

test('forced colors retain selected-case and current-step markers after focus moves away', options, async () => {
  let states = 0;
  for (const colorScheme of ['light', 'dark'] as const) {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce', forcedColors: 'active', colorScheme});
    try {
      await page.goto(`${server.url}/send-sync.html`);
      await settled(page);
      for (const wrapper of ['arc', 'mutex']) {
        if (wrapper !== 'arc') {
          await page.locator(`.segments label:has(input[value="${wrapper}"])`).click();
          await settled(page);
        }
        await page.locator('.stage').focus();
        const selection = await page.locator('fieldset.case').first().locator('.segments label').evaluateAll(labels => labels.map(label => {
          const style = getComputedStyle(label);
          const text = getComputedStyle(label.querySelector('span')!);
          return {checked: label.querySelector('input')!.checked, outline: style.outlineStyle, width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset), adjusts: text.forcedColorAdjust, textColor: text.color, background: style.backgroundColor};
        }));
        assert.equal(selection.length, 3, 'three wrapper choices');
        assert.equal(selection.filter(label => label.checked).length, 1);
        for (const label of selection) {
          if (label.checked) {
            assert.equal(label.outline, 'solid', 'selected case retains a painted outline without focus');
            assert.ok(label.width >= 2 && label.offset < 0, 'selected outline is at least 2px and painted inside the control');
            assert.equal(label.adjusts, 'none', 'selected text inherits the system-color surface without an automatic text backplate');
            assert.notEqual(label.textColor, label.background, 'selected text contrasts with its system-color background');
          } else assert.ok(label.outline === 'none' || label.width === 0, 'unchecked cases do not have the selection marker');
        }
        await page.locator('.step-bar button').nth(1).click();
        await settled(page);
        await page.locator('.stage').focus();
        const current = await page.locator('.steps [aria-current=step]').evaluate(button => {
          const style = getComputedStyle(button);
          return {outline: style.outlineStyle, width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset)};
        });
        assert.equal(current.outline, 'solid', 'current rail step has a painted outline');
        assert.ok(current.width >= 2 && current.offset < 0);
        const bars = await page.locator('.step-bar button').evaluateAll(buttons => buttons.map(button => {
          const style = getComputedStyle(button, '::before');
          return {current: button.getAttribute('aria-current') === 'step', border: style.borderTopStyle, width: parseFloat(style.borderTopWidth), height: parseFloat(style.height)};
        }));
        assert.equal(bars.filter(bar => bar.current).length, 1);
        const bar = bars.find(bar => bar.current)!;
        assert.equal(bar.border, 'solid', 'current step bar keeps a system-color border');
        assert.ok(bar.width >= 2 && bar.height > bars.find(other => !other.current)!.height, 'current step has a thicker border and taller mark');
        states++;
      }
    } finally { await page.close(); }
  }
  assert.equal(states, 4, 'initial and changed cases retain selected and current markers in both color schemes');
});
