import { exactHttpOrigin, resizeHeight } from './embed-protocol.ts';
import { chromeFor } from './embed-strings.ts';

/**
 * Optional host-side convenience. Never required by the artifact itself. It adds the iframe and
 * nothing else: the page's own footer carries the way out of the frame. `lang` is kept for
 * compatibility; the script tag's `data-lang` (else the host page's language) chooses the language
 * of the frame's default name.
 */
export function mountExplainer(
  target: HTMLElement,
  src: string,
  options: { title: string; height?: number; theme?: 'light' | 'dark' | 'auto'; lang?: string },
): () => void {
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
  target.append(frame);
  return () => {
    window.removeEventListener('message', receive);
    frame.remove();
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
