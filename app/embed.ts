import { DomSink, renderAt, traceScene, SeekSink } from '../src/index.ts';
import { StopScene } from '../src/scene.ts';
import type { Trace } from '../src/trace.ts';
import { bindSnapshots, withSettings, resolveSettings } from '../explain/index.ts';
import type { ExplainerClass, Settings, SnapshotStore } from '../explain/index.ts';
import { reportHeight } from './embed-protocol.ts';
import { icon } from './embed-icons.ts';
import type { IconName } from './embed-icons.ts';
import { StageZoom } from './embed-zoom.ts';

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
  let values: Settings,
    trace: Trace,
    Active: ExplainerClass,
    wanted: Settings | undefined,
    selected = 0,
    generation = 0,
    loads = 0,
    playing = false;
  const cache = new Map<string, { Scene: ExplainerClass; trace: Trace }>();

  // Title, then the cases it can show: the choice sits next to what it changes.
  const title = el('h1', Source.meta?.title ?? 'An explanation');
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
  player.setAttribute('aria-label', 'Explanation');
  const stage = el('div', undefined, 'stage');
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', title.textContent!);
  const poster = root.querySelector('svg');
  if (poster) stage.append(poster);
  const caption = el('p', undefined, 'caption');
  caption.setAttribute('aria-live', 'polite');
  const controls = el('nav', undefined, 'controls');
  controls.setAttribute('aria-label', 'Steps');
  const prev = button('Previous step', 'previous'),
    next = button('Next step', 'next', { text: 'Next', className: 'button primary' });
  next.append(next.querySelector('svg')!); // the arrow follows the word
  const tools = el('div', undefined, 'tools');
  const zoomOut = button('Zoom out', 'zoomOut'),
    zoomIn = button('Zoom in', 'zoomIn'),
    zoomFit = button('Fit stage', 'fit'),
    replay = button('Replay step', 'replay'),
    copy = button('Copy link', 'link'),
    enlarge = button('Enlarge', 'enlarge');
  enlarge.setAttribute('aria-pressed', 'false');
  tools.append(zoomOut, zoomIn, zoomFit, replay, copy, ...(document.fullscreenEnabled ? [enlarge] : []));
  controls.append(prev, next, tools);
  const notice = el('p', undefined, 'notice');
  notice.setAttribute('role', 'status');
  player.append(stage, caption, controls, notice);

  const steps = el('ol', undefined, 'steps');
  steps.setAttribute('aria-label', 'Steps in this explanation');
  const transcript = root.querySelector<HTMLElement>('.transcript') ?? el('details', undefined, 'transcript');
  if (transcript instanceof HTMLDetailsElement) transcript.open = false;
  // Inside a frame, a way out to the full page; a standalone page needs none, and the
  // loader (which sets parentOrigin) already puts this link beside the frame.
  const standalone = el('a', 'Open in a new tab', 'standalone');
  standalone.target = '_blank';
  standalone.rel = 'noopener';
  const framed = window.parent !== window && !params.has('parentOrigin');
  root.replaceChildren(head, player, steps, transcript, ...(framed ? [standalone] : []));

  const zoom = new StageZoom(stage, () => {
    zoomOut.disabled = zoom.k <= 1;
    zoomIn.disabled = zoom.k >= zoom.max;
    zoomFit.hidden = zoom.k <= 1;
  });
  zoomIn.onclick = () => zoom.zoomAt(1.6, undefined, undefined, true);
  zoomOut.onclick = () => zoom.zoomAt(1 / 1.6, undefined, undefined, true);
  zoomFit.onclick = () => zoom.reset(true);
  reportHeight(root);

  function urlFor(): URL {
    const url = new URL(location.href);
    url.searchParams.delete('t');
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
    stage.setAttribute('aria-label', `${title.textContent}: ${String(step.meta.title ?? step.step)}`);
    setIcon(replay, playing ? 'Stop animation' : 'Replay step', playing ? 'stop' : 'replay');
  }
  function settle(step: Trace['steps'][number]) {
    zoom.apply();
    root.classList.remove('loading');
    document.dispatchEvent(new CustomEvent('lantern:step', { detail: { step: step.step, settings: values } }));
  }
  async function show(index: number, push = true) {
    if (!trace) return; // Controls exist before the first case has loaded.
    const gen = ++generation;
    playing = false;
    selected = Math.max(0, Math.min(trace.steps.length - 1, index));
    chrome();
    link(push);
    const step = trace.steps[selected]!;
    // A step's last frame: what the reader looks at while reading its caption.
    const at = Math.max(step.t0, (step.t1 ?? step.t0) - 0.5 / trace.fps);
    const container = el('div'),
      sink = new DomSink(container, { realtime: false });
    await renderAt(Active, at, sink);
    if (gen !== generation) return;
    stage.replaceChildren(...container.childNodes);
    settle(step);
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
  async function animate(force = false) {
    if (!trace) return;
    if (playing && !force) return show(selected, false);
    if (reduced()) {
      notice.textContent = 'Reduced motion is on, so the finished step is shown.';
      return show(selected, false);
    }
    const gen = ++generation;
    playing = true;
    chrome();
    const step = trace.steps[selected]!,
      start = step.t0,
      // Stop when the picture stops: the caption-reading hold is for video; here the reader sets the pace.
      end = step.hold ?? step.t1 ?? trace.duration;
    const container = el('div'),
      seek = new SeekSink(new DomSink(container), start);
    let attached = false;
    await new Active(
      {
        async frame(scene, dt) {
          if (gen !== generation || scene.time > end + 1e-8) throw new StopScene();
          if (dt === 0 && scene.mobjects.length === 0) return; // Keep the poster until a meaningful first frame.
          await seek.frame(scene, dt);
          if (gen !== generation) throw new StopScene(); // superseded while that frame was drawn
          if (!attached && scene.time + 1e-8 >= start) {
            attached = true;
            stage.replaceChildren(...container.childNodes);
            zoom.apply();
          }
        },
      },
      { skipUntil: start },
    ).run();
    if (gen !== generation) return;
    // End on the step's resting picture, the one a link to it shows. The animation stops
    // where the caption hold begins, before anything the step adds after its last play().
    await show(selected, false);
  }
  function caseName(values: Settings): string {
    return (Source.settings ?? [])
      .map((s) => `${s.label}: ${s.options.find((o) => o.value === values[s.id])?.label ?? values[s.id]}`)
      .join(' · ');
  }
  function updateTranscript() {
    const list = el('ol');
    for (const s of trace.steps) {
      const li = el('li'),
        a = el('a', String(s.meta.title ?? s.step));
      const url = urlFor();
      url.searchParams.set('step', s.step);
      a.href = url.href;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        void show(trace.steps.indexOf(s));
      });
      li.append(a, el('p', String(s.meta.caption ?? '')));
      list.append(li);
    }
    const sources = el('ul');
    for (const source of Source.meta?.sources ?? []) {
      const li = el('li'),
        a = el('a', source);
      a.href = source;
      a.target = '_blank';
      a.rel = 'noopener';
      li.append(a);
      sources.append(li);
    }
    const name = caseName(values);
    transcript.replaceChildren(
      el('summary', 'Transcript'),
      ...(name ? [el('h2', name)] : []),
      list,
      ...(sources.children.length ? [el('h2', 'Sources'), sources] : []),
    );
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
      fallback = `${(error as Error).message}. Showing the default case.`;
    }
    wanted = next;
    for (const [id, inputs] of choices) for (const input of inputs) input.checked = input.value === next[id];
    const key = JSON.stringify(next);
    let entry = cache.get(key);
    if (!entry) {
      const Scene = withSettings(Bound, next);
      entry = { Scene, trace: await traceScene(Scene) };
      cache.set(key, entry);
    }
    if (token !== loads) return;
    if (!entry.trace.steps.length) throw new Error('Explainer has no named steps');
    const name = typeof step === 'function' ? step() : step;
    // Zoom keeps its place across steps, including Back and Forward within a case.
    const changed = !values || JSON.stringify(values) !== key;
    values = next;
    wanted = undefined;
    Active = entry.Scene;
    trace = entry.trace;
    if (changed) zoom.reset();
    selected = name ? trace.steps.findIndex((s) => s.step === name) : 0;
    // A previous case's fallback must not describe the restored case; both of this one's show.
    const notices = fallback ? [fallback] : [];
    if (selected < 0) {
      selected = 0;
      notices.push(`This case has no “${name}” step, so it opens at the first step.`);
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
    updateTranscript();
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
    setIcon(enlarge, on ? 'Exit full screen' : 'Enlarge', on ? 'fit' : 'enlarge');
    enlarge.setAttribute('aria-pressed', String(on));
    zoom.apply();
  });
  copy.onclick = async () => {
    if (!trace) return;
    const url = urlFor();
    url.searchParams.delete('parentOrigin');
    try {
      await navigator.clipboard.writeText(url.href);
      notice.textContent = 'Link copied.';
    } catch {
      notice.textContent = url.href;
    }
  };
  root.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SUMMARY'].includes(tag) || e.ctrlKey || e.metaKey) return;
    const keys: Record<string, () => void> = {
      ArrowRight: () => void advance(),
      // Like the Previous button, which is disabled on the first step.
      ArrowLeft: () => void (selected > 0 && show(selected - 1)),
      '+': () => zoom.zoomAt(1.6),
      '=': () => zoom.zoomAt(1.6),
      '-': () => zoom.zoomAt(1 / 1.6),
      '0': () => zoom.reset(),
    };
    const action = keys[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  });
  root.tabIndex = 0;
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
