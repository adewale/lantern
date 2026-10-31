import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Text, Rectangle, Circle, loadFonts, NullSink } from '../src/index.ts';
import { stage } from '../explain/index.ts';
import { collectProject } from '../tools/lib/explain-project.ts';
import { fc, params } from './lib/pbt.ts';
import { bars } from '../scenes/explainers/lib/reader-drawing.ts';
await loadFonts();

test('comparison bars preserve a common scale, exact ends and an empty zero', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 1000000 }),
      fc.array(fc.integer({ min: 0, max: 1000000 }), { minLength: 1, maxLength: 3 }),
      (scale, raw) => {
        const values = raw.map((n) => n % (scale + 1)),
          s = stage(new Scene(new NullSink())),
          g = bars(
            s,
            values.map((v, i) => ({ label: `row ${i}`, value: v, display: String(v) })),
            scale,
          );
        const fills = g.children.filter((m): m is Rectangle => m instanceof Rectangle && m.style.stroke === 'none');
        assert.equal(fills.length, values.filter((v) => v > 0).length, 'zero must not acquire a decorative stub');
        // Rectangle paths use Float32 coordinates; allow less than 0.001 CSS px at 1280.
        for (const [i, v] of values.filter((v) => v > 0).entries()) {
          assert.ok(Math.abs(fills[i]!.width() - (8.5 * v) / scale) < 1e-5);
          assert.ok(Math.abs(fills[i]!.box()![0] + 4) < 1e-5, 'all bars start at the same zero');
          assert.ok(Math.abs(fills[i]!.box()![2] - (-4 + (8.5 * v) / scale)) < 1e-5);
        }
      },
    ),
    params(),
  );
});

test('token and ring introductions draw the independently expected balances, responses and slot values in every case', async () => {
  const token = await collectProject('scenes/explainers/token-bucket', { write: false }),
    ring = await collectProject('scenes/explainers/ring-buffer', { write: false });
  assert.equal(token.variants.length, 3);
  assert.equal(ring.variants.length, 2);
  let frames = 0;
  for (const v of token.variants)
    await new v.Scene(
      {
        async frame() {},
        async stepEnd(scene, step) {
          if (!step.name.startsWith('reader-')) return;
          const texts = scene
            .familyMembers()
            .filter((m): m is Text => m instanceof Text)
            .map((m) => m.text);
          if (step.name === 'reader-burst') {
            for (let i = 0; i < 6; i++) assert.ok(texts.includes(`R${i + 1}: ${i < 5 ? 200 : 429}`));
            const root = scene.familyMembers().find((m) => m.key === 'reader-picture');
            assert.ok(root);
            const tokens = root.family().filter((m) => m instanceof Circle);
            assert.equal(tokens.length, 5);
            for (const token of tokens)
              assert.ok((token.style.fillOpacity ?? 1) > 0.9, 'the five starting tokens must be filled');
          } else {
            const [found, after] = ({ 1: [0.5, 0.5], 2: [1, 0], 4: [2, 1] } as const)[
              Number(v.values.rate) as 1 | 2 | 4
            ];
            assert.equal((scene.state.reader as Record<string, unknown>).found, found);
            assert.equal((scene.state.reader as Record<string, unknown>).after, after);
            for (const [i, value] of [0, found, after].entries()) {
              const m = scene.familyMembers().find((m) => m.key === `reader-bars:${i}:value`);
              assert.ok(m instanceof Text);
              assert.equal(
                m.text,
                String(value),
                'the drawn number must match the balance, not just the internal state',
              );
            }
          }
          frames++;
        },
      },
      { skipUntil: Infinity },
    ).run();
  for (const v of ring.variants)
    await new v.Scene(
      {
        async frame() {},
        async stepEnd(scene, step) {
          if (!step.name.startsWith('reader-')) return;
          const expected =
            step.name === 'reader-capacity' || v.values.operations === 'full' ? [1, 2, 3, 4, 5] : [6, 7, 3, 4, 5];
          for (const [i, n] of expected.entries()) {
            const slot = scene.familyMembers().find((m) => m.key === `slot:${i}`);
            assert.ok(slot);
            assert.deepEqual(
              slot
                .family()
                .filter((m): m is Text => m instanceof Text)
                .map((m) => m.text),
              [String(n)],
            );
          }
          frames++;
        },
      },
      { skipUntil: Infinity },
    ).run();
  assert.equal(frames, 10);
});

test('GTFS stop introductions preserve fixed departures and frequency patterns across all six source-feed cases', async () => {
  const p = await collectProject('scenes/explainers/gtfs', { write: false });
  assert.equal(p.variants.length, 6);
  let checked = 0;
  for (const v of p.variants)
    await new v.Scene(
      {
        async frame() {},
        async stepEnd(scene, step) {
          if (step.name !== 'reader-stop') return;
          const [fixed, frequency] =
            v.values.date === '2007-06-04'
              ? [0, 0]
              : v.values.stop === 'airport'
                ? [v.values.date === '2007-06-09' ? 3 : 1, 0]
                : [0, 2];
          assert.equal((scene.state.reader as Record<string, unknown>).fixed, fixed);
          assert.equal((scene.state.reader as Record<string, unknown>).frequency, frequency);
          const words = scene
            .familyMembers()
            .filter((m): m is Text => m instanceof Text)
            .map((m) => m.text);
          const at = words.indexOf('Fixed times');
          assert.ok(at >= 0);
          assert.equal(words[at + 1], String(fixed));
          const bands = words.indexOf('Headway patterns');
          assert.ok(bands >= 0);
          assert.equal(words[bands + 1], String(frequency));
          checked++;
        },
      },
      { skipUntil: Infinity },
    ).run();
  assert.equal(checked, 6);
});

test('the occupied-date picture contains 365 days and the independently expected excluded set in every case', async () => {
  const p = await collectProject('scenes/explainers/birthday-paradox', { write: false });
  assert.equal(p.variants.length, 6);
  let checked = 0;
  for (const v of p.variants)
    await new v.Scene(
      {
        async frame() {},
        async stepEnd(scene, step) {
          if (step.name !== 'occupied') return;
          const grid = scene.familyMembers().find((m) => m.key === 'birthday-days');
          assert.ok(grid);
          const cells = grid.children.filter((m): m is Rectangle => m instanceof Rectangle);
          assert.equal(cells.length, 365);
          const expected = v.values.question === 'any' ? 4 : 1;
          assert.equal(cells.filter((m) => (m.style.fillOpacity ?? 1) > 0.9).length, expected);
          assert.equal(cells.filter((m) => (m.style.fillOpacity ?? 1) < 0.4).length, 365 - expected);
          checked++;
        },
      },
      { skipUntil: Infinity },
    ).run();
  assert.equal(checked, 6);
});

test('the complete annual daylight picture labels its fixed zero, twelve and twenty-four-hour scale at every latitude', async () => {
  const p = await collectProject('scenes/explainers/seasons', { write: false });
  assert.equal(p.variants.length, 4);
  let checked = 0;
  for (const v of p.variants)
    await new v.Scene(
      {
        async frame() {},
        async stepEnd(scene, step) {
          if (step.name !== 'reader-year') return;
          const root = scene.familyMembers().find((m) => m.key === 'reader-picture');
          assert.ok(root);
          const words = root
            .family()
            .filter((m): m is Text => m instanceof Text)
            .map((m) => m.text);
          for (const tick of ['0', '12', '24'])
            assert.ok(words.includes(tick), `${v.values.place}: ${tick} hours must be labelled`);
          checked++;
        },
      },
      { skipUntil: Infinity },
    ).run();
  assert.equal(checked, 4);
});

test('the default ext4 reserve comparison actually changes reserve and preserves the metadata allocation', async () => {
  const { frames } = await import('../scenes/explainers/lib/readers/ext4-space.ts');
  const [allocation, comparison] = frames('1t', 5);
  assert.ok(allocation && comparison);
  const s = stage(new Scene(new NullSink()));
  const picture = comparison.draw(s);
  const words = picture
    .family()
    .filter((m): m is Text => m instanceof Text)
    .map((m) => m.text);
  assert.ok(words.includes('Users at 5% reserve'));
  assert.ok(words.includes('Users at 1% reserve'));
  const fills = picture.family().filter((m): m is Rectangle => m instanceof Rectangle && m.style.stroke === 'none');
  assert.equal(fills.length, 2);
  assert.ok(fills[1]!.width() > fills[0]!.width(), 'lower reserve must visibly increase writable space');
  assert.equal(comparison.values.metadata, 4495258, 'metadata matches the existing 1 TiB mkfs reference vector');
});
