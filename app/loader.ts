import { exactHttpOrigin, resizeHeight } from './embed-protocol.ts';
import { chromeFor } from './embed-strings.ts';

/**
 * Optional host-side convenience. Never required by the artifact itself. Its own words (the
 * link beside the frame) are in `lang`, the host page's language unless given.
 */
export function mountExplainer(
  target: HTMLElement,
  src: string,
  options: { title: string; height?: number; theme?: 'light' | 'dark' | 'auto'; lang?: string },
): () => void {
  const t = chromeFor(hostLang(options.lang));
  const url = new URL(src, document.baseURI);
  const origin = exactHttpOrigin(url.origin);
  if (!origin) throw new Error('Auto-sizing requires an HTTP(S) artifact URL');
  url.searchParams.set('parentOrigin', location.origin);
  if (options.theme) url.searchParams.set('theme', options.theme);
  const frame = document.createElement('iframe');
  frame.title = options.title;
  frame.loading = 'lazy';
  frame.allow = 'fullscreen';
  frame.src = url.href;
  frame.style.cssText = `width:100%;height:${options.height ?? 640}px;border:0;display:block`;
  const receive = (event: MessageEvent) => {
    const height = resizeHeight(event, origin, frame.contentWindow);
    if (height != null) frame.style.height = `${height}px`;
  };
  window.addEventListener('message', receive);
  const link = document.createElement('a');
  link.href = src;
  link.textContent = t.newTab;
  link.target = '_blank';
  link.rel = 'noopener';
  target.append(frame, link);
  return () => {
    window.removeEventListener('message', receive);
    frame.remove();
    link.remove();
  };
}

/** The language the loader's words are in: the one given, else the host page's. */
const hostLang = (lang?: string) => lang || document.documentElement.lang || 'en';

const script = document.currentScript as HTMLScriptElement | null;
if (script?.dataset.src) {
  const target = script.dataset.target
    ? document.getElementById(script.dataset.target)
    : script.parentElement;
  if (target)
    mountExplainer(target, script.dataset.src, {
      title: script.dataset.title ?? chromeFor(hostLang(script.dataset.lang)).frame,
      theme: (script.dataset.theme ?? 'auto') as 'auto',
      lang: script.dataset.lang,
    });
}
