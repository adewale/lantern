import { DomSink, renderAt, traceScene, SeekSink } from '../src/index.ts';
import type { Trace } from '../src/index.ts';
import { StopScene } from '../src/index.ts';
import { bindSnapshots, withSettings, resolveSettings } from '../explain/index.ts';
import type { ExplainerClass, Settings, SnapshotStore } from '../explain/index.ts';
import { restingTime, pictureHtml, pictureSummary } from '../explain/trace.ts';
import { reportHeight } from './embed-protocol.ts';
import { icon } from './embed-icons.ts';
import type { IconName } from './embed-icons.ts';
import { StageZoom } from './embed-zoom.ts';
import type { Zoom } from './embed-zoom.ts';
import { NARROW_PX, closeUps, stageScale, stepLayouts } from './embed-closeup.ts';
import type { StepLayout } from './embed-closeup.ts';
import { chromeFor, descriptionsLang, settingsProblem } from './embed-strings.ts';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
/** A button named for assistive technology; `text` shows a visible label beside the icon. */
function button(label: string, name: IconName, { text, className }: { text?: string; className?: string } = {}) {
  const b = el('button', undefined, className ?? (text ? 'button' : 'button icon'));
  b.type = 'button';
  b.setAttribute('aria-label', label);
  if (!text) b.title = label;
  b.append(icon(name));
  if (text) b.append(el('span', text));
  return b;
}
function setIcon(b: HTMLButtonElement, label: string, name: IconName) {
  b.setAttribute('aria-label', label);
  b.title = label;
  b.querySelector('svg')!.replaceWith(icon(name));
}

export async function mountEmbed(root: HTMLElement, Source: ExplainerClass, snapshots: SnapshotStore): Promise<void> {
  const params = new URLSearchParams(location.search);
  document.documentElement.dataset.theme = ['light', 'dark'].includes(params.get('theme') ?? '')
    ? params.get('theme')!
    : 'auto';
  const Bound = bindSnapshots(Source, snapshots);
  // The page's own words in the scene's language; so are the generated descriptions, where
  // explain/words.ts has the language (else they are English and marked so).
  const lang = Source.meta?.lang ?? 'en',
    t = chromeFor(lang);
  let values: Settings,
    trace: Trace,
    Active: ExplainerClass,
    wanted: Settings | undefined,
    selected = 0,
    generation = 0,
    loads = 0,
    playing = false,
    // On a narrow stage, whether each step opens on its close-up; Fit turns it off, Close-up on.
    follow = true;
  type Entry = { Scene: ExplainerClass; trace: Trace; layouts?: Promise<Map<string, StepLayout>>; resting: Map<string, Node[]> };
  const cache = new Map<string, Entry>();
  /** The case on show, with its layouts once a close-up has needed them. */
  let current: Entry | undefined;

  // Title, then the cases it can show: the choice sits next to what it changes.
  // The built page's heading is the title, so the live page says what the static one did.
  const title = el('h1', root.querySelector('h1')?.textContent ?? Source.meta?.title ?? '');
  const head = el('header', undefined, 'head');
  head.append(title);
  const choices = new Map<string, HTMLInputElement[]>();
  for (const s of Source.settings ?? []) {
    const group = el('fieldset', undefined, 'case');
    group.append(el('legend', s.label));
    const segments = el('div', undefined, 'segments');
    const inputs = s.options.map((o) => {
      const label = el('label'),
        input = el('input');
      input.type = 'radio';
      input.name = s.id;
      input.value = o.value;
      input.addEventListener('change', () => {
        // Keep the step the reader is on when the new case arrives, even if they moved while it loaded.
        if (input.checked) void load({ ...(wanted ?? values), [s.id]: o.value }, () => trace?.steps[selected]?.step, true);
      });
      label.append(input, el('span', o.label));
      segments.append(label);
      return input;
    });
    group.append(segments);
    head.append(group);
    choices.set(s.id, inputs);
  }

  // The player: the picture, what it says, and how to move on. Enlarge shows all three.
  const player = el('section', undefined, 'player');
  player.setAttribute('aria-label', t.player);
  const stage = el('div', undefined, 'stage');
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', title.textContent!);
  const poster = root.querySelector('svg');
  if (poster) stage.append(poster);
  stage.tabIndex = 0;
  const caption = el('p', undefined, 'caption');
  caption.setAttribute('aria-live', 'polite');
  // The resting picture in words, for readers who cannot see it or cannot read its labels:
  // a sentence or two as the stage's description, the full list under a disclosure. A
  // description must come from a hidden element, not a closed <details>, which computes empty.
  const summary = el('p'),
    described = el('details', undefined, 'described'),
    picture = el('div');
  summary.id = 'picture-summary';
  summary.hidden = true;
  const said = descriptionsLang(lang);
  if (said) summary.lang = picture.lang = said;
  described.append(el('summary', t.picture), picture);
  stage.setAttribute('aria-describedby', summary.id);
  const controls = el('nav', undefined, 'controls');
  controls.setAttribute('aria-label', t.controls);
  const prev = button(t.previous, 'previous'),
    next = button(t.nextLabel, 'next', { text: t.next, className: 'button primary' });
  next.append(next.querySelector('svg')!); // the arrow follows the word
  const tools = el('div', undefined, 'tools');
  const zoomOut = button(t.zoomOut, 'zoomOut'),
    zoomIn = button(t.zoomIn, 'zoomIn'),
    zoomFit = button(t.fit, 'fit'),
    replay = button(t.replay, 'replay'),
    copy = button(t.copy, 'link'),
    enlarge = button(t.enlarge, 'enlarge');
  enlarge.setAttribute('aria-pressed', 'false');
  // On a narrow stage, Fit shows the whole picture from then on; Close-up brings back a
  // close-up of each step.
  const closer = button(t.closeUp, 'closeUp');
  closer.hidden = true;
  tools.append(zoomOut, zoomIn, zoomFit, closer, replay, copy, ...(document.fullscreenEnabled ? [enlarge] : []));
  controls.append(prev, next, tools);
  const notice = el('p', undefined, 'notice');
  notice.setAttribute('role', 'status');
  // The stage and, over its corner on a narrow stage, the overview: a control outside the
  // stage, whose role of img makes everything inside it a picture.
  const frame = el('div', undefined, 'frame');
  player.append(frame, summary, caption, described, controls, notice);

  const steps = el('ol', undefined, 'steps');
  steps.setAttribute('aria-label', t.stepList);
  // The page's transcript holds every case; the player shows the current one, and its links move the player.
  const transcript = root.querySelector<HTMLDetailsElement>('.transcript')!;
  transcript.open = false;
  transcript.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('section a'),
      step = a && new URLSearchParams(a.search).get('step');
    if (!step || !trace) return;
    e.preventDefault();
    void show(trace.steps.findIndex((s) => s.step === step));
  });
  // Inside a frame, a way out to the full page; a standalone page needs none, and the
  // loader (which sets parentOrigin) already puts this link beside the frame.
  const standalone = el('a', t.newTab, 'standalone');
  standalone.target = '_blank';
  standalone.rel = 'noopener';
  const framed = window.parent !== window && !params.has('parentOrigin');
  root.replaceChildren(head, player, steps, transcript, ...(framed ? [standalone] : []));

  // A map of the whole picture over the stage's corner while a narrow stage is zoomed:
  // where the view is, and where the step changed. Pressing it moves to the step's next
  // close-up, so the reader can see every change in turn without hunting for it.
  const overview = el('button', undefined, 'overview'),
    map = el('span', undefined, 'map'),
    view = el('span', undefined, 'view');
  overview.type = 'button';
  overview.hidden = true;
  overview.append(map);
  frame.append(stage, overview);
  const narrow = () => stage.clientWidth > 0 && stage.clientWidth < NARROW_PX;
  let shownLayout: StepLayout | undefined,
    // The close-ups of the step on show, where it opened first; `stop` is the one last visited.
    tour: Zoom[] = [],
    stop = 0;
  function drawOverview() {
    const w = stage.clientWidth,
      h = stage.clientHeight,
      on = narrow() && zoom.k > 1;
    stage.classList.toggle('narrow', narrow());
    overview.hidden = !on;
    if (!on) return;
    overview.disabled = tour.length < 2;
    const label = t.nextCloseUp(((stop + 1) % Math.max(1, tour.length)) + 1, Math.max(1, tour.length));
    overview.setAttribute('aria-label', label);
    overview.title = label;
    const pc = (v: number) => `${(v * 100).toFixed(3)}%`;
    const place = (node: HTMLElement, left: number, top: number, width: number, height: number) =>
      Object.assign(node.style, { left: pc(left), top: pc(top), width: pc(width), height: pc(height) });
    place(view, -zoom.x / (zoom.k * w), -zoom.y / (zoom.k * h), 1 / zoom.k, 1 / zoom.k);
    const { s, ox, oy } = stageScale(w, h);
    const parts = (shownLayout?.parts ?? []).map((b) => {
      const part = el('span', undefined, 'part');
      place(part, (ox + (b[0] + 8) * s) / w, (oy + (4.5 - b[3]) * s) / h, ((b[2] - b[0]) * s) / w, ((b[3] - b[1]) * s) / h);
      return part;
    });
    map.replaceChildren(...parts, view);
  }
  overview.onclick = () => {
    if (tour.length < 2) return;
    stop = (stop + 1) % tour.length;
    zoom.to(tour[stop]!, true);
  };
  const zoom = new StageZoom(stage, () => {
    zoomOut.disabled = zoom.k <= 1;
    zoomIn.disabled = zoom.k >= zoom.max;
    zoomFit.hidden = zoom.k <= 1;
    closer.hidden = follow || !narrow();
    drawOverview();
  });
  zoomIn.onclick = () => zoom.zoomAt(1.6, undefined, undefined, true);
  zoomOut.onclick = () => zoom.zoomAt(1 / 1.6, undefined, undefined, true);
  /** The whole picture; on a narrow stage, for the steps that follow too. */
  const whole = (glide: boolean) => {
    if (narrow()) follow = false;
    zoom.reset(glide);
  };
  zoomFit.onclick = () => whole(true);
  closer.onclick = async () => {
    follow = true;
    const target = trace && (await framing(trace.steps[selected]!));
    if (target) zoom.to(target, true);
    else zoom.apply();
    // The button that was pressed hides; focus moves to the stage it changed.
    stage.focus();
  };
  reportHeight(root);

  function urlFor(): URL {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
    url.searchParams.set('step', trace.steps[selected]!.step);
    return url;
  }
  function link(push: boolean) {
    const url = urlFor();
    // Re-showing the step already in the address bar adds no history entry Back would have to skip.
    (push && url.href !== location.href ? history.pushState : history.replaceState).call(history, null, '', url);
    const out = new URL(url);
    out.searchParams.delete('parentOrigin');
    standalone.href = out.href;
  }
  function chrome() {
    const step = trace.steps[selected]!;
    caption.textContent = String(step.meta.caption ?? '');
    prev.disabled = selected === 0;
    next.disabled = selected === trace.steps.length - 1;
    for (const b of steps.querySelectorAll('button'))
      b.setAttribute('aria-current', b.dataset.step === step.step ? 'step' : 'false');
    stage.setAttribute('aria-label', t.stageLabel(title.textContent!, String(step.meta.title ?? step.step)));
    summary.textContent = pictureSummary(step.after);
    picture.innerHTML = pictureHtml(step.after);
    described.hidden = !picture.innerHTML;
    setIcon(replay, playing ? t.stop : t.replay, playing ? 'stop' : 'replay');
  }
  /**
   * The close-up a step opens on: on a narrow stage while close-ups are on, the zoom that
   * frames what the step changed (app/embed-closeup.ts); otherwise null, and the zoom keeps
   * its place. The case's layouts are worked out once, the first time a narrow stage needs
   * them. The step's other close-ups wait behind the overview, close-ups on or off.
   */
  async function framing(step: Trace['steps'][number]): Promise<Zoom | null> {
    const at = current,
      gen = generation;
    shownLayout = undefined;
    tour = [];
    stop = 0;
    if (!at || !narrow()) return null;
    at.layouts ??= stepLayouts(at.Scene);
    const layout = (await at.layouts).get(step.step);
    // A case or step shown while the layouts were worked out owns the overview now.
    if (gen !== generation || at !== current) return null;
    shownLayout = layout;
    tour = closeUps(layout, stage.clientWidth, stage.clientHeight, zoom.max);
    return follow ? tour[0]! : null;
  }
  function settle(step: Trace['steps'][number], target: Zoom | null) {
    if (target) zoom.to(target);
    else zoom.apply();
    root.classList.remove('loading');
    document.dispatchEvent(new CustomEvent('lantern:step', { detail: { step: step.step, settings: values } }));
    primeNext();
  }
  async function show(index: number, push = true) {
    if (!trace) return; // Controls exist before the first case has loaded.
    const gen = ++generation;
    playing = false;
    selected = Math.max(0, Math.min(trace.steps.length - 1, index));
    chrome();
    link(push);
    const step = trace.steps[selected]!;
    const at = current!,
      kept = at.resting.get(step.step);
    const container = el('div');
    const [, target] = await Promise.all([
      kept ? container.append(...kept.map((n) => n.cloneNode(true))) : renderAt(Active, restingTime(step, trace.fps), new DomSink(container, { realtime: false })),
      framing(step),
    ]);
    if (gen !== generation) return;
    if (!kept) at.resting.set(step.step, [...container.childNodes].map((n) => n.cloneNode(true)));
    // Reduced motion: no animation, but the old picture fades out over the new one, so the change is still seen.
    const old = reduced() ? stage.querySelector('svg') : null;
    old?.classList.add('leaving');
    old?.addEventListener('animationend', () => old.remove());
    stage.replaceChildren(...container.childNodes, ...(old ? [old] : []));
    settle(step, target);
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Forward the way the author wrote it: play the step, then rest on its last frame. */
  async function advance() {
    if (!trace || selected >= trace.steps.length - 1) return;
    if (reduced()) return show(selected + 1);
    selected += 1;
    link(true);
    await animate(true);
  }
  /** A run of one step's animation, held at the step's first frame until it is let go (or cancelled with null). */
  type Run = { at: Entry; index: number; release: (go: { gen: number; target: Zoom | null } | null) => void; done: Promise<boolean> };
  let primed: Run | undefined;
  /**
   * Run the scene to a step's first frame and wait there. Released, it plays the step until
   * the hold, then runs on undrawn to the step's resting frame (the one a link to it shows)
   * and draws that; `done` says whether it got there.
   */
  function prepare(at: Entry, index: number): Run {
    const step = at.trace.steps[index]!,
      start = step.t0,
      // Stop when the picture stops: the caption-reading hold is for video; here the reader sets the pace.
      end = step.hold ?? step.t1 ?? at.trace.duration,
      rest = restingTime(step, at.trace.fps);
    const container = el('div'),
      seek = new SeekSink(new DomSink(container), start);
    let release!: Run['release'];
    const gate = new Promise<Parameters<Run['release']>[0]>((r) => (release = r));
    let go: Parameters<Run['release']>[0] | undefined,
      attached = false,
      rested = false;
    const attach = (g: NonNullable<typeof go>) => {
      stage.replaceChildren(...container.childNodes);
      zoom.apply();
      // The view glides to the step's close-up as the step begins, so the change is watched.
      if (!attached && g.target) requestAnimationFrame(() => g.gen === generation && zoom.to(g.target!, true));
      attached = true;
    };
    const done = new at.Scene(
      {
        // Until released, yield at each step boundary, so a tap never waits behind the whole run.
        async stepBegin() {
          if (go === undefined) await new Promise((r) => setTimeout(r));
        },
        async frame(scene, dt) {
          if (scene.time + 1e-9 < start) return; // before the step: dropped, as SeekSink drops it
          if (dt === 0 && scene.mobjects.length === 0) return; // Keep the poster until a meaningful first frame.
          if (go === undefined) go = await gate;
          if (!go || go.gen !== generation) throw new StopScene();
          if (scene.time > end + 1e-8) {
            if (scene.time + 1e-9 < rest) return;
            // Drawn afresh, as a link to the step draws it, so the two are the same picture.
            await new DomSink(container, { realtime: false }).frame(scene, 0);
            attach(go);
            rested = true;
            throw new StopScene();
          }
          await seek.frame(scene, dt);
          if (go.gen !== generation) throw new StopScene(); // superseded while that frame was drawn
          if (!attached) attach(go);
        },
      },
      { skipUntil: start },
    )
      .run()
      .then(() => rested);
    return { at, index, release, done };
  }
  /** Once the reader is on a step, run the scene to the next one, so Next starts at once. */
  function primeNext() {
    primed?.release(null);
    primed = undefined;
    const at = current,
      index = selected + 1,
      gen = generation;
    if (!at || index >= at.trace.steps.length || reduced()) return;
    setTimeout(() => {
      if (gen !== generation || at !== current || primed) return;
      primed = prepare(at, index);
      primed.done.catch(() => {}); // reported when it is used
    });
  }
  async function animate(force = false) {
    if (!trace) return;
    if (playing && !force) return show(selected, false);
    if (reduced()) {
      notice.textContent = t.reducedMotion;
      return show(selected, false);
    }
    const gen = ++generation;
    playing = true;
    chrome();
    const at = current!,
      step = trace.steps[selected]!;
    const run = primed?.at === at && primed.index === selected ? primed : prepare(at, selected);
    if (run !== primed) primed?.release(null);
    primed = undefined;
    const target = await framing(step);
    run.release(gen === generation ? { gen, target } : null);
    const rested = await run.done;
    if (gen !== generation) return;
    if (!rested) return show(selected, false);
    at.resting.set(step.step, [...stage.childNodes].filter((n) => n.nodeName === 'svg').map((n) => n.cloneNode(true)));
    playing = false;
    chrome();
    settle(step, null);
  }
  /**
   * Show a case. Until its trace is ready the player keeps showing (and linking to) the
   * case it has, so navigation meanwhile stays consistent; a newer load supersedes this one.
   * `step` may be a function, read when the case arrives.
   */
  async function load(request: Settings, step?: string | (() => string | undefined), push = false) {
    const token = ++loads;
    root.classList.add('loading');
    let next: Settings,
      fallback = '';
    try {
      next = resolveSettings(Source, request);
    } catch (error) {
      next = resolveSettings(Source);
      fallback = t.fallback(settingsProblem(Source, request, error));
    }
    wanted = next;
    for (const [id, inputs] of choices) for (const input of inputs) input.checked = input.value === next[id];
    const key = JSON.stringify(next);
    let entry = cache.get(key);
    if (!entry) {
      const Scene = withSettings(Bound, next);
      entry = { Scene, trace: await traceScene(Scene), resting: new Map() };
      cache.set(key, entry);
    }
    if (token !== loads) return;
    const name = typeof step === 'function' ? step() : step;
    // Zoom keeps its place across steps, including Back and Forward within a case.
    const changed = !values || JSON.stringify(values) !== key;
    values = next;
    wanted = undefined;
    current = entry;
    Active = entry.Scene;
    trace = entry.trace;
    if (changed) zoom.reset();
    selected = name ? trace.steps.findIndex((s) => s.step === name) : 0;
    // A previous case's fallback must not describe the restored case; both of this one's show.
    const notices = fallback ? [fallback] : [];
    if (selected < 0) {
      selected = 0;
      notices.push(t.noStep(name!));
    }
    notice.textContent = notices.join(' ');
    steps.replaceChildren(
      ...trace.steps.map((s, i) => {
        const li = el('li'),
          b = el('button', String(s.meta.title ?? s.step));
        b.type = 'button';
        b.dataset.step = s.step;
        b.addEventListener('click', () => void show(i));
        li.append(b);
        return li;
      }),
    );
    const shown = new URLSearchParams(values).toString();
    for (const section of transcript.querySelectorAll<HTMLElement>('section')) section.hidden = section.dataset.case !== shown;
    await show(selected, push);
  }
  prev.onclick = () => void show(selected - 1);
  next.onclick = () => void advance();
  replay.onclick = () => void animate();
  enlarge.onclick = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await player.requestFullscreen();
      // Phones read a 16:9 stage best sideways; not every browser allows the lock.
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await orientation.lock?.('landscape').catch(() => {});
    }
  };
  document.addEventListener('fullscreenchange', () => {
    const on = document.fullscreenElement === player;
    setIcon(enlarge, on ? t.exitFullScreen : t.enlarge, on ? 'fit' : 'enlarge');
    enlarge.setAttribute('aria-pressed', String(on));
    zoom.apply();
  });
  copy.onclick = async () => {
    if (!trace) return;
    const url = urlFor();
    url.searchParams.delete('parentOrigin');
    try {
      await navigator.clipboard.writeText(url.href);
      notice.textContent = t.copied;
    } catch {
      notice.textContent = url.href;
    }
  };
  root.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SUMMARY'].includes(tag) || e.ctrlKey || e.metaKey) return;
    // Zoom keys act only on the focused stage, so they never take a key from the page; once
    // zoomed, the focused stage's arrows pan, a tenth of the stage at a time.
    const onStage = e.target === stage,
      pan = (dx: number, dy: number) => () => zoom.pan((dx * stage.clientWidth) / 10, (dy * stage.clientHeight) / 10);
    const keys: Record<string, () => void> =
      onStage && zoom.k > 1
        ? { ArrowLeft: pan(1, 0), ArrowRight: pan(-1, 0), ArrowUp: pan(0, 1), ArrowDown: pan(0, -1) }
        : {
            ArrowRight: () => void advance(),
            // Like the Previous button, which is disabled on the first step.
            ArrowLeft: () => void (selected > 0 && show(selected - 1)),
          };
    if (onStage)
      Object.assign(keys, {
        '+': () => zoom.zoomAt(1.6),
        '=': () => zoom.zoomAt(1.6),
        '-': () => zoom.zoomAt(1 / 1.6),
        '0': () => whole(false),
      });
    const action = keys[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  });
  // Focusable for the arrow keys once clicked, but not a Tab stop: its focus is not drawn.
  root.tabIndex = -1;
  const fromURL = () => {
    const q = new URLSearchParams(location.search);
    const request: Record<string, string> = {};
    for (const s of Source.settings ?? []) if (q.has(s.id)) request[s.id] = q.get(s.id)!;
    return { request, step: q.get('step') ?? undefined };
  };
  window.addEventListener('popstate', () => {
    const q = fromURL();
    void load(q.request, q.step);
  });
  const q = fromURL();
  await load(q.request, q.step);
}
