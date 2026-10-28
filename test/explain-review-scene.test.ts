import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectProject } from '../tools/lib/explain-project.ts';
import { reviewClaims, reviewScene } from '../tools/lib/explain-review-scene.ts';

const source = `import{Scene,Text,FadeIn}from'rayner';import{stage}from'rayner/explain';export default class Example extends Scene{static meta={id:'outside-author',title:'Outside author'};static settings=[{id:'case',label:'Case',default:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'}]}];async construct(){const s=stage(this,{heading:false});await this.step('one',{caption:'A visible answer.'});await this.play(new FadeIn(new Text('Answer',{color:s.palette.ink})));}}`;
test('author-side claims reject unknown cases, steps, malformed targets and missing explicit files', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'rayner-claims-'));
  try {
    const file = join(folder, 'scene.ts'), claims = join(folder, 'scene.review.json');
    await writeFile(file, source);
    const project = await collectProject(file, { write: false });
    assert.deepEqual(await reviewClaims(project), []);
    await assert.rejects(reviewClaims(project, claims), { code: 'ENOENT' });
    const valid = { step: 'one', opening: true, settings: { case: 'b' }, targets: [{ text: 'Answer' }] };
    await writeFile(claims, JSON.stringify({ version: 1, claims: [valid] }));
    assert.deepEqual(await reviewClaims(project), [valid]);
    for (const invalid of [{ ...valid, settings: { case: 'missing' } }, { ...valid, step: 'absent' }, { ...valid, targets: [] }, { ...valid, targets: [{ text: 'Answer', key: 'ambiguous' }] }, { ...valid, opening: 'yes' }]) {
      await writeFile(claims, JSON.stringify({ version: 1, claims: [invalid] }));
      await assert.rejects(reviewClaims(project));
    }
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('an outside author reviews every served case and width; a false caption claim fails closed', { skip: !process.env.EXPLAIN_BROWSER && 'set EXPLAIN_BROWSER=1 for the served-reader boundary' }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'rayner-author-review-'));
  try {
    const file = join(folder, 'scene.ts'), claims = join(folder, 'scene.review.json'), output = join(folder, 'review');
    await writeFile(file, source);
    const project = await collectProject(file, { write: false });
    await writeFile(claims, JSON.stringify({ version: 1, claims: [{ step: 'one', opening: true, targets: [{ text: 'Answer' }] }] }));
    const result = await reviewScene(project, output);
    assert.equal(result.cases, 2);
    assert.equal(result.stepWidths, 4);
    assert.deepEqual(result.results.map(c => c.steps.map(s => s.width)), [[390, 1180], [390, 1180]]);
    assert.deepEqual(result.consoleErrors, []);
    assert.deepEqual(result.runtimeConnections, []);
    await writeFile(claims, JSON.stringify({ version: 1, claims: [{ step: 'one', targets: [{ text: 'Missing answer' }] }] }));
    await assert.rejects(reviewScene(project, output), /story target Missing answer is missing/);
    await assert.rejects(readFile(join(output, 'review.json')), { code: 'ENOENT' });
  } finally { await rm(folder, { recursive: true, force: true }); }
});
