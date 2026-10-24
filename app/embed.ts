import { DomSink, renderAt, traceScene, SeekSink } from '../src/index.ts';
import { StopScene } from '../src/scene.ts';
import type { Trace } from '../src/trace.ts';
import { bindSnapshots, withSettings, resolveSettings } from '../explain/index.ts';
import type { ExplainerClass, Settings, SnapshotStore } from '../explain/index.ts';
import { reportHeight } from './embed-protocol.ts';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  return node;
};
export async function mountEmbed(
  root: HTMLElement,
  Source: ExplainerClass,
  snapshots: SnapshotStore,
): Promise<void> {
  const params = new URLSearchParams(location.search);
  document.documentElement.dataset.theme = ['light', 'dark'].includes(params.get('theme') ?? '')
    ? params.get('theme')!
    : 'auto';
  const Bound = bindSnapshots(Source, snapshots);
  let values: Settings,
    trace: Trace,
    Active: ExplainerClass,
    selected = 0,
    generation = 0;
  let playing = false;
  const cache = new Map<string, { Scene: ExplainerClass; trace: Trace }>();
  const title = el('h1', Source.meta?.title ?? 'An explanation');
  const stage = el('div');
  stage.className = 'stage';
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', title.textContent!);
  const caption = el('p');
  caption.className = 'caption';
  caption.setAttribute('aria-live', 'polite');
  const notice = el('p');
  notice.className = 'notice';
  notice.setAttribute('role', 'status');
  const transport = el('div');
  transport.className = 'transport';
  transport.setAttribute('aria-label', 'Step navigation');
  const prev = el('button', '← Previous'),
    play = el('button', 'Animate step'),
    next = el('button', 'Next →'),
    copy = el('button', 'Copy link'),
    position = el('span');
  position.className = 'position';
  transport.append(prev, play, next, copy, position);
  const chapters = el('ol');
  chapters.className = 'steps';
  chapters.setAttribute('aria-label', 'Chapters');
  const fields = el('fieldset');
  fields.className = 'settings';
  fields.append(el('legend', 'Try another case'));
  const selects = new Map<string, HTMLSelectElement>();
  for (const s of Source.settings ?? []) {
    const label = el('label', s.label + ' '),
      select = el('select');
    select.name = s.id;
    for (const o of s.options) {
      const option = el('option', o.label);
      option.value = o.value;
      select.append(option);
    }
    select.addEventListener('change', () => {
      void load({ ...values, [s.id]: select.value }, trace.steps[selected]?.step, true);
    });
    label.append(select);
    fields.append(label);
    selects.set(s.id, select);
  }
  if (!selects.size) fields.hidden = true;
  const transcript = root.querySelector<HTMLElement>('.transcript') ?? el('details');
  transcript.className = 'transcript';
  if (transcript instanceof HTMLDetailsElement) transcript.open = false;
  const poster = root.querySelector('svg');
  if (poster) stage.append(poster);
  const footer = el('div');
  footer.className = 'footer';
  footer.append(el('span', 'Built with Lantern · Read at your own pace'));
  const standalone = el('a', 'Open standalone');
  standalone.href = location.href;
  standalone.target = '_blank';
  standalone.rel = 'noopener';
  footer.append(standalone);
  root.replaceChildren(title, stage, caption, transport, notice, chapters, fields, transcript, footer);
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
    (push ? history.pushState : history.replaceState).call(history, null, '', url);
    const standaloneUrl = new URL(url);
    standaloneUrl.searchParams.delete('parentOrigin');
    standalone.href = standaloneUrl.href;
  }
  function chrome() {
    const step = trace.steps[selected]!;
    caption.textContent = String(step.meta.caption ?? '');
    position.textContent = `${selected + 1} / ${trace.steps.length}`;
    prev.disabled = selected === 0;
    next.disabled = selected === trace.steps.length - 1;
    for (const b of chapters.querySelectorAll('button'))
      b.setAttribute('aria-current', b.dataset.step === step.step ? 'step' : 'false');
    stage.setAttribute('aria-label', `${title.textContent}: ${String(step.meta.title ?? step.step)}`);
    play.textContent = playing ? 'Stop animation' : 'Animate step';
  }
  async function show(index: number, push = true) {
    const gen = ++generation;
    playing = false;
    selected = Math.max(0, Math.min(trace.steps.length - 1, index));
    chrome();
    link(push);
    const step = trace.steps[selected]!;
    const at = Math.max(step.t0, (step.t1 ?? step.t0) - 1 / trace.fps);
    const container = el('div'),
      sink = new DomSink(container, { realtime: false });
    await renderAt(Active, at, sink);
    if (gen === generation) {
      stage.replaceChildren(...container.childNodes);
      root.classList.remove('loading');
      document.dispatchEvent(
        new CustomEvent('lantern:step', { detail: { step: step.step, settings: values } }),
      );
    }
  }
  async function animate() {
    if (playing) {
      await show(selected, false);
      return;
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      notice.textContent = 'Reduced motion is enabled; the completed step is shown.';
      await show(selected, false);
      return;
    }
    const gen = ++generation;
    playing = true;
    chrome();
    const step = trace.steps[selected]!,
      start = step.t0,
      end = step.t1 ?? trace.duration;
    const container = el('div'),
      dom = new DomSink(container),
      seek = new SeekSink(dom, start);
    let attached = false;
    const scene = new Active(
      {
        async frame(scene, dt) {
          if (gen !== generation || scene.time > end + 1e-8) throw new StopScene();
          if (dt === 0 && scene.mobjects.length === 0) return; // Keep the poster until a meaningful first frame.
          await seek.frame(scene, dt);
          if (!attached && scene.time + 1e-8 >= start) {
            attached = true;
            stage.replaceChildren(...container.childNodes);
          }
        },
      },
      { skipUntil: start },
    );
    await scene.run();
    if (gen === generation) {
      playing = false;
      chrome();
    }
  }
  function updateTranscript() {
    const summary = el('summary', 'Read the transcript'),
      list = el('ol');
    for (const s of trace.steps) {
      const li = el('li');
      const a = el('a', String(s.meta.title ?? s.step));
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
    transcript.replaceChildren(
      summary,
      list,
      ...(sources.children.length ? [el('h2', 'Sources'), sources] : []),
    );
  }
  async function load(request: Settings, step?: string, push = false) {
    const loadGen = ++generation;
    notice.textContent = ''; // A previous case's fallback must not describe the restored case.
    root.classList.add('loading');
    try {
      values = resolveSettings(Source, request);
    } catch (error) {
      values = resolveSettings(Source);
      notice.textContent = `${(error as Error).message}. Showing the default case.`;
    }
    for (const [id, select] of selects) select.value = values[id]!;
    const key = JSON.stringify(values);
    let entry = cache.get(key);
    if (!entry) {
      const Scene = withSettings(Bound, values);
      entry = { Scene, trace: await traceScene(Scene) };
      cache.set(key, entry);
    }
    if (loadGen !== generation) return;
    Active = entry.Scene;
    trace = entry.trace;
    if (!trace.steps.length) throw new Error('Explainer has no named steps');
    selected = step ? trace.steps.findIndex((s) => s.step === step) : 0;
    if (selected < 0) {
      selected = 0;
      notice.textContent = `This case has no “${step}” step. Showing the first step.`;
    }
    chapters.replaceChildren(
      ...trace.steps.map((s, i) => {
        const li = el('li'),
          button = el('button', `${String(i + 1).padStart(2, '0')} · ${String(s.meta.title ?? s.step)}`);
        button.dataset.step = s.step;
        button.addEventListener('click', () => {
          void show(i);
        });
        li.append(button);
        return li;
      }),
    );
    updateTranscript();
    await show(selected, push);
  }
  prev.onclick = () => {
    void show(selected - 1);
  };
  next.onclick = () => {
    void show(selected + 1);
  };
  play.onclick = () => {
    void animate();
  };
  copy.onclick = async () => {
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
    if (['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SUMMARY'].includes(tag) || e.ctrlKey || e.metaKey)
      return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      void show(selected + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      void show(selected - 1);
    }
  });
  root.tabIndex = 0;
  const fromURL = () => {
    const q = new URLSearchParams(location.search);
    const request: Record<string, string> = {};
    for (const s of Source.settings ?? []) {
      if (q.has(s.id)) request[s.id] = q.get(s.id)!;
    }
    return { request, step: q.get('step') ?? undefined };
  };
  window.addEventListener('popstate', () => {
    const q = fromURL();
    void load(q.request, q.step);
  });
  const q = fromURL();
  await load(q.request, q.step);
}
