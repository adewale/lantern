import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, NullSink, traceScene } from '../src/index.ts';
import { resolveSettings, variantsOf, settingsOf, withSettings } from '../explain/index.ts';

class Example extends Scene {
  static settings = [
    {
      id: 'case',
      label: 'Case',
      default: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    },
    {
      id: 'rate',
      label: 'Rate',
      default: '1',
      options: [
        { value: '1', label: 'One' },
        { value: '2', label: 'Two' },
      ],
    },
  ];
  override async construct() {
    await this.step('choice');
    this.state = { ...settingsOf(this) };
  }
}
test('finite settings enumerate every combination and bind concurrent scenes without leakage', async () => {
  assert.deepEqual(variantsOf(Example), [
    { case: 'a', rate: '1' },
    { case: 'a', rate: '2' },
    { case: 'b', rate: '1' },
    { case: 'b', rate: '2' },
  ]);
  const traces = await Promise.all(variantsOf(Example).map((v) => traceScene(withSettings(Example, v))));
  assert.deepEqual(
    traces.map((t) => t.steps[0]!.after),
    variantsOf(Example),
  );
  assert.deepEqual({ ...settingsOf(new Example(new NullSink())) }, { case: 'a', rate: '1' });
  assert.throws(() => resolveSettings(Example, { case: 'invalid' }), /Unknown case/);
  assert.throws(() => resolveSettings(Example, { other: 'x' }), /Unknown setting/);
  assert.throws(() => variantsOf(Example, 3), /exceed/);
});
test('declarations reject ambiguous defaults, duplicate options and reserved transport keys', () => {
  for (const settings of [
    [{ id: 'case', label: 'Case', default: 'x', options: [{ value: 'a', label: 'A' }] }],
    [
      {
        id: 'case',
        label: 'Case',
        default: 'a',
        options: [
          { value: 'a', label: 'A' },
          { value: 'a', label: 'Again' },
        ],
      },
    ],
    [{ id: 'step', label: 'Step', default: 'a', options: [{ value: 'a', label: 'A' }] }],
  ]) {
    class Bad extends Scene {
      static settings = settings;
    }
    assert.throws(() => resolveSettings(Bad));
  }
});
