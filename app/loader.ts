import { exactHttpOrigin, resizeHeight } from './embed-protocol.ts';

/** Optional host-side convenience. Never required by the artifact itself. */
export function mountExplainer(
  target: HTMLElement,
  src: string,
  options: { title: string; height?: number; theme?: 'light' | 'dark' | 'auto' },
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
  const link = document.createElement('a');
  link.href = src;
  link.textContent = 'Open explanation in a new page';
  link.target = '_blank';
  link.rel = 'noopener';
  target.append(frame, link);
  return () => {
    window.removeEventListener('message', receive);
    frame.remove();
    link.remove();
  };
}

const script = document.currentScript as HTMLScriptElement | null;
if (script?.dataset.src) {
  const target = script.dataset.target
    ? document.getElementById(script.dataset.target)
    : script.parentElement;
  if (target)
    mountExplainer(target, script.dataset.src, {
      title: script.dataset.title ?? 'Interactive explanation',
      theme: (script.dataset.theme ?? 'auto') as 'auto',
    });
}
