import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectProject } from '../tools/lib/explain-project.ts';
import { buildExplainer } from '../tools/lib/explain-build.ts';
import { serve } from '../tools/lib/explain-serve.ts';
import { launch } from '../tools/lib/browser.ts';
const enabled = !!process.env.EXPLAIN_BROWSER;
test(
  'the served reader skips optional notes, preserves direct links and returns to the last main step',
  { skip: enabled ? false : 'set EXPLAIN_BROWSER=1 for reference navigation' },
  async () => {
    const project = await collectProject('test/fixtures/reference-steps', { write: false });
    assert.equal(project.variants.length, 3);
    assert.deepEqual(
      project.variants[0]!.trace.steps.map((s) => s.step),
      ['alpha', 'note', 'omega', 'source'],
      'full verification retains every step',
    );
    const folder = await mkdtemp(join(tmpdir(), 'rayner-references-'));
    let browser: Awaited<ReturnType<typeof launch>> | undefined, server: Awaited<ReturnType<typeof serve>> | undefined;
    try {
      await buildExplainer(project, join(folder, 'index.html'));
      server = await serve(folder, 0, 'index.html');
      browser = await launch();
      for (const reducedMotion of ['reduce', 'no-preference'] as const) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion });
        await page.addInitScript(() =>
          document.addEventListener('rayner:step', (e: any) => ((window as any).__step = e.detail.step)),
        );
        const settled = async (step: string) => {
          await page.waitForFunction((step) => (window as any).__step === step, step);
          await page.locator('.leaving').waitFor({ state: 'detached' });
        };
        await page.goto(server.url);
        await settled('alpha');
        assert.equal(await page.locator('ol.steps:not(.supporting-steps)>li').count(), 2);
        assert.equal(await page.locator('ol.supporting-steps>li').count(), 2);
        await page.evaluate(() => {
          const stage = document.querySelector('.stage')!;
          const w = window as unknown as { noteFlashed: boolean; noteObserver: MutationObserver };
          w.noteFlashed = false;
          w.noteObserver = new MutationObserver(() => {
            if (stage.querySelector('path[fill="#ff0044"]')) w.noteFlashed = true;
          });
          w.noteObserver.observe(stage, { subtree: true, childList: true, attributes: true });
        });
        await page.locator('.step-transport button[aria-label="Next step"]').click();
        await settled('omega');
        assert.equal(
          await page.evaluate(() => {
            const w = window as unknown as { noteFlashed: boolean; noteObserver: MutationObserver };
            w.noteObserver.disconnect();
            return w.noteFlashed;
          }),
          false,
          'Next must not flash the skipped reference picture, including with ordinary motion',
        );

        assert.equal(
          await page.locator('.step-transport button[aria-label="Next step"]').isDisabled(),
          true,
          'main ending does not silently enter notes',
        );
        await page.locator('details.supporting>summary').click();
        await page.locator('button[data-step="note"]').click();
        await settled('note');
        assert.ok(
          (await page.locator('.stage path[fill="#ff0044"]').count()) > 0,
          'the observation control really paints the reference colour on direct entry',
        );

        await page.getByRole('button', { name: 'Back to the explanation', exact: true }).click();
        await settled('omega');
        await page.goto(server.url + '/index.html?step=note');
        await settled('note');
        await page.locator('.step-transport button[aria-label="Next step"]').click();
        await settled('omega');
        await page.goto(server.url + '/index.html?step=source');
        await settled('source');
        await page.locator('fieldset.case input[value="two"]').check();
        await page.waitForURL(/case=two/);
        await settled('source');
        await page.getByRole('button', { name: 'Back to the explanation', exact: true }).click();
        await settled('alpha');
        assert.equal(new URL(page.url()).searchParams.get('case'), 'two');
        await page.goto(server.url + '/index.html?case=all');
        await settled('alpha');
        assert.equal(
          await page.locator('ol.steps:not(.supporting-steps)>li').count(),
          4,
          'an all-note scene keeps a complete reachable path',
        );
        assert.equal(await page.locator('details.supporting').isVisible(), false);
        await page.locator('.step-transport button[aria-label="Next step"]').click();
        await settled('note');
        assert.equal(
          await page.getByRole('button', { name: 'Back to the explanation', exact: true }).isVisible(),
          false,
        );
        await page.close();
      }
    } finally {
      await browser?.close();
      server?.close();
      await rm(folder, { recursive: true, force: true });
    }
  },
);
