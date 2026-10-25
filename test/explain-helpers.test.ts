import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, NullSink, Rectangle, traceScene } from '../src/index.ts';
import { stage, bindSnapshots } from '../explain/index.ts';
import { diagramKey, snapshotResolver, useDiagrams } from '../integrations/agentic-mermaid/snapshot.ts';
import type { DiagramSnapshot } from '../explain/index.ts';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectProject, writeSnapshots } from '../tools/lib/explain-project.ts';
import { checkProject, lintConstruct } from '../tools/lib/explain-check.ts';
import { resizeHeight, exactHttpOrigin } from '../app/embed-protocol.ts';

const spec = { source: 'graph LR\nA -->|hello| B', style: 'nord' };
function fixture(): DiagramSnapshot {
  const shape = (x: number) => square(x, { fill: '#fff', stroke: '#000' });
  return fixedSnapshot(
    spec,
    [
      { id: '__frame', role: 'frame', kind: 'shape', shapes: [shape(0)] },
      { id: 'A', role: 'node', kind: 'shape', shapes: [shape(0)] },
      { id: 'B', role: 'node', kind: 'shape', shapes: [shape(3)] },
      {
        id: 'edge:A->B#0',
        role: 'edge',
        kind: 'connector',
       
        shapes: [shape(1)],
        from: 'A',
        to: 'B',
        route: [
          [0.25, 0],
          [2.75, 0],
        ],
      },
      {
        id: 'edge-label:A->B#0',
        owner: 'edge:A->B#0',
        role: 'edge-label',
        kind: 'text',
       
        shapes: [shape(1.5)],
      },
    ],
    { palette: { paper: '#123456', ink: '#fff', accent: '#ff0', muted: '#aaa' } },
  );
}
test('frame reveal, semantic labels, real-link walks and palette adoption use native objects', async () => {
  class Demo extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('frame');
      const d = await s.show(spec, { build: 'frame' });
      assert.equal(s.paper.style.fill, '#123456');
      assert.deepEqual([...d.visible], ['__frame']);
      await d.focus(['A']);
      assert.ok(!this.familyMembers().some((m) => m.key === 'A'));
      await d.reveal(['A', 'B', 'edge:A->B#0']);
      assert.equal(d.get('edge-label:A->B#0').parent, d.get('edge:A->B#0'));
      await d.walk([['A', 'B']]);
      await assert.rejects(d.walk([['B', 'A']]), /not a real link/);
      await assert.rejects(d.reveal(-1), /non-negative/);
      this.state = { answer: 42 }; // Model replacement must not erase helper evidence.
    }
  }
  const trace = await traceScene(bindSnapshots(Demo, { [diagramKey(spec)]: fixture() }));
  assert.deepEqual(trace.steps[0]!.after!.walks, [
    { step: 'frame', from: 'A', to: 'B', edge: 'edge:A->B#0' },
  ]);
});
test('snapshot JSON rejects corrupt points, paint, ownership and source identity without dropping artwork', async () => {
  const good = fixture();
  assert.equal(await snapshotResolver({ [diagramKey(spec)]: good }).diagram(spec), good);
  const corruptions = [
    (s: DiagramSnapshot) => {
      s.parts[0]!.shapes[0]!.subpaths[0]![0] = null as unknown as number;
    },
    (s: DiagramSnapshot) => {
      s.parts[0]!.shapes[0]!.style.fill = 'url(https://outside.test/image)';
    },
    (s: DiagramSnapshot) => {
      s.parts[0]!.owner = s.parts[0]!.id;
    },
    (s: DiagramSnapshot) => {
      s.parts[0]!.shapes[0]!.closed = [];
    },
    (s: DiagramSnapshot) => {
      s.width = Infinity;
    },
    (s: DiagramSnapshot) => {
      s.findings = { warnings: [] } as unknown as DiagramSnapshot['findings'];
    },
    (s: DiagramSnapshot) => {
      s.findings.warnings = [{ edge: 'A->B#0' } as unknown as DiagramSnapshot['findings']['warnings'][number]];
    },
    (s: DiagramSnapshot) => {
      s.findings.layout = { edges: [{ from: 'A' } as { from: string; to: string }] };
    },
    (s: DiagramSnapshot) => {
      s.chart = { series: [{ kind: 'bar', values: [1, null as unknown as number] }] };
    },
  ];
  for (const corrupt of corruptions) {
    const broken = JSON.parse(JSON.stringify(good));
    corrupt(broken);
    await assert.rejects(
      snapshotResolver({ [diagramKey(spec)]: broken }).diagram(spec),
      /Invalid diagram snapshot/,
    );
  }
  await assert.rejects(
    snapshotResolver({ [diagramKey(spec)]: { ...good, spec: { source: 'graph LR\\nX-->Y' } } }).diagram(spec),
    /does not match/,
  );
});

test('legibility requires a readable completed step, not just a transient camera sweep', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lantern-legibility-'));
  try {
    const snapshot = fixture();
    snapshot.width = 1600;
    snapshot.height = 900;
    snapshot.parts
      .find((p) => p.id === 'B')!
      .shapes.push({
        subpaths: [],
        closed: [],
        style: {
          fill: '#ffffff',
          stroke: 'none',
          strokeWidth: 0,
          fillOpacity: 1,
          strokeOpacity: 1,
          opacity: 1,
        },
        text: 'B',
        fontSize: 0.04,
        textRun: { text: 'B', x: 300, y: 0, size: 4, matrix: [1, 0, 0, 1, 0, 0] },
      });
    const file = join(folder, 'scene.ts');
    await writeFile(
      file,
      `import{Scene}from'manim-js';import{stage}from'manim-js/explain';export default class Camera extends Scene{async construct(){const s=stage(this);await this.step('one',{caption:'Read the label.'});const d=await s.show(${JSON.stringify(spec)});await d.focus(['B']);await this.wait(.5);await d.focus('all');await this.wait(.5);}}`,
    );
    await writeSnapshots(join(folder, 'scene'), { [diagramKey(spec)]: snapshot }, 'test');
    const project = await collectProject(file, { write: false });
    await assert.rejects(checkProject(project, join(folder, 'checks')), /readable completed-step view/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('construct lint distinguishes pure model catches from catches around animations', () => {
  assert.deepEqual(
    lintConstruct(
      'class S { async construct(){ try { model.push(1) } catch(e) { report(e) } await this.step("ok"); } }',
    ),
    [],
  );
  assert.match(
    lintConstruct('class S { async construct(){ try { await this.step("x") } catch(e) {} } }')[0]!,
    /StopScene/,
  );
});
test('resize protocol validates both authorities and a finite bounded integer payload', () => {
  const source = {} as MessageEventSource,
    origin = 'https://example.test';
  const event = { source, origin, data: { type: 'lantern:resize', version: 1, height: 742 } };
  assert.equal(resizeHeight(event, origin, source), 742);
  assert.equal(resizeHeight({ ...event, source: {} as MessageEventSource }, origin, source), null);
  assert.equal(resizeHeight({ ...event, origin: 'https://other.test' }, origin, source), null);
  for (const height of [-1, 0, 100001, 0.5, NaN, Infinity, -Infinity, '742', null, {}, []])
    assert.equal(resizeHeight({ ...event, data: { ...event.data, height } }, origin, source), null);
  for (const data of [
    null,
    [],
    {},
    'message',
    { ...event.data, version: 2 },
    { ...event.data, type: 'other' },
  ])
    assert.equal(resizeHeight({ ...event, data }, origin, source), null);
  for (const input of [
    null,
    '*',
    'null',
    'file:///tmp/x',
    'https://example.test/path',
    'https://example.test/',
    'javascript:alert(1)',
  ])
    assert.equal(exactHttpOrigin(input), null);
  assert.equal(exactHttpOrigin(origin), origin);
});
test('inline script escaping neutralises </script without changing what the code does', async () => {
  const { scriptEscape } = await import('../tools/lib/explain-project.ts');
  const vm = await import('node:vm');
  // The regex that broke the built Lantern page, plus the cases HTML parsing cares about.
  const code =
    'globalThis.out = ["a<b</c".replace(/</g, "&lt;"), "</script>".length, /<\\/SCRIPT>/i.test("</script>"), "x\\u2028y".length];';
  const escaped = scriptEscape(code);
  assert.doesNotMatch(escaped, /<\/script/i);
  const run = (source: string) => {
    const context = vm.createContext({});
    vm.runInContext(source, context);
    return JSON.stringify((context as { out: unknown }).out);
  };
  assert.equal(run(escaped), run(code));
});
test('verifier warnings resolve to snapshot parts even when global and per-pair edge numbers differ', async () => {
  const { findingsOf, edgePartOf } = await import('../explain/index.ts');
  const part = (id: string, from: string, to: string) => ({ id, role: 'edge', kind: 'connector', shapes: [], from, to });
  // Edges in source order: A->B, A->C, A->B (parallel). Globally the second A->B is #2; per pair it is #1.
  const snapshot = {
    ...fixture(),
    parts: [part('edge:A->B#0', 'A', 'B'), part('edge:A->C#0', 'A', 'C'), part('edge:A->B#1', 'A', 'B')],
    findings: {
      ok: true,
      warnings: [
        { code: 'DECISION_BRANCH_UNLABELED', node: 'A', edge: 'A->C#1' },
        { code: 'DECISION_BRANCH_UNLABELED', node: 'A', edge: 'A->B#2' },
        { code: 'OTHER', node: 'A' },
      ],
      layout: { edges: [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }, { from: 'A', to: 'B' }] },
    },
  } as unknown as DiagramSnapshot;
  assert.deepEqual(
    findingsOf(snapshot).map((f) => f.part),
    ['edge:A->C#0', 'edge:A->B#1', undefined],
  );
  assert.equal(edgePartOf(snapshot, 'A->B#9'), undefined);
});

// ---- properties ------------------------------------------------------------------
import { fc, params } from './lib/pbt.ts';
import { snapshot as randomSnapshot, hexColor, fixedSnapshot, square } from './lib/random-snapshot.ts';
import { diagramsOf } from '../integrations/agentic-mermaid/snapshot.ts';
import { findingsOf as findingsOfP, edgePartOf as edgePartOfP, regionBox, REGIONS } from '../explain/index.ts';
import { raised, rule, emphasis, soft, dimOpacity } from '../explain/look.ts';
import { PALETTES } from '../explain/palettes.ts';
import { Diagram } from '../explain/diagrams.ts';
import { scriptEscape, snapshotFileName, hash } from '../tools/lib/explain-project.ts';
import { htmlEscape } from '../explain/trace.ts';
import { transformSync } from 'esbuild';
import vm from 'node:vm';
import { parseColor, lerpColor } from '../src/color.ts';

// ---- app/embed-protocol.ts -------------------------------------------------------

const httpOrigin = fc.webUrl({ validSchemes: ['http', 'https'] }).map((u) => new URL(u).origin);

test('exactHttpOrigin returns its input or null, and only an http(s) origin', () => {
  fc.assert(
    fc.property(fc.oneof(fc.string(), fc.string({ unit: 'binary' }), fc.webUrl(), httpOrigin, fc.webUrl({ validSchemes: ['ftp', 'file', 'data', 'javascript'] })), (value) => {
      const out = exactHttpOrigin(value);
      if (out == null) return;
      assert.equal(out, value);
      assert.equal(new URL(value).origin, value);
      assert.match(new URL(value).protocol, /^https?:$/);
    }),
    params(),
  );
});

test('exactHttpOrigin accepts every exact http(s) origin', () => {
  fc.assert(fc.property(httpOrigin, (origin) => assert.equal(exactHttpOrigin(origin), origin)), params());
});

test('exactHttpOrigin refuses an origin with a path, query, fragment, credentials, case change or padding', () => {
  fc.assert(
    fc.property(
      httpOrigin,
      fc.oneof(
        fc.constantFrom('/', '/x', '?', '?q=1', '#', '#f', ' ', '\n', '\t'),
        fc.webPath().filter((p) => p.length > 0),
      ),
      fc.constantFrom('suffix', 'prefix', 'userinfo', 'upper'),
      (origin, extra, how) => {
        let value: string;
        if (how === 'suffix') value = origin + extra;
        else if (how === 'prefix') value = ' ' + origin;
        else if (how === 'userinfo') value = origin.replace('://', '://user:pw@');
        else {
          value = origin.toUpperCase();
          fc.pre(value !== origin);
        }
        assert.equal(exactHttpOrigin(value), null, value);
      },
    ),
    params(),
  );
});

const source = {} as MessageEventSource,
  otherSource = {} as MessageEventSource;
const height = fc.oneof(
  fc.integer({ min: -10, max: 100010 }),
  fc.double(),
  fc.constantFrom(1, 100000, 0, -0, 100001, 0.5, NaN, Infinity, -Infinity),
  fc.constantFrom('742', 5n, new Number(5), null, undefined, {}, []),
);
const resizeData = fc.oneof(
  fc.record({ type: fc.constantFrom('lantern:resize', 'other', ''), version: fc.constantFrom(1, 2, '1', 0), height }),
  fc.record({ type: fc.constant('lantern:resize'), version: fc.constant(1), height }),
  fc.anything(),
);

test('resizeHeight accepts exactly the documented message from exactly the framed child', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('same', 'other'),
      fc.constantFrom('same', 'other', 'null'),
      resizeData,
      httpOrigin,
      (o, s, data, origin) => {
        const event = { origin: o === 'same' ? origin : origin + '.evil', source: s === 'same' ? source : s === 'other' ? otherSource : null, data };
        const d = data as Record<string, unknown> | null;
        const ok =
          o === 'same' &&
          s === 'same' &&
          !!d &&
          typeof d === 'object' &&
          d.type === 'lantern:resize' &&
          d.version === 1 &&
          typeof d.height === 'number' &&
          Number.isInteger(d.height) &&
          d.height >= 1 &&
          d.height <= 100000;
        assert.equal(resizeHeight(event, origin, s === 'null' ? null : source), ok ? d!.height : null);
      },
    ),
    params(),
  );
});

// ---- explain/look.ts and colours -------------------------------------------------

/** Colours the snapshot validator accepts: 3, 4, 6 and 8 hex digits, either case, and 'none'. */
const anyHex = fc.oneof(
  hexColor,
  fc.stringMatching(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/),
  fc.constant('none'),
);
const anyPalette = fc.record({ paper: anyHex, ink: anyHex, accent: anyHex, muted: anyHex });
const channels = (c: string) => parseColor(c);

test('soft, raised and rule give a colour for every palette the snapshot validator accepts', () => {
  fc.assert(
    fc.property(anyPalette, (p) => {
      for (const c of [soft(p), raised(p), rule(p)])
        assert.ok(c === 'none' || [p.paper, p.ink].includes(c) || /^#[0-9a-f]{6}$/.test(c), `${c} from ${JSON.stringify(p)}`);
    }),
    params(),
  );
});

test('raised, rule and soft step from the paper toward the ink, in that order', () => {
  fc.assert(
    fc.property(fc.record({ paper: hexColor, ink: hexColor, accent: hexColor, muted: hexColor }), (p) => {
      const [paper, ink] = [channels(p.paper)!, channels(p.ink)!];
      const far = (c: string) => channels(c)!.map((v, i) => Math.abs(v - paper[i]!));
      const [a, b, c] = [far(raised(p)), far(rule(p)), far(soft(p))];
      for (let i = 0; i < 3; i++) {
        const span = Math.abs(ink[i]! - paper[i]!);
        assert.ok(a[i]! <= b[i]! && b[i]! <= c[i]! && c[i]! <= span, `${a} ${b} ${c}`);
        // Each is the documented fraction of the way, to the nearest channel step.
        // (A tie can round either way once the product carries a rounding error: allow 1e-9 past it.)
        const near = (got: number, f: number) => Math.abs(got - f * span) <= 0.5 + 1e-9;
        assert.ok(near(a[i]!, 0.07) && near(b[i]!, 0.28) && near(c[i]!, 0.68), `${a} ${b} ${c} of ${span}`);
      }
    }),
    params(),
  );
});

test('emphasis is the accent or one of the two warm oranges, and ignores ink and muted', () => {
  fc.assert(
    fc.property(anyPalette, anyHex, anyHex, (p, ink, muted) => {
      const e = emphasis(p);
      assert.ok([p.accent, '#ffb454', '#d9480f'].includes(e));
      assert.equal(emphasis({ ...p, ink, muted }), e);
    }),
    params(),
  );
});

test('a grey accent is never emphasis', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 255 }), hexColor, (v, paper) => {
      const grey = '#' + v.toString(16).padStart(2, '0').repeat(3);
      assert.notEqual(emphasis({ paper, ink: '#000000', accent: grey, muted: grey }), grey);
    }),
    params(),
  );
});

/** WCAG relative luminance and contrast. */
const lum = (c: string) => {
  const [r, g, b] = channels(c)!.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

test('every built-in style has an emphasis colour that reads on its paper', () => {
  for (const [name, p] of Object.entries(PALETTES))
    assert.ok(contrast(emphasis(p), p.paper) >= 1.5, `${name}: ${emphasis(p)} on ${p.paper} is ${contrast(emphasis(p), p.paper).toFixed(2)}:1`);
});

const regionName = fc.constantFrom(...(Object.keys(REGIONS) as (keyof typeof REGIONS)[]));

test('regionBox returns a fresh copy of a region or box: changing it changes nothing else', () => {
  fc.assert(
    fc.property(fc.oneof(regionName, fc.tuple(fc.double(), fc.double(), fc.double(), fc.double())), fc.nat({ max: 3 }), fc.double(), (r, i, v) => {
      const source = typeof r === 'string' ? REGIONS[r] : r;
      const before = [...source];
      const b = regionBox(r as never);
      assert.deepEqual(b, before);
      b[i] = v;
      assert.deepEqual([...source], before);
    }),
    params(),
  );
});

// REGIONS is a fixed table, so these two check every entry rather than sample.
test('every region lies in the stage, below the heading line, with positive area', () => {
  for (const [name, [x0, y0, x1, y1]] of Object.entries(REGIONS))
    assert.ok(x0 >= REGIONS.full[0] && x1 <= REGIONS.full[2] && y0 >= REGIONS.full[1] && y1 <= 3.25 && x1 > x0 && y1 > y0, name);
});

test('the regions meant to sit side by side never overlap', () => {
  for (const [a, b] of [['left', 'right'], ['main', 'side'], ['top', 'bottom']] as const)
    assert.ok(REGIONS[a][2] <= REGIONS[b][0] || REGIONS[b][3] <= REGIONS[a][1], `${a} and ${b} overlap`);
});

// ---- integrations/agentic-mermaid/snapshot.ts ------------------------------------

const specArb = fc.record(
  {
    source: fc.oneof(fc.string({ maxLength: 12 }), fc.constantFrom('graph LR\nA-->B', 'a', ' a ', 'a\r\nb', 'a\nb', 'a\rb')),
    style: fc.constantFrom('default', 'nord', ''),
    spacing: fc.oneof(fc.constant(null), fc.integer({ min: -5, max: 5 }), fc.double({ noNaN: true, noDefaultInfinity: true })),
  },
  { requiredKeys: ['source'] },
);
const normal = (s: { source: string; style?: string; spacing?: number | null }) => [s.source.replace(/\r\n/g, '\n').trim(), s.style ?? 'default', s.spacing ?? null];

test('diagramKey ignores CRLF, surrounding space, the default style and an absent spacing', () => {
  fc.assert(
    fc.property(specArb, fc.constantFrom('', ' ', '\n', '\r\n', '\t '), (spec, pad) => {
      const variant = { ...spec, source: pad + spec.source.replace(/\r?\n/g, '\r\n') + pad };
      if (spec.style === 'default') delete (variant as { style?: string }).style;
      if (spec.spacing == null) delete (variant as { spacing?: number | null }).spacing;
      assert.equal(diagramKey(variant as never), diagramKey(spec as never));
    }),
    params(),
  );
});

test('diagramKey tells apart specs that differ in source, style or spacing', () => {
  fc.assert(
    fc.property(specArb, specArb, (a, b) => {
      assert.equal(diagramKey(a as never) === diagramKey(b as never), JSON.stringify(normal(a)) === JSON.stringify(normal(b)));
    }),
    params(),
  );
});

test('diagramKey refuses a spacing that is not a finite number', () => {
  fc.assert(
    fc.property(fc.string(), fc.constantFrom(NaN, Infinity, -Infinity), (source, spacing) => {
      assert.throws(() => diagramKey({ source, spacing }), /finite/);
    }),
    params(),
  );
});

test('a valid snapshot resolves to itself, for every spelling of its spec and after a JSON round trip', async () => {
  await fc.assert(
    fc.asyncProperty(randomSnapshot('graph LR\nA-->B'), fc.constantFrom('', ' ', '\r\n'), fc.boolean(), async (s, pad, json) => {
      const stored = json ? JSON.parse(JSON.stringify(s)) : s;
      const resolver = snapshotResolver({ [diagramKey(s.spec)]: stored });
      assert.equal(await resolver.diagram({ ...s.spec, source: pad + s.spec.source.replace(/\n/g, '\r\n') + pad }), stored);
    }),
    params(),
  );
});

/** Every path to a value in a JSON tree. */
function paths(value: unknown, at: (string | number)[] = []): (string | number)[][] {
  const out = [at];
  if (Array.isArray(value)) value.forEach((v, i) => out.push(...paths(v, [...at, i])));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) out.push(...paths(v, [...at, k]));
  return out;
}
const mutated = randomSnapshot('graph LR\nA-->B').chain((s) => {
  const all = paths(s).filter((p) => p.length > 0);
  return fc.tuple(
    fc.constant(s),
    fc.constantFrom(...all),
    fc.oneof(fc.jsonValue(), fc.constantFrom(null, undefined, NaN, Infinity, -1, '', 'red', '#12', '4,2', '-1', {}, [], [[1]], 'ab', 5)),
  );
});
const mutate = (s: DiagramSnapshot, path: (string | number)[], value: unknown) => {
  const copy = JSON.parse(JSON.stringify(s));
  let at = copy;
  for (const k of path.slice(0, -1)) at = at[k];
  at[path.at(-1)!] = value;
  return copy as DiagramSnapshot;
};

test('a snapshot with any one field replaced is accepted or refused with the documented error, never a TypeError', async () => {
  await fc.assert(
    fc.asyncProperty(mutated, async ([s, path, value]) => {
      const broken = mutate(s, path, value);
      const key = diagramKey(s.spec);
      try {
        await snapshotResolver({ [key]: broken }).diagram(s.spec);
      } catch (error) {
        assert.match((error as Error).message, /^(Invalid diagram snapshot|Snapshot source does not match)/, `${path.join('.')} = ${JSON.stringify(value)}`);
      }
    }),
    params(),
  );
});

test('whatever the validator accepts, a Diagram can draw without a NaN', async () => {
  await fc.assert(
    fc.asyncProperty(mutated, async ([s, path, value]) => {
      const broken = mutate(s, path, value);
      let ok: DiagramSnapshot;
      try {
        ok = await snapshotResolver({ [diagramKey(s.spec)]: broken }).diagram(s.spec);
      } catch {
        return;
      }
      const scene = new Scene(new NullSink(), { skipUntil: Infinity });
      const d = new Diagram(scene, ok.spec, ok, { box: 'side' });
      await d.build();
      await d.focus('all');
      for (const p of d.parts.values())
        for (const m of p.mob.family()) {
          for (const a of m.pointArrays()) assert.ok(a.every(Number.isFinite), `${path.join('.')} = ${JSON.stringify(value)}: point`);
          assert.ok(!/NaN/.test(JSON.stringify(m.style) + String(m.style.dashArray)), `${path.join('.')} = ${JSON.stringify(value)}: ${JSON.stringify(m.style)}`);
        }
    }),
    params(300),
  );
});

test('a canvas so large the diagram fits to a point still draws finite points (CI counterexample)', async () => {
  const s = { ...fixture(), width: 129312739843.01703 };
  const ok = await snapshotResolver({ [diagramKey(s.spec)]: s }).diagram(s.spec);
  const d = new Diagram(new Scene(new NullSink(), { skipUntil: Infinity }), ok.spec, ok, { box: 'side' });
  await d.build();
  await d.focus('all');
  for (const p of d.parts.values()) for (const m of p.mob.family()) for (const a of m.pointArrays()) assert.ok(a.every(Number.isFinite));
});

test('resolving a snapshot never changes it', async () => {
  await fc.assert(
    fc.asyncProperty(randomSnapshot(), async (s) => {
      const before = JSON.stringify(s);
      await snapshotResolver({ [diagramKey(s.spec)]: s }).diagram(s.spec);
      assert.equal(JSON.stringify(s), before);
    }),
    params(),
  );
});

test('ownership cycles and owners that do not exist are refused', async () => {
  await fc.assert(
    fc.asyncProperty(
      randomSnapshot().filter((s) => s.parts.length > 0).chain((s) => fc.tuple(fc.constant(s), fc.array(fc.nat(), { minLength: 1, maxLength: 4 }), fc.boolean(), fc.string())),
      async ([s, chain, dangling, ghost]) => {
        const copy: DiagramSnapshot = JSON.parse(JSON.stringify(s));
        const ids = chain.map((i) => copy.parts[i % copy.parts.length]!);
        if (dangling) {
          fc.pre(!copy.parts.some((p) => p.id === ghost) && ghost !== '');
          ids[0]!.owner = ghost;
        } else ids.forEach((p, i) => (p.owner = ids[(i + 1) % ids.length]!.id));
        await assert.rejects(snapshotResolver({ [diagramKey(s.spec)]: copy }).diagram(s.spec), /Invalid diagram snapshot/);
      },
    ),
    params(),
  );
});

test('a missing snapshot is refused', async () => {
  await fc.assert(
    fc.asyncProperty(randomSnapshot(), fc.array(randomSnapshot('other'), { maxLength: 2 }), async (s, others) => {
      const store = Object.fromEntries(others.map((o) => [diagramKey(o.spec), o]));
      fc.pre(!(diagramKey(s.spec) in store));
      await assert.rejects(snapshotResolver(store).diagram(s.spec), /Missing diagram snapshot/);
    }),
    params(),
  );
});

test('a snapshot stored under another spec is refused', async () => {
  await fc.assert(
    fc.asyncProperty(randomSnapshot(), specArb, async (s, other) => {
      fc.pre(diagramKey(other as never) !== diagramKey(s.spec));
      await assert.rejects(snapshotResolver({ [diagramKey(other as never)]: s }).diagram(other as never), /does not match/);
    }),
    params(),
  );
});

test('diagramsOf returns the resolver last bound to that scene, and refuses an unbound scene', () => {
  fc.assert(
    fc.property(fc.array(fc.nat({ max: 3 }), { maxLength: 10 }), (binds) => {
      const scenes = Array.from({ length: 4 }, () => new Scene(new NullSink()));
      const last = new Map<Scene, unknown>();
      for (const i of binds) {
        const r = snapshotResolver({});
        useDiagrams(scenes[i]!, r);
        last.set(scenes[i]!, r);
      }
      for (const scene of scenes)
        if (last.has(scene)) assert.equal(diagramsOf(scene), last.get(scene));
        else assert.throws(() => diagramsOf(scene), /No diagram snapshots/);
    }),
    params(),
  );
});

/** A multigraph in global edge order, its per-pair part ids, and the verifier's layout. */
const multigraph = fc
  .tuple(fc.uniqueArray(fc.oneof(fc.stringMatching(/^[A-Za-z]{1,3}$/), fc.constantFrom('a->b', 'x#1', 'n-1', '#')), { minLength: 1, maxLength: 4 }), fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 10 }), fc.boolean())
  .map(([nodes, pairs, layout]) => {
    const edges = pairs.map(([a, b]) => ({ from: nodes[a % nodes.length]!, to: nodes[b % nodes.length]! }));
    const seen = new Map<string, number>();
    const ids = edges.map((e) => {
      const k = `${e.from}->${e.to}`;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      return `edge:${k}#${n}`;
    });
    const parts = edges.map((e, i) => ({ id: ids[i]!, role: 'edge', kind: 'connector', shapes: [], from: e.from, to: e.to }));
    const s = { parts, findings: { ok: true, warnings: [], ...(layout ? { layout: { edges } } : {}) } } as unknown as DiagramSnapshot;
    return { s, edges, ids };
  });

test('edgePartOf names the part of the k-th edge, with or without the verifier layout', () => {
  fc.assert(
    fc.property(multigraph, ({ s, edges, ids }) => {
      edges.forEach((e, k) => assert.equal(edgePartOfP(s, `${e.from}->${e.to}#${k}`), ids[k]));
    }),
    params(),
  );
});

test('edgePartOf finds nothing for a name whose index or endpoints do not match an edge', () => {
  fc.assert(
    fc.property(multigraph, fc.string(), fc.oneof(fc.integer({ min: -3, max: 30 }), fc.constant(1e21)), ({ s, edges }, name, k) => {
      const e = edges[k];
      fc.pre(!e || name !== `${e.from}->${e.to}`);
      assert.equal(edgePartOfP(s, `${name}#${k}`), undefined);
      assert.equal(edgePartOfP(s, name.replace(/#\d+$/, '')), undefined);
    }),
    params(),
  );
});

test('findingsOf keeps each warning, adds the part its edge names, and copies rather than mutates', () => {
  fc.assert(
    fc.property(
      multigraph.chain((m) => fc.tuple(fc.constant(m), fc.array(fc.record({ code: fc.string(), edge: fc.oneof(fc.string(), ...(m.edges.length ? [fc.nat({ max: m.edges.length - 1 }).map((k) => `${m.edges[k]!.from}->${m.edges[k]!.to}#${k}`)] : [])), part: fc.string() }, { requiredKeys: ['code'] })))),
      ([{ s }, warnings]) => {
        const snap = { ...s, findings: { ...(s.findings as object), warnings } } as DiagramSnapshot;
        const before = JSON.stringify(warnings);
        const out = findingsOfP(snap);
        assert.equal(out.length, warnings.length);
        out.forEach((f, i) => {
          const w = warnings[i]!;
          const part = typeof w.edge === 'string' ? edgePartOfP(snap, w.edge) : undefined;
          const { part: _ignored, ...rest } = w;
          assert.deepEqual(f, part ? { ...rest, part } : rest);
          assert.notEqual(f, w);
        });
        assert.equal(JSON.stringify(warnings), before);
      },
    ),
    params(),
  );
});

test('dimmed ink reaches 3:1 on the paper of every built-in style, at the least opacity that does', () => {
  for (const [name, p] of Object.entries(PALETTES)) {
    const at = (a: number) => contrast(lerpColor(p.paper, p.ink, a), p.paper);
    const a = dimOpacity(p);
    assert.ok(at(a) >= 3, `${name}: ${at(a).toFixed(2)}:1 at ${a}`);
    assert.ok(a === 0.2 || at(a - 0.01) < 3, `${name}: ${a} is more than needed`);
  }
});
test('the explain entry point exports exactly its documented names', async () => {
  assert.deepEqual(Object.keys(await import('../explain/index.ts')).sort(), [
    'Diagram', 'REGIONS', 'bindSnapshots', 'caseName', 'edgePartOf', 'findingsOf', 'palette', 'regionBox',
    'resolveSettings', 'settingsOf', 'stage', 'variantsOf', 'withSettings',
  ]);
});
test('the fallback emphasis is the warm orange that contrasts more with the paper', () => {
  fc.assert(
    fc.property(hexColor, fc.integer({ min: 0, max: 255 }), (paper, v) => {
      const grey = '#' + v.toString(16).padStart(2, '0').repeat(3);
      const e = emphasis({ paper, ink: '#000000', accent: grey, muted: grey });
      const other = e === '#ffb454' ? '#d9480f' : '#ffb454';
      assert.ok(contrast(e, paper) >= contrast(other, paper), `${e} on ${paper}: ${contrast(e, paper).toFixed(2)} < ${contrast(other, paper).toFixed(2)}`);
    }),
    params(),
  );
});

// ---- tools/lib/explain-project.ts ------------------------------------------------

/** Strings rich in the tokens the HTML parser reacts to, overlapping in every way. */
const hostile = fc.string({ unit: fc.constantFrom('<', '/', '!', '-', 's', 'c', 'r', 'i', 'p', 't', 'S', 'C', 'R', 'I', 'P', 'T', '>', ' ', '\u2028', '\u2029', 'x', '\\', '`', '"'), maxLength: 40 });

test('scriptEscape leaves no </script (any case) and no <!--', () => {
  fc.assert(
    fc.property(fc.oneof(hostile, fc.string({ unit: 'binary' })), (code) => {
      const out = scriptEscape(code);
      assert.doesNotMatch(out, /<\/script/i);
      assert.doesNotMatch(out, /<!--/);
    }),
    params(),
  );
});

test('scriptEscape changes nothing in code without those tokens', () => {
  fc.assert(
    fc.property(fc.oneof(hostile, fc.string({ unit: 'binary' })), (code) => {
      fc.pre(!/<\/script|<!--|\u2028|\u2029/i.test(code));
      assert.equal(scriptEscape(code), code);
    }),
    params(),
  );
});

/** Expression fragments as bundled code contains them: strings, templates, regexes (with u/v), raw templates. */
const regexToken = fc.constantFrom('<', '!', '-', 'a', '<!--', '<\\/script', '\\/', 's', '>', 'x*');
const fragment = fc.oneof(
  hostile.map((t) => JSON.stringify(t)),
  hostile.map((t) => '`' + t.replace(/[\\`$]/g, '\\$&') + '`'),
  hostile.map((t) => '`' + t.replace(/[\\`$]/g, '\\$&') + '${1}`'),
  fc.tuple(fc.array(regexToken, { minLength: 1, maxLength: 5 }), fc.constantFrom('', 'u', 'v', 'i', 'gu'), hostile).map(
    // What a regex matches, not its .source text: escaping `<!--` changes the text of a regex
    // (and of a raw template) that holds it, never what it matches (ledger: scriptEscape).
    ([tokens, flags, sample]) =>
      `(r => [r.flags, r.test(${JSON.stringify(sample)}), r.test(${JSON.stringify(tokens.join('').replace(/\\/g, ''))}), '<!--'.replace(r, '#')])(/${tokens.join('')}/${flags})`,
  ),
  // Raw templates keep their backslashes, so no textual escape of `<!--` or U+2028/9 can preserve them
  // (ledger: scriptEscape, String.raw). esbuild itself rewrites raw templates holding </script.
  hostile.filter((t) => !/<!--|\u2028|\u2029/.test(t)).map((t) => 'String.raw`' + t.replace(/[`$]/g, '').replace(/\\+$/, '') + '`'),
);
const runOut = (code: string) => {
  const context = vm.createContext({});
  vm.runInContext(code, context);
  return JSON.stringify((context as { out: unknown }).out);
};

test('scriptEscape keeps what bundled code does', () => {
  fc.assert(
    fc.property(fc.array(fragment, { minLength: 1, maxLength: 6 }), (fragments) => {
      const program = `globalThis.out = [${fragments.join(', ')}];`;
      let bundled: string;
      try {
        bundled = transformSync(program, { minify: true, format: 'iife', target: 'es2022' }).code;
      } catch {
        fc.pre(false);
        return;
      }
      assert.equal(runOut(scriptEscape(bundled)), runOut(bundled), bundled);
    }),
    params(),
  );
});

test('htmlEscape output has no markup characters and decodes back to the text', () => {
  const decode = (s: string) => s.replace(/&(lt|gt|quot|#39|amp);/g, (_, e) => ({ lt: '<', gt: '>', quot: '"', '#39': "'", amp: '&' })[e as string]!);
  fc.assert(
    fc.property(fc.oneof(fc.string({ unit: 'binary' }), fc.string({ unit: fc.constantFrom('&', '<', '>', '"', "'", 'a', ';', '#', '\0') }), fc.integer(), fc.double(), fc.boolean(), fc.constant(null)), (value) => {
      const out = htmlEscape(value);
      assert.doesNotMatch(out, /[<>"']/);
      assert.doesNotMatch(out, /&(?!(lt|gt|quot|#39|amp);)/);
      assert.equal(decode(out), String(value));
    }),
    params(),
  );
});

test('snapshotFileName is the 16-hex-digit prefix of the key hash, so never index.json', () => {
  fc.assert(
    fc.property(fc.string({ unit: 'binary' }), (a) => {
      assert.match(snapshotFileName(a), /^[0-9a-f]{16}\.json$/);
      assert.equal(snapshotFileName(a), hash(a).slice(0, 16) + '.json');
    }),
    params(),
  );
});

test('snapshotFileName gives different keys different files', () => {
  fc.assert(
    fc.property(fc.string({ unit: 'binary' }), fc.string({ unit: 'binary' }), (a, b) => {
      fc.pre(a !== b);
      assert.notEqual(snapshotFileName(a), snapshotFileName(b));
    }),
    params(),
  );
});

// ---- tools/lib/explain-check.ts: lintConstruct -----------------------------------

type Stmt =
  | { k: 'await' | 'forAwait' | 'sync' | 'catchCall' }
  | { k: 'fn'; body: Stmt[] }
  | { k: 'try'; body: Stmt[]; handler: 'catch' | 'finally' | 'both'; recover: Stmt[] };
const stmts: fc.Arbitrary<Stmt[]> = fc.letrec<{ list: Stmt[]; stmt: Stmt }>((tie) => ({
  stmt: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.record({ k: fc.constantFrom('await' as const, 'forAwait' as const, 'sync' as const, 'catchCall' as const) }),
    fc.record({ k: fc.constant('fn' as const), body: tie('list') }),
    fc.record({ k: fc.constant('try' as const), body: tie('list'), handler: fc.constantFrom('catch' as const, 'finally' as const, 'both' as const), recover: tie('list') }),
  ),
  list: fc.array(tie('stmt'), { maxLength: 3 }),
})).list;
const render = (list: Stmt[]): string =>
  list
    .map((s) => {
      if (s.k === 'await') return "await this.step('s');";
      if (s.k === 'forAwait') return 'for await (const x of this.items()) { model.push(x); }';
      if (s.k === 'sync') return 'model.push(1);';
      if (s.k === 'catchCall') return 'await this.play(x).catch(() => {});';
      if (s.k === 'fn') return `const f = async () => { ${render(s.body)} };`;
      if (s.k !== 'try') return '';
      const catchPart = s.handler === 'finally' ? '' : `catch (e) { ${render(s.recover)} }`;
      const finallyPart = s.handler === 'catch' ? '' : `finally { ${s.handler === 'finally' ? render(s.recover) : ''} }`;
      return `try { ${render(s.body)} } ${catchPart} ${finallyPart}`;
    })
    .join('\n');
/** Awaited by this function body (a nested function is not awaited by the code around it). */
const awaits = (list: Stmt[]): boolean =>
  list.some((s) => s.k === 'await' || s.k === 'forAwait' || s.k === 'catchCall' || (s.k === 'try' && (awaits(s.body) || awaits(s.recover))));
const expectedErrors = (list: Stmt[]): number =>
  list.reduce(
    (n, s) =>
      n +
      (s.k === 'catchCall' ? 1 : 0) +
      (s.k === 'fn' ? expectedErrors(s.body) : 0) +
      (s.k === 'try' ? (s.handler !== 'finally' && awaits(s.body) ? 1 : 0) + expectedErrors(s.body) + expectedErrors(s.recover) : 0),
    0,
  );
const constructForm = fc.constantFrom(
  (b: string) => `async construct() { ${b} }`,
  (b: string) => `async 'construct'() { ${b} }`,
  (b: string) => `async ['construct']() { ${b} }`,
  (b: string) => `construct = async () => { ${b} };`,
);

test('lintConstruct flags each catch around awaited construct code, however construct is spelled', () => {
  fc.assert(
    fc.property(stmts, constructForm, stmts, (body, form, other) => {
      const source = `class S extends Scene { ${form(render(body))}\n async helper() { ${render(other)} } }`;
      const errors = lintConstruct(source);
      assert.equal(errors.length, expectedErrors(body), source);
      for (const e of errors) assert.match(e, /StopScene/);
    }),
    params(),
  );
});

test('scale probe: escaping, keys, validation, edge lookup and the lint on very large inputs', { timeout: 120_000 }, async () => {
  const big = '</script><!-- '.repeat(400_000);
  assert.doesNotMatch(scriptEscape(big), /<\/script|<!--/i);
  assert.equal(htmlEscape('<&>"\''.repeat(1_000_000)).length, 1_000_000 * (4 + 5 + 4 + 6 + 5));
  assert.equal(exactHttpOrigin('https://example.test/' + 'a'.repeat(1_000_000)), null);
  const source = 'graph LR\n' + 'A-->B\n'.repeat(200_000);
  assert.equal(diagramKey({ source: source.replace(/\n/g, '\r\n') }), diagramKey({ source }));
  const s = fc.sample(randomSnapshot(), { numRuns: 1, seed: 1 })[0]!;
  const huge = JSON.parse(JSON.stringify(s)) as DiagramSnapshot;
  huge.parts.push({ id: 'big', role: 'node', kind: 'shape', shapes: [{ subpaths: [Array.from({ length: 6 * 100_000 + 2 }, (_, i) => i % 7)], closed: [false], style: { fill: '#000000', stroke: '#ffffff', strokeWidth: 0.01, fillOpacity: 1, strokeOpacity: 1, opacity: 1 } }] });
  assert.equal(await snapshotResolver({ [diagramKey(huge.spec)]: huge }).diagram(huge.spec), huge);
  const edges = Array.from({ length: 100_000 }, (_, i) => ({ from: 'n' + (i % 100), to: 'n' + ((i * 7) % 100) }));
  const g = { parts: [], findings: { layout: { edges }, warnings: Array.from({ length: 200 }, (_, i) => ({ code: 'W', edge: `${edges[i * 400]!.from}->${edges[i * 400]!.to}#${i * 400}` })) } } as unknown as DiagramSnapshot;
  assert.equal(findingsOfP(g).length, 200);
  let nested = "await this.step('x');";
  for (let i = 0; i < 300; i++) nested = `try { ${nested} } catch (e) {}`;
  assert.equal(lintConstruct(`class S { async construct() { ${nested} ${"model.push(1);".repeat(20_000)} } }`).length, 300);
});

test("an empty owner is refused: it named no part, yet reveal read it as one (FULL=1 counterexample)", async () => {
  await fc.assert(
    fc.asyncProperty(randomSnapshot().filter((s) => s.parts.length > 0), fc.nat(), async (s, k) => {
      const broken = mutate(s, ['parts', k % s.parts.length, 'owner'], '');
      await assert.rejects(snapshotResolver({ [diagramKey(s.spec)]: broken }).diagram(s.spec), /Invalid diagram snapshot/);
    }),
    params(),
  );
});
