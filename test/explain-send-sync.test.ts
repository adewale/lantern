// The send-sync explainer's evaluator, held to the Rust standard library's impl lines and to rustc.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fc, params } from './lib/pbt.ts';
import { RULES, t, isSend, isSync, nameOf, build, threads, quadrantOf } from '../scenes/explainers/lib/send-sync.ts';
import type { Ctor, Needs, RustType } from '../scenes/explainers/lib/send-sync.ts';

// Copied verbatim from rust-lang/rust at tag 1.99.1 (commit 213cfbe66a6da4e4b41bde365643286371af6e5a),
// https://github.com/rust-lang/rust/tree/1.99.1/library, with file and line.
const SOURCE = [
  ['alloc/src/sync.rs:284', 'unsafe impl<T: ?Sized + Sync + Send, A: Allocator + Send> Send for Arc<T, A> {}'],
  ['alloc/src/sync.rs:286', 'unsafe impl<T: ?Sized + Sync + Send, A: Allocator + Sync> Sync for Arc<T, A> {}'],
  ['alloc/src/rc.rs:334', 'impl<T: ?Sized, A: Allocator> !Send for Rc<T, A> {}'],
  ['alloc/src/rc.rs:342', 'impl<T: ?Sized, A: Allocator> !Sync for Rc<T, A> {}'],
  ['core/src/cell.rs:320', 'unsafe impl<T: ?Sized> Send for Cell<T> where T: Send {}'],
  ['core/src/cell.rs:328', 'impl<T: ?Sized> !Sync for Cell<T> {}'],
  ['std/src/sync/poison/mutex.rs:238', 'unsafe impl<T: ?Sized + Send> Send for Mutex<T> {}'],
  ['std/src/sync/poison/mutex.rs:257', 'unsafe impl<T: ?Sized + Send> Sync for Mutex<T> {}'],
  ['std/src/sync/poison/mutex.rs:289', "impl<T: ?Sized> !Send for MutexGuard<'_, T> {}"],
  ['std/src/sync/poison/mutex.rs:294', "unsafe impl<T: ?Sized + Sync> Sync for MutexGuard<'_, T> {}"],
  ['core/src/marker.rs:105', 'unsafe impl<T: Sync + PointeeSized> Send for &T {}'],
] as const;

/** What one impl line says a type needs of T for one trait. Allocator bounds are left out: the default, Global, is Send and Sync. */
function readImpl(line: string): { ctor: Ctor; trait: 'send' | 'sync'; needs: Needs } {
  const m = /^(?:unsafe )?impl<(.*?)> (!?)(Send|Sync) for (&T|\w+)(?:<.*?>)?(?: where (.*?))? \{\}$/.exec(line);
  assert.ok(m, line);
  const [, generics, negative, trait, self, where] = m;
  const bounds = [generics!, where ?? '']
    .flatMap((g) => g.split(/,\s*(?=[A-Z]:)/))
    .filter((b) => /^T:/.test(b.trim()))
    .flatMap((b) => b.replace(/^\s*T:/, '').split('+').map((x) => x.trim()));
  const send = bounds.includes('Send'),
    sync = bounds.includes('Sync');
  return {
    ctor: (self === '&T' ? '&' : self) as Ctor,
    trait: trait!.toLowerCase() as 'send' | 'sync',
    needs: negative ? 'never' : send && sync ? 'send+sync' : send ? 'send' : sync ? 'sync' : 'always',
  };
}

test('the rule table is the standard library’s impl lines, read mechanically', () => {
  for (const [where, line] of SOURCE) {
    const { ctor, trait, needs } = readImpl(line);
    assert.equal(RULES[ctor][trait], needs, `${where}: ${line}`);
  }
  // Every rule the scene uses comes from a line above, except i32 (an auto trait with no impl line,
  // checked against rustc below) and Sync for &T, which the evaluator does not use.
  const read = new Set(SOURCE.map(([, line]) => `${readImpl(line).ctor}.${readImpl(line).trait}`));
  for (const ctor of Object.keys(RULES) as Ctor[])
    for (const trait of ['send', 'sync'] as const)
      if (ctor !== 'i32' && !(ctor === '&' && trait === 'sync')) assert.ok(read.has(`${ctor}.${trait}`), `${ctor}.${trait} has no source line`);
});

// rustc 1.99.1 (58cf8f9c3 2026-10-13), Docker image rust:1.99.1-slim
// (sha256:1a939748a7cbab172de91a014e3804a97af1394a8c844faa67fce9401c4e40fb), run once on 2026-10-25.
// Each answer is one file compiled with `rustc --edition 2024` after
//   use std::{cell::Cell, rc::Rc, sync::{Arc, Mutex, MutexGuard}, thread};
//   fn assert_send<T: Send>() {}  fn assert_sync<T: Sync>() {}
// Trait columns: `fn main() { assert_send::<TYPE>(); }` (and assert_sync). spawn:
// `let x: TYPE = VALUE; thread::spawn(move || drop(x)).join().unwrap();`. scope:
// `let x: TYPE = VALUE; thread::scope(|s| { let r = &x; s.spawn(move || { std::hint::black_box(r); });
// s.spawn(move || { std::hint::black_box(r); }); });`, the guard from `static M: Mutex<i32>`, `M.lock().unwrap()`.
// true: it compiled; false: it failed with error E0277 and no other error.
const RUSTC: readonly [string, send: boolean, sync: boolean, spawn: boolean, scope: boolean][] = [
  ['i32', true, true, true, true],
  ['Cell<i32>', true, false, true, false],
  ['Rc<i32>', false, false, false, false],
  ["MutexGuard<'static, i32>", false, true, false, true],
  ['Arc<i32>', true, true, true, true],
  ['Arc<Cell<i32>>', false, false, false, false],
  ['Arc<Rc<i32>>', false, false, false, false],
  ['Mutex<i32>', true, true, true, true],
  ['Mutex<Cell<i32>>', true, true, true, true],
  ['Mutex<Rc<i32>>', false, false, false, false],
  ['Arc<Mutex<i32>>', true, true, true, true],
  ['Arc<Mutex<Cell<i32>>>', true, true, true, true],
  ['Arc<Mutex<Rc<i32>>>', false, false, false, false],
];
function parse(rust: string): RustType {
  const s = rust.replace(/'static, /, '');
  if (s === 'i32') return t('i32');
  const m = /^(\w+)<(.*)>$/.exec(s);
  assert.ok(m, rust);
  return t(m[1] as Ctor, parse(m[2]!));
}

test('the evaluator gives rustc’s answers for every type the scene shows', () => {
  for (const [rust, send, sync, spawn, scope] of RUSTC) {
    const type = parse(rust);
    assert.equal(isSend(type), send, `${rust}: Send`);
    assert.equal(isSync(type), sync, `${rust}: Sync`);
    // Owning x in a move closure needs Send; two closures holding &x need &T: Send.
    assert.equal(isSend(type), spawn, `${rust}: thread::spawn`);
    assert.equal(isSend(t('&', type)), scope, `${rust}: thread::scope`);
  }
});

test('the nine cases, built inside out, end where rustc puts them', () => {
  const expected: Record<string, [string, boolean, boolean]> = {
    'arc/i32': ['Arc<i32>', true, true],
    'arc/cell': ['Arc<Cell<i32>>', false, false],
    'arc/rc': ['Arc<Rc<i32>>', false, false],
    'mutex/i32': ['Mutex<i32>', true, true],
    'mutex/cell': ['Mutex<Cell<i32>>', true, true],
    'mutex/rc': ['Mutex<Rc<i32>>', false, false],
    'arc-mutex/i32': ['Arc<Mutex<i32>>', true, true],
    'arc-mutex/cell': ['Arc<Mutex<Cell<i32>>>', true, true],
    'arc-mutex/rc': ['Arc<Mutex<Rc<i32>>>', false, false],
  };
  for (const [key, [name, send, sync]] of Object.entries(expected)) {
    const [w, i] = key.split('/') as [Parameters<typeof build>[0], Parameters<typeof build>[1]];
    const last = build(w, i).at(-1)!;
    assert.deepEqual([last.name, last.send, last.sync], [name, send, sync], key);
    assert.deepEqual(threads(w, i), { name, spawnMove: send, scopeBorrow: sync }, key);
    // The rustc table above holds every one of these.
    assert.ok(RUSTC.some(([r, s, y]) => r === name && s === send && y === sync), name);
  }
  // Mutex<Cell<i32>> moves from Send only to both; the inner type of a build is the first layer.
  assert.deepEqual(
    build('mutex', 'cell').map((l) => [l.name, l.quadrant]),
    [
      ['Cell<i32>', 4],
      ['Mutex<Cell<i32>>', 1],
    ],
  );
});

const anyType: fc.Arbitrary<RustType> = fc.letrec<{ type: RustType }>((tie) => ({
  type: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constant(t('i32')),
    fc.tuple(fc.constantFrom<Ctor>('Cell', 'Rc', 'Mutex', 'MutexGuard', 'Arc', '&'), tie('type')).map(([c, of]) => t(c, of)),
  ),
})).type;

test('Arc<T> is Send exactly when it is Sync, exactly when T is both: Arc adds neither trait', () => {
  fc.assert(
    fc.property(anyType, (inner) => {
      const arc = t('Arc', inner);
      assert.equal(isSend(arc), isSend(inner) && isSync(inner), nameOf(arc));
      assert.equal(isSync(arc), isSend(arc), nameOf(arc));
    }),
    params(),
  );
});

test('Mutex<T> is Send and Sync exactly when T is Send, so Arc<Mutex<T>> is too', () => {
  fc.assert(
    fc.property(anyType, (inner) => {
      const mutex = t('Mutex', inner),
        shared = t('Arc', mutex);
      assert.equal(isSend(mutex), isSend(inner), nameOf(mutex));
      assert.equal(isSync(mutex), isSend(inner), nameOf(mutex));
      assert.equal(isSend(shared) && isSync(shared), isSend(inner), nameOf(shared));
      assert.equal(quadrantOf(shared), isSend(inner) ? 1 : 3, nameOf(shared));
    }),
    params(),
  );
});

test('T is Sync exactly when &T is Send; Rc is never either; Cell and a MutexGuard each lack one', () => {
  fc.assert(
    fc.property(anyType, (inner) => {
      assert.equal(isSend(t('&', inner)), isSync(inner));
      assert.ok(!isSend(t('Rc', inner)) && !isSync(t('Rc', inner)));
      assert.equal(isSync(t('Cell', inner)), false);
      assert.equal(isSend(t('Cell', inner)), isSend(inner));
      assert.equal(isSend(t('MutexGuard', inner)), false);
      assert.equal(isSync(t('MutexGuard', inner)), isSync(inner));
    }),
    params(),
  );
});
