// Property tests for reportHeight (app/embed-protocol.ts) in Node, on fake
// browser globals: which heights it sends, to whom, and when it stops. The
// real cross-origin behaviour is tested in test/explain-embed.test.ts.
// Counts: test/lib/pbt.ts (FULL=1 is 10x).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fc, params } from './lib/pbt.ts';
import { reportHeight, exactHttpOrigin, resizeHeight, RESIZE_TYPE } from '../app/embed-protocol.ts';


type Listener = () => void;
/** Install a fake framed (or top-level) window; returns the triggers and the recorded posts. */
function fakeWindow(search: string, framed: boolean) {
  const g = globalThis as unknown as Record<string, unknown>;
  const posts: { msg: { type: unknown; version: unknown; height: number }; origin: string }[] = [];
  const doc: Record<string, Listener[]> = {},
    win: Record<string, Listener[]> = {};
  let observed: Listener | null = null;
  const on = (map: Record<string, Listener[]>) => (name: string, f: Listener) => (map[name] ??= []).push(f);
  const off = (map: Record<string, Listener[]>) => (name: string, f: Listener) => {
    map[name] = (map[name] ?? []).filter((x) => x !== f);
  };
  g.location = { search };
  g.window = g;
  g.parent = framed ? { postMessage: (msg: never, origin: string) => posts.push({ msg, origin }) } : g;
  g.addEventListener = on(win);
  g.removeEventListener = off(win);
  g.document = { addEventListener: on(doc), removeEventListener: off(doc) };
  g.ResizeObserver = class {
    constructor(cb: Listener) {
      observed = cb;
    }
    observe() {}
    disconnect() {
      observed = null;
    }
  };
  return {
    posts,
    resize: () => observed?.(),
    step: () => (doc['lantern:step'] ?? []).forEach((f) => f()),
    load: () => (win.load ?? []).forEach((f) => f()),
  };
}
// Measured heights: the full double domain (NaN, ±Infinity, negatives, fractions, huge).
const height = fc.oneof(fc.double(), fc.double({ min: 0, max: 200_000, noNaN: true }), fc.integer({ min: 0, max: 100_001 }));
const trigger = fc.constantFrom('resize' as const, 'step' as const, 'load' as const);
const events = fc.array(fc.tuple(height, trigger), { maxLength: 40 });
const origin = fc.webUrl().map((u) => new URL(u).origin);

test('reportHeight: posts exactly the measured heights rounded up, within 1..100000, each different from the last one posted', () => {
  fc.assert(
    fc.property(origin, height, events, (o, first, list) => {
      const w = fakeWindow('?' + new URLSearchParams({ parentOrigin: o }), true);
      let h = first;
      reportHeight({ getBoundingClientRect: () => ({ height: h }) } as HTMLElement);
      const expected: number[] = [];
      let last = 0;
      const measure = () => {
        const c = Math.ceil(h);
        if (c !== last && c >= 1 && c <= 100000) expected.push((last = c));
      };
      measure(); // the initial measurement
      for (const [next, how] of list) {
        h = next;
        w[how]();
        measure();
      }
      assert.deepEqual(w.posts.map((p) => p.msg.height), expected);
    }),
    params(),
  );
});

test('reportHeight: every message targets exactly the parentOrigin', () => {
  fc.assert(
    fc.property(origin, events, (o, list) => {
      const w = fakeWindow('?' + new URLSearchParams({ parentOrigin: o }), true);
      let h = 1;
      reportHeight({ getBoundingClientRect: () => ({ height: h }) } as HTMLElement);
      for (const [next, how] of list) {
        h = next;
        w[how]();
      }
      for (const p of w.posts) {
        assert.equal(p.origin, o);
      }
    }),
    params(),
  );
});

test('reportHeight: every message is one the host-side check accepts, carrying the height it measured', () => {
  fc.assert(
    fc.property(origin, events, (o, list) => {
      const w = fakeWindow('?' + new URLSearchParams({ parentOrigin: o }), true);
      let h = 1;
      reportHeight({ getBoundingClientRect: () => ({ height: h }) } as HTMLElement);
      for (const [next, how] of list) {
        h = next;
        w[how]();
      }
      const source = {} as MessageEventSource;
      for (const p of w.posts) {
        assert.equal(p.msg.type, RESIZE_TYPE);
        assert.equal(resizeHeight({ origin: o, source, data: p.msg }, o, source), p.msg.height);
      }
    }),
    params(),
  );
});

test('reportHeight: sends nothing when not framed, or when parentOrigin is missing or not an exact HTTP(S) origin', () => {
  const near = fc.oneof(
    fc.string({ unit: 'binary' }),
    origin.chain((o) => fc.constantFrom(o + '/', o + '/p', ' ' + o, o.toUpperCase(), '*', 'null', o.replace(/^https?:/, 'ftp:'))),
  );
  fc.assert(
    fc.property(fc.option(fc.oneof(near, origin), { nil: undefined }), fc.boolean(), events, (value, framed, list) => {
      fc.pre(!framed || value === undefined || exactHttpOrigin(value) === null);
      const w = fakeWindow(value === undefined ? '' : '?' + new URLSearchParams({ parentOrigin: value }), framed);
      let h = 10;
      reportHeight({ getBoundingClientRect: () => ({ height: h }) } as HTMLElement);
      for (const [next, how] of list) {
        h = next;
        w[how]();
      }
      assert.equal(w.posts.length, 0);
    }),
    { ...params(), maxSkipsPerRun: 100 },
  );
});

test('reportHeight: after the returned dispose, no resize, step or load sends anything', () => {
  fc.assert(
    fc.property(origin, events, events, (o, before, after) => {
      const w = fakeWindow('?' + new URLSearchParams({ parentOrigin: o }), true);
      let h = 1;
      const dispose = reportHeight({ getBoundingClientRect: () => ({ height: h }) } as HTMLElement);
      for (const [next, how] of before) {
        h = next;
        w[how]();
      }
      const sent = w.posts.length;
      dispose();
      for (const [next, how] of after) {
        h = next;
        w[how]();
      }
      assert.equal(w.posts.length, sent);
    }),
    params(),
  );
});
