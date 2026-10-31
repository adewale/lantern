import { renderAt, traceScene, SeekSink } from '../src/index.ts';
import type { Trace } from '../src/index.ts';
import { StopScene } from '../src/index.ts';
import { bindSnapshots, withSettings, resolveSettings } from '../explain/index.ts';
import type { ExplainerClass, Settings, SnapshotStore } from '../explain/index.ts';
import { restingTime, pictureHtml, pictureSummary, stepWords } from '../explain/trace.ts';
import { reportHeight } from './embed-protocol.ts';
import { icon } from './embed-icons.ts';
import type { IconName } from './embed-icons.ts';
import { ReaderSink, ReaderView, StageZoom } from './embed-zoom.ts';
import type { Zoom } from './embed-zoom.ts';
import { NARROW_PX, closeUps, stageScale, stepLayouts } from './embed-closeup.ts';
import type { StepLayout } from './embed-closeup.ts';
import { chromeFor, descriptionsLang, settingsProblem } from './embed-strings.ts';
import { SHARE_META, shareable } from './embed-share.ts';

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

export async function mountEmbed(root: HTMLElement, Source: ExplainerClass, snapshots: SnapshotStore,
  audio?: (stage: HTMLElement, frame: HTMLElement) => {set(value: unknown): void; stop(): void}): Promise<void> {
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
        // A scene may start each new case with its opening step; otherwise keep
        // the current step by name, read when the new case actually arrives.
        if (input.checked) void load({ ...(wanted ?? values), [s.id]: o.value },
          Source.meta?.caseNavigation === 'first' ? undefined : () => trace?.steps[selected]?.step, true);
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
  // On a narrow stage the heading the stage draws is too small to read, and a close-up
  // leaves it out, so the step's number, title and line show here as text.
  const lede = el('p', undefined, 'lede'),
    ledeTitle = el('strong'),
    ledeLine = el('span');
  lede.append(ledeTitle, ledeLine);
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
  // The step transport is visible before the picture on short screens too. Keep the
  // second set after the caption for readers who reach the end of the explanation.
  const transport = el('div', undefined, 'step-transport');
  transport.setAttribute('role', 'group');
  transport.setAttribute('aria-label', t.controls);
  const earlyPrev = button(t.previous, 'previous'),
    earlyNext = button(t.nextLabel, 'next', { text: t.nextLabel, className: 'button primary' });
  earlyNext.append(earlyNext.querySelector('svg')!);
  transport.append(earlyPrev, earlyNext);
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
  // Keep navigation outside the picture so controls cannot cover its lettering.
  const frame = el('div', undefined, 'frame');
  // Unseen copies of the caption and the lede, at their width and in their type, measure
  // every step's words so each keeps the room its case's longest needs: the steps list and
  // the transcript then stay put as the reader steps. They are not a .caption or a .lede,
  // so the page still has one of each.
  const ruler = el('p', undefined, 'ruler'),
    ledeRuler = el('p', undefined, 'lede-ruler');
  ruler.setAttribute('aria-hidden', 'true');
  ledeRuler.setAttribute('aria-hidden', 'true');
  // Keep the caption beside its picture; the controls after it follow immediately,
  // before disclosures and close-up controls can push the story's Next out of sight.
  player.append(transport, frame, lede, caption, controls, described, notice, summary, ruler, ledeRuler);

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

  // A map beside the picture while a narrow stage is zoomed:
  // where the view is, and where the step changed. Pressing it moves to the step's next
  // close-up, so the reader can see every change in turn without hunting for it.
  const overview = el('button', undefined, 'overview'),
    map = el('span', undefined, 'map'),
    view = el('span', undefined, 'view');
  overview.type = 'button';
  overview.hidden = true;
  overview.append(map);
  frame.append(stage);
  const sound=audio?.(stage,frame);
  // Keep view navigation separate from step navigation, after the story's Next.
  const views = el('div', undefined, 'view-controls'),
    viewCount = el('span'),
    nextView = el('button', t.nextView, 'button'),
    wholePicture = button(t.wholePicture, 'fit'),
    viewHelp = el('p', t.viewHelp, 'view-help');
  nextView.type = wholePicture.type = 'button';
  viewHelp.id = 'view-help';
  nextView.setAttribute('aria-describedby', viewHelp.id);
  viewCount.setAttribute('aria-live', 'polite');
  views.hidden = true;
  views.append(viewCount, nextView, wholePicture, overview, viewHelp);
  controls.after(views);
  const narrow = () => stage.clientWidth > 0 && stage.clientWidth < NARROW_PX;
  const revealStage = () => {
    if (!narrow()) return;
    const box = stage.getBoundingClientRect();
    if (box.top < 0 || box.bottom > innerHeight) stage.scrollIntoView({block: 'nearest'});
  };
  let shownLayout: StepLayout | undefined,
    caseLayouts: Map<string, StepLayout> | undefined,
    tourSize = '',
    caseHasTour = false,
    // The close-ups of the step on show, where it opened first; `stop` is the one last visited.
    tour: Zoom[] = [],
    stop = 0;
  function refreshTour() {
    const w = stage.clientWidth, h = stage.clientHeight, key = `${w} ${h}`;
    if (!caseLayouts || w <= 0 || h <= 0 || key === tourSize) return;
    tourSize = key;
    tour = closeUps(shownLayout, w, h, zoom.max);
    stop = Math.min(stop, tour.length - 1);
    caseHasTour = [...caseLayouts.values()].some(layout => closeUps(layout, w, h, zoom.max).length > 1);
  }
  function drawOverview() {
    refreshTour();
    const w = stage.clientWidth,
      h = stage.clientHeight,
      on = narrow() && zoom.k > 1;
    stage.classList.toggle('narrow', narrow());
    player.classList.toggle('narrow', narrow());
    const multiple = tour.length > 1;
    overview.hidden = !on || !multiple;
    // Reserve the toolbar across a case that needs it, keeping Next and the
    // transcript still. A single-view step exposes no toolbar or instructions.
    views.hidden = !narrow() || !caseHasTour;
    views.style.visibility = multiple ? '' : 'hidden';
    wholePicture.disabled = !on;
    nextView.disabled = tour.length < 2;
    const count = on || !multiple ? t.viewCount(stop + 1, Math.max(1, tour.length)) : t.wholePicture;
    if (viewCount.textContent !== count) viewCount.textContent = count;
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
  overview.onclick = nextView.onclick = () => {
    if (tour.length < 2) return;
    revealStage();
    if (zoom.k <= 1) { closer.click(); return; }
    stop = (stop + 1) % tour.length;
    zoom.to(tour[stop]!, true);
  };
  // The reader's zoom narrows the viewBox over the author's camera (app/embed-zoom.ts), so the
  // drawing stays crisp, the layout never moves, a camera move keeps playing under a zoom, and
  // Fit is the author's own frame. Close-ups are reader zooms over that frame too.
  const reader = new ReaderView(stage),
    readerView = (author: string) => reader.view(author);
  const zoom = new StageZoom(
    stage,
    () => {
      zoomOut.disabled = zoom.k <= 1;
      zoomIn.disabled = zoom.k >= zoom.max;
      // Unseen until zoomed, but it keeps its place, so a step that opens on a close-up
      // does not wrap the controls onto a second row and push the page down.
      zoomFit.style.visibility = zoom.k <= 1 ? 'hidden' : '';
      closer.hidden = follow || !narrow();
      drawOverview();
    },
    reader.paint,
  );
  wholePicture.onclick = () => { zoomFit.click(); stage.focus(); };
  zoomIn.onclick = () => { revealStage(); zoom.zoomAt(1.6, undefined, undefined, true); };
  zoomOut.onclick = () => { revealStage(); zoom.zoomAt(1 / 1.6, undefined, undefined, true); };
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
    const step = trace.steps[selected]!,
      words = stepWords(step);
    caption.textContent = words.caption;
    fillLede(ledeTitle, ledeLine, selected, words);
    prev.disabled = earlyPrev.disabled = selected === 0;
    next.disabled = earlyNext.disabled = selected === trace.steps.length - 1;
    for (const b of steps.querySelectorAll('button'))
      b.setAttribute('aria-current', b.dataset.step === step.step ? 'step' : 'false');
    stage.setAttribute('aria-label', t.stageLabel(title.textContent!, words.title, words.line));
    summary.textContent = pictureSummary(step.after);
    picture.innerHTML = pictureHtml(step.after);
    described.hidden = !picture.innerHTML;
    setIcon(replay, playing ? t.stop : t.replay, playing ? 'stop' : 'replay');
  }
  let shownCase = '',
    reservedFor = '';
  /** The lede's words for step `i`: its number and title, then its line when it has one. */
  function fillLede(strong: HTMLElement, span: HTMLElement, i: number, words: { title: string; line: string }) {
    strong.textContent = `${i + 1}. ${words.title}`;
    span.textContent = words.line;
    span.hidden = !words.line;
  }
  function reserve() {
    player.classList.toggle('narrow', narrow());
    if (!trace || !caption.clientWidth) return;
    const key = `${caption.clientWidth} ${shownCase}`;
    if (key === reservedFor) return;
    reservedFor = key;
    ruler.style.width = ledeRuler.style.width = `${caption.clientWidth}px`;
    const strong = el('strong'),
      span = el('span');
    ledeRuler.replaceChildren(strong, span);
    let tallest = 0,
      tallestTitle = 0,
      tallestLine = 0;
    for (const [i, s] of trace.steps.entries()) {
      const words = stepWords(s);
      ruler.textContent = words.caption;
      fillLede(strong, span, i, words);
      // The exact height: offsetHeight rounds, and a 115.2 px caption would still move the steps list by a fraction.
      tallest = Math.max(tallest, ruler.getBoundingClientRect().height);
      tallestTitle = Math.max(tallestTitle, strong.getBoundingClientRect().height);
      tallestLine = Math.max(tallestLine, span.getBoundingClientRect().height);
    }
    ruler.textContent = '';
    ledeRuler.replaceChildren();
    caption.style.minHeight = `${tallest}px`;
    // Reserve each row separately: a two-line title must not move the line below it.
    ledeTitle.style.minHeight = `${tallestTitle}px`;
    ledeLine.style.minHeight = `${tallestLine}px`;
    lede.style.minHeight = `${tallestTitle + tallestLine}px`;
  }
  // Reserving caption height changes the observed layout. Write in the next
  // frame, outside ResizeObserver delivery (WebKit otherwise reports a loop).
  new ResizeObserver(() => requestAnimationFrame(reserve)).observe(player);
  /**
   * The close-up a step opens on: on a narrow stage while close-ups are on, the zoom that
   * frames what the step changed (app/embed-closeup.ts); otherwise null, and the zoom keeps
   * its place. Layouts are prepared once per case, including on desktop, so a later
   * resize can refresh tour metadata without rerunning the scene or changing zoom.
   */
  async function framing(step: Trace['steps'][number]): Promise<Zoom | null> {
    const at = current,
      gen = generation;
    shownLayout = undefined;
    caseLayouts = undefined;
    tourSize = '';
    tour = [];
    stop = 0;
    if (!at) return null;
    at.layouts ??= stepLayouts(at.Scene);
    const layouts = await at.layouts;
    const layout = layouts.get(step.step);
    // A case or step shown while the layouts were worked out owns the overview now.
    if (gen !== generation || at !== current) return null;
    caseLayouts = layouts;
    shownLayout = layout;
    refreshTour();
    return narrow() && follow ? tour[0]! : null;
  }
  function settle(step: Trace['steps'][number], target: Zoom | null) {
    sound?.set(step.meta.audio);
    if (target) zoom.to(target);
    else zoom.apply();
    root.classList.remove('loading');
    document.dispatchEvent(new CustomEvent('rayner:step', { detail: { step: step.step, settings: values } }));
    primeNext();
  }
  async function show(index: number, push = true) {
    if (!trace) return; // Controls exist before the first case has loaded.
    sound?.stop();
    if (push) revealStage();
    const gen = ++generation;
    playing = false;
    active = undefined;
    selected = Math.max(0, Math.min(trace.steps.length - 1, index));
    chrome();
    link(push);
    const step = trace.steps[selected]!;
    const at = current!,
      kept = at.resting.get(step.step);
    const container = el('div');
    const [, target] = await Promise.all([
      kept ? container.append(...kept.map((n) => n.cloneNode(true))) : renderAt(Active, restingTime(step, trace.fps), new ReaderSink(container, { realtime: false }, readerView)),
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
    revealStage();
    if (reduced()) return show(selected + 1);
    selected += 1;
    link(true);
    await animate(true);
  }
  type Go = { gen: number; target: Zoom | null };
  /**
   * A run of the scene that plays one step's animation, held at the step's first frame until
   * it is let go (or cancelled with null). While it plays, `follow` aims it at the next step
   * instead: it runs on undrawn to that step's first frame and waits there to be let go again,
   * so Next pressed mid-motion does not replay the scene from its start. It refuses (false)
   * once the run is over or before it was first let go.
   */
  type Run = { at: Entry; index: () => number; release: (go: Go | null) => void; follow: () => boolean; done: Promise<boolean> };
  let primed: Run | undefined,
    // The run playing the step on show, while it plays.
    active: Run | undefined;
  /**
   * Run the scene to a step's first frame and wait there. Released, it plays the step until
   * the hold, then runs on undrawn to the step's resting frame (the one a link to it shows)
   * and draws that; `done` says whether it got there.
   */
  function prepare(at: Entry, first: number): Run {
    /** Where the run is headed: a step, its times, and a fresh drawing of it. */
    const aimAt = (index: number) => {
      const step = at.trace.steps[index]!,
        container = el('div');
      return {
        index,
        start: step.t0,
        // Stop when the picture stops: the reader sets the pace instead of waiting through the caption-reading hold.
        end: step.hold ?? step.t1 ?? at.trace.duration,
        rest: restingTime(step, at.trace.fps),
        container,
        seek: new SeekSink(new ReaderSink(container, {}, readerView), step.t0),
      };
    };
    let aim = aimAt(first),
      release!: Run['release'],
      gate!: Promise<Go | null>;
    const arm = () => (gate = new Promise<Go | null>((r) => (release = r)));
    arm();
    let go: Go | null | undefined,
      attached = false,
      rested = false,
      over = false;
    const stop = () => {
      over = true;
      return new StopScene();
    };
    const attach = (g: Go) => {
      stage.replaceChildren(...aim.container.childNodes);
      zoom.apply();
      // The view glides to the step's close-up as the step begins, so the change is watched.
      if (!attached && g.target) requestAnimationFrame(() => g.gen === generation && zoom.to(g.target!, true));
      attached = true;
    };
    const runner = new at.Scene(
      {
        // Until released, yield at each step boundary, so a tap never waits behind the whole run.
        async stepBegin() {
          if (go === undefined) await new Promise((r) => setTimeout(r));
        },
        async frame(scene, dt) {
          if (scene.time + 1e-9 < aim.start) return; // before the step: dropped, as SeekSink drops it
          if (dt === 0 && scene.mobjects.length === 0) return; // Keep the poster until a meaningful first frame.
          if (go === undefined) go = await gate;
          if (!go || go.gen !== generation) throw stop();
          if (scene.time > aim.end + 1e-8) {
            if (scene.time + 1e-9 < aim.rest) return;
            // Drawn afresh, as a link to the step draws it, so the two are the same picture.
            await new ReaderSink(aim.container, { realtime: false }, readerView).frame(scene, 0);
            attach(go);
            rested = true;
            throw stop();
          }
          await aim.seek.frame(scene, dt);
          // Superseded while that frame was drawn; a run sent on to the next step waits for it instead.
          if (go && go.gen !== generation) throw stop();
          if (go && !attached) attach(go);
        },
      },
      { skipUntil: aim.start },
    );
    const done = runner.run().then(() => rested);
    const follow = () => {
      if (over || rested || !go || aim.index + 1 >= at.trace.steps.length) return false;
      aim = aimAt(aim.index + 1);
      // The way a link seeks: plays begun from here on to the next step are not interpolated.
      runner.skipUntil = aim.start;
      go = undefined;
      attached = false;
      arm();
      return true;
    };
    return { at, index: () => aim.index, release: (g) => release(g), follow, done };
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
    sound?.stop();
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
    // Next mid-motion: the run playing the step before carries on to this one. This must happen
    // before the first await, while that run has not yet seen the new generation.
    const followed = active?.at === at && active.index() === selected - 1 && active.follow();
    const run = followed ? active! : primed?.at === at && primed.index() === selected ? primed : prepare(at, selected);
    if (run !== primed) primed?.release(null);
    primed = undefined;
    active = run;
    const target = await framing(step);
    run.release(gen === generation ? { gen, target } : null);
    const rested = await run.done;
    if (gen !== generation) return;
    active = undefined;
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
    sound?.stop();
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
          b = el('button'),
          label = stepWords(s).title,
          // The current step is bold; an unseen bold copy in the same grid cell gives every
          // item the bold one's height, so the list keeps its height from step to step.
          bold = el('span', label, 'bold');
        bold.setAttribute('aria-hidden', 'true');
        b.append(el('span', label), bold);
        b.type = 'button';
        b.dataset.step = s.step;
        b.addEventListener('click', () => void show(i));
        li.append(b);
        return li;
      }),
    );
    const shown = new URLSearchParams(values).toString();
    for (const section of transcript.querySelectorAll<HTMLElement>('section')) section.hidden = section.dataset.case !== shown;
    shownCase = shown;
    reserve();
    await show(selected, push);
  }
  prev.onclick = earlyPrev.onclick = () => void show(selected - 1);
  next.onclick = earlyNext.onclick = () => void advance();
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
  // A page `site:export --origin` published names <origin><path>/<id>/ here: each step of the
  // default case with a path-safe name has a share page there, whose link preview is that step.
  const shared = document.querySelector<HTMLMetaElement>(`meta[name="${SHARE_META}"]`)?.content;
  copy.onclick = async () => {
    if (!trace) return;
    const url = urlFor();
    url.searchParams.delete('parentOrigin');
    const step = trace.steps[selected]!.step,
      share = shared && shareable(step) && JSON.stringify(values) === JSON.stringify(resolveSettings(Source)) ? shared + step : url.href;
    try {
      await navigator.clipboard.writeText(share);
      notice.textContent = t.copied;
    } catch {
      notice.textContent = share;
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
