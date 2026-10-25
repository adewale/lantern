import { Scene, Text } from '../../../src/index.ts';
import type { Box } from '../../../src/index.ts';
import { stage, settingsOf } from '../../../explain/index.ts';
import type { Diagram } from '../../../explain/index.ts';
import { SINGLES, WRAPS, build, nameOf, isSend, isSync, quadrantOf, threads } from '../lib/send-sync.ts';
import type { Inner, Wrapper, Quadrant, Layer } from '../lib/send-sync.ts';

// Sources, all at rust-lang/rust tag 1.99.1 unless named otherwise; lines are quoted in lib/send-sync.ts
// and test/explain-send-sync.test.ts.
const RUST = 'https://github.com/rust-lang/rust/blob/1.99.1/library/';
const REFERENCE = 'https://github.com/rust-lang/reference/blob/d9d9ed57a120e3c87033fd598f191bbb84aad097/src/types/closure.md';
const NOMICON = 'https://github.com/rust-lang/nomicon/blob/60ed8f3bb9d22a60865197a0ac74911436703430/src/send-and-sync.md';

// Phone legibility sets every size here. A label needs 39.4 px on a 1280 px stage to be 12 px on a
// 390 px phone, so native text is 0.5 units (40 px). The chart's labels are 20 px in a 696 px chart and
// reach that size when the camera frames one quadrant; the axis labels are 48 px of a 696 px chart, so
// they read in the whole chart, and stand 16 px further off the plot than usual so that none of them
// shows at the edge of a framed quadrant. The plot is 569 px, so a quadrant (284 px) holds the longest name,
// "x is Arc<Mutex<Cell<i32>>>", to the right of its point.
const SIZE = 0.5;
const HEAD =
  '---\nconfig:\n  quadrantChart:\n    chartWidth: 696\n    chartHeight: 680\n    pointLabelFontSize: 20\n    quadrantLabelFontSize: 32\n    xAxisLabelFontSize: 48\n    yAxisLabelFontSize: 48\n    yAxisLabelPadding: 12\n---\n';
// Every point sits at one fixed spot per quadrant: at the left edge, so its name fits to its right, and
// below the quadrant's own name, which Mermaid centres in it.
// Mermaid's quadrant numbers, with x = Send and y = Sync: 1 both, 2 Sync only, 3 neither, 4 Send only.
const SPOT: Record<Quadrant, [number, number]> = { 1: [0.52, 0.625], 2: [0.02, 0.625], 3: [0.02, 0.125], 4: [0.52, 0.125] };
const QUADRANT: Record<Quadrant, string> = { 1: 'Send and Sync', 2: 'Sync only', 3: 'Neither', 4: 'Send only' };
const chart = (points: readonly { name: string; q: Quadrant }[]) =>
  HEAD +
  'quadrantChart\n  x-axis Not Send --> Send\n  y-axis Not Sync --> Sync\n' +
  ([1, 2, 3, 4] as const).map((n) => `  quadrant-${n} ${QUADRANT[n]}\n`).join('') +
  points.map((p) => `  ${p.name}: [${SPOT[p.q][0]}, ${SPOT[p.q][1]}]\n`).join('');

// The chart takes the left half; words take the right.
const LEFT: Box = [-7.55, -4.25, -0.05, 3.25];
const RIGHT: Box = [0.45, -4.25, 7.55, 3.05];
const ZOOM = 1.25;

const WRAPPER_LABEL: Record<Wrapper, string> = { arc: 'Arc<T>', mutex: 'Mutex<T>', 'arc-mutex': 'Arc<Mutex<T>>' };
const yesNo = (b: boolean) => (b ? 'yes' : 'no');
const traits = (send: boolean, sync: boolean) =>
  send && sync ? 'Send and Sync' : send ? 'Send but not Sync' : sync ? 'Sync but not Send' : 'neither Send nor Sync';
// The Agentic Mermaid verifier strips anything between < and > from a label before it compares it
// with the drawing, so a name that starts with a nested generic fails capture, and its edit operations
// refuse a point name with a colon. A name for a value, "x is ...", starts with a plain word. The
// scene's last step is about a value x of the built type.
const valueName = (type: string) => `x is ${type}`;

export default class SendSyncExplainer extends Scene {
  static meta = {
    id: 'send-sync',
    title: 'Arc<T> is Send and Sync only when T already is',
    sources: [
      RUST + 'alloc/src/sync.rs#L284-L286',
      RUST + 'alloc/src/rc.rs#L334-L342',
      RUST + 'core/src/cell.rs#L320-L328',
      RUST + 'std/src/sync/poison/mutex.rs#L233-L294',
      RUST + 'core/src/marker.rs#L69-L105',
      RUST + 'core/src/marker.rs#L513-L548',
      RUST + 'std/src/thread/functions.rs#L125-L129',
      RUST + 'std/src/thread/scoped.rs#L201-L204',
      REFERENCE + '#L729-L734',
      NOMICON + '#L8-L29',
    ],
  };
  static settings = [
    {
      id: 'wrapper',
      label: 'Wrapper',
      default: 'arc',
      options: [
        { value: 'arc', label: 'Arc<T>' },
        { value: 'mutex', label: 'Mutex<T>' },
        { value: 'arc-mutex', label: 'Arc<Mutex<T>>' },
      ],
    },
    {
      id: 'inner',
      label: 'T',
      default: 'cell',
      options: [
        { value: 'i32', label: 'i32' },
        { value: 'cell', label: 'Cell<i32>' },
        { value: 'rc', label: 'Rc<i32>' },
      ],
    },
  ];

  override async construct() {
    const values = settingsOf(this);
    const wrapper = values.wrapper as Wrapper,
      inner = values.inner as Inner;
    const s = stage(this, { style: 'hand-drawn', headingSize: 0.5 });
    const ink = s.palette.ink;

    /** Lines of text at the reader's size, wrapped to the right column, from `top` down. */
    const lines = (rows: readonly (string | { text: string; head: true })[], top: number) => {
      const out: Text[] = [];
      let y = top - SIZE * 0.6;
      for (const row of rows) {
        const head = typeof row !== 'string';
        const words = (head ? row.text : row).split(' ');
        let line = '';
        const flush = () => {
          out.push(
            new Text(line, {
              fontSize: SIZE,
              color: head ? s.emphasis : ink,
              weight: head ? 'bold' : 'normal',
              anchor: 'start',
            }).moveTo([RIGHT[0] + 0.1, y], [-1, 0]),
          );
          y -= SIZE * 1.45;
          line = '';
        };
        for (const w of words) {
          const next = line ? line + ' ' + w : w;
          if (line && new Text(next, { fontSize: SIZE }).width() > RIGHT[2] - RIGHT[0] - 0.2) flush();
          line = line ? line + ' ' + w : w;
        }
        flush();
      }
      return out;
    };
    /** A card at the top of the right column, with lines under it. */
    const column = async (rows: readonly (readonly [string, string])[], words: readonly string[], title?: string) => {
      const card = await s.card(rows, { at: RIGHT, align: 'top', fontSize: SIZE, enter: false, ...(title ? { title } : {}) });
      // Left-aligned with the lines under it.
      card.shift([RIGHT[0] + 0.1 - card.box()![0], 0]);
      const text = lines(words, RIGHT[3] - card.height() - 0.35);
      await s.enter(card, ...text);
      return card;
    };

    // ------------------------------------------------------------------ the two questions
    await this.step('questions', {
      title: 'Send and Sync are two separate questions',
      caption:
        'Send asks whether a value can move to another thread. Sync asks whether several threads can hold a shared reference to it at once: the standard library defines T as Sync exactly when &T is Send. The compiler answers both for every type, so each type falls in one of four quadrants.',
    });
    const singles = SINGLES.map((type) => ({ name: nameOf(type), q: quadrantOf(type), send: isSend(type), sync: isSync(type) }));
    const d = await s.show({ source: chart(singles) }, { box: LEFT, build: 'frame' });
    await d.reveal(([1, 2, 3, 4] as const).map((n) => `quadrant-label:${n}`));
    await s.enter(
      ...lines(
        [
          { text: 'Send', head: true },
          'Can a value move to another thread?',
          { text: 'Sync', head: true },
          'Can two threads share a &T to it at once?',
        ],
        RIGHT[3],
      ),
    );
    this.state.singles = Object.fromEntries(singles.map((p) => [p.name, { send: p.send, sync: p.sync }]));

    // ------------------------------------------------------------------ one type per quadrant
    const SINGLE_STEPS: Record<string, { id: string; title: string; caption: string; source: string }> = {
      i32: {
        id: 'i32',
        title: 'i32 is Send and Sync',
        // marker.rs:92 and :657 declare both as auto traits; :521 says primitive types are Sync;
        // the Nomicon (lines 20-23) says almost all primitives are Send and Sync.
        caption:
          'Send and Sync are auto traits: the compiler gives them to any type built only from parts that have them. Primitives such as i32 have both, so i32 sits in the top-right quadrant. Each point sits at one fixed spot in its quadrant, so only the quadrant carries meaning.',
        source: 'Both are auto traits.',
      },
      'Rc<i32>': {
        id: 'rc',
        title: 'Rc<i32> is neither Send nor Sync',
        // marker.rs:74-79: two threads cloning Rcs to one value could update the count at once,
        // undefined behaviour because Rc does not use atomic operations. rc.rs:334 and :342.
        caption:
          'Rc counts its owners with a plain integer, not an atomic one. Two threads cloning Rcs that share one count could update it at the same moment, which is undefined behaviour. So rc.rs declares Rc neither Send nor Sync, whatever it holds.',
        source: 'See rc.rs:334, 342.',
      },
      'Cell<i32>': {
        id: 'cell',
        title: 'Cell<i32> can move but cannot be shared',
        // marker.rs:541-548: Cell::set takes &self and performs no synchronization, so Cell cannot
        // be Sync. cell.rs:320 Send where T: Send; cell.rs:328 !Sync.
        caption:
          'Cell::set takes &self and does no synchronisation, so two threads holding &Cell could write to it at once. That is why cell.rs makes Cell not Sync. It still makes Cell<T> Send whenever T is, so a whole Cell can move to another thread.',
        source: 'See cell.rs:320, 328.',
      },
      'MutexGuard<i32>': {
        id: 'guard',
        title: 'MutexGuard<i32> can be shared but cannot move',
        // mutex.rs:282-289: not Send because with POSIX threads a lock must be released on the thread
        // that acquired it. mutex.rs:291-294: Sync if T: Sync, because &MutexGuard gives &T.
        caption:
          'Dropping a MutexGuard unlocks its mutex, and with POSIX threads a lock must be released on the thread that took it, so mutex.rs makes the guard not Send. A shared &MutexGuard gives out &i32, so mutex.rs makes the guard Sync when the value inside is Sync.',
        source: 'See mutex.rs:289, 294.',
      },
    };
    for (const p of singles) {
      const meta = SINGLE_STEPS[p.name]!;
      await this.step(meta.id, { title: meta.title, caption: meta.caption });
      await s.clearOverlays();
      await d.reveal([`point:${p.name}`, `point:${p.name}:label`]);
      await d.focus([`plate:${p.q}`], { zoom: ZOOM });
      await column(
        [
          ['Send', yesNo(p.send)],
          ['Sync', yesNo(p.sync)],
        ],
        [meta.source, ...(p.name === 'i32' ? ['Only the quadrant counts: a point’s place inside it means nothing.'] : [])],
      );
      this.state.shown = p.name;
    }

    // ------------------------------------------------------------------ the wrapper rules
    const layers = build(wrapper, inner);
    const ctors = WRAPS[wrapper];
    await this.step('rules', {
      title: 'Arc needs Send and Sync inside; Mutex needs Send',
      // sync.rs:135-147: Arc gives shared ownership of the data but adds no thread safety to it.
      // mutex.rs:240-256: Mutex gives one thread at a time access to T, so T need not be Sync.
      caption:
        'Arc<T> is Send or Sync only when T is both: clones of one Arc on several threads all reach the same T, and Arc adds no thread safety to it. Mutex<T> needs only T: Send, because its lock lets one thread at a time use the value. The lines omit ?Sized and the allocator.',
    });
    await s.clear();
    const code = await s.code(
      [
        '// alloc/src/sync.rs:284, 286',
        'unsafe impl<T: Send + Sync> Send for Arc<T> {}',
        'unsafe impl<T: Send + Sync> Sync for Arc<T> {}',
        '// std/src/sync/poison/mutex.rs:238, 257',
        'unsafe impl<T: Send> Send for Mutex<T> {}',
        'unsafe impl<T: Send> Sync for Mutex<T> {}',
      ],
      { at: [-7.55, -2.6, 7.55, 3.05], fontSize: SIZE },
    );
    await code.focus(wrapper === 'arc' ? [1, 2] : wrapper === 'mutex' ? [4, 5] : [1, 5], {
      as: wrapper === 'arc-mutex' ? 'both wrappers' : 'this wrapper',
    });
    await s.note(`Highlighted: the rules for ${WRAPPER_LABEL[wrapper]}`, { at: [0, -3.4], size: SIZE });
    this.state.layers = layers;

    // ------------------------------------------------------------------ built from the inside out
    let q: Diagram | null = null;
    let points: { name: string; q: Quadrant }[] = [{ name: layers[0]!.name, q: layers[0]!.quadrant }];
    for (let i = 1; i < layers.length; i++) {
      const was = layers[i - 1]!,
        now: Layer = layers[i]!,
        ctor = ctors[i - 1]!;
      const needs = ctor === 'Arc' ? 'both Send and Sync' : 'Send';
      const moved = was.quadrant !== now.quadrant;
      const why =
        ctor === 'Mutex' && now.sync && !was.sync
          ? ' The lock lets one thread at a time reach the value, so Mutex adds Sync.'
          : ctor === 'Arc' && !now.send && was.send
            ? ' Clones of one Arc on several threads would all reach the one value.'
            : '';
      await this.step(`wrap-${ctor.toLowerCase()}`, {
        title: `${now.name} is ${traits(now.send, now.sync)}`,
        caption:
          `Wrapping ${was.name} in ${ctor} gives ${now.name}. ${ctor} needs the type inside to be ${needs}, and ${was.name} is ${traits(was.send, was.sync)}, so ${now.name} is ${traits(now.send, now.sync)}.${why} ` +
          (moved
            ? `The point moves from “${QUADRANT[was.quadrant]}” to “${QUADRANT[now.quadrant]}”.`
            : `The point stays in “${QUADRANT[now.quadrant]}”.`),
      });
      await s.clearOverlays();
      if (!q) q = await s.show({ source: chart(points) }, { box: LEFT });
      const from = i === 1 ? was.name : valueName(was.name),
        to = valueName(now.name);
      points = [{ name: to, q: was.quadrant }];
      await q.morph({ source: chart(points) }, { ops: [{ kind: 'rename_point', from, to }] });
      if (moved) {
        points = [{ name: to, q: now.quadrant }];
        const [x, y] = SPOT[now.quadrant];
        await q.morph({ source: chart(points) }, { ops: [{ kind: 'move_point', label: to, x, y }] });
      }
      await q.focus([`plate:${now.quadrant}`], { zoom: ZOOM });
      await column(
        [
          ['Send', yesNo(now.send)],
          ['Sync', yesNo(now.sync)],
        ],
        [`${ctor} needs T: ${ctor === 'Arc' ? 'Send + Sync' : 'Send'}`, `T here: ${was.name}`],
      );
      this.state.built = now;
    }

    // ------------------------------------------------------------------ what the thread APIs accept
    const run = threads(wrapper, inner);
    const both = run.spawnMove && run.scopeBorrow,
      none = !run.spawnMove && !run.scopeBorrow;
    await this.step('threads', {
      title: both
        ? 'Both thread APIs accept x'
        : none
          ? 'Neither thread API accepts x'
          : run.spawnMove
            ? 'thread::spawn accepts x; thread::scope cannot share it'
            : 'thread::scope can share x; thread::spawn cannot take it',
      // functions.rs:125-129: spawn needs F: Send + 'static. scoped.rs:201-204: Scope::spawn needs
      // F: Send + 'scope. The Reference (types/closure.md:734): a closure is Send if values it captures
      // by shared reference are Sync and values it captures by move are Send (marker.rs:105, :537).
      caption: `thread::spawn needs a Send closure, and a move closure that owns x is Send only if ${run.name} is. thread::scope lets threads borrow &x instead, and a closure holding &x is Send only if ${run.name} is Sync. rustc 1.99.1 ${
        both ? 'accepts both' : none ? 'rejects both' : run.spawnMove ? 'accepts the move and rejects the borrow' : 'accepts the borrow and rejects the move'
      } for x: ${run.name}.`,
    });
    await s.clearOverlays();
    await q!.mark([`point:${valueName(run.name)}`], { color: both ? s.good : s.bad, as: both ? 'accepted' : 'rejected' });
    await column(
      [
        ['thread::spawn', yesNo(run.spawnMove)],
        ['thread::scope', yesNo(run.scopeBorrow)],
      ],
      ['spawn needs x: Send', 'scope needs x: Sync'],
      'Compiles?',
    );
    this.state.threads = run;
  }
}
