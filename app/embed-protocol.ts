export const RESIZE_TYPE = 'rayner:resize';
export function exactHttpOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && value === url.origin ? url.origin : null;
  } catch {
    return null;
  }
}
export function resizeHeight(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  origin: string,
  source: MessageEventSource | null,
): number | null {
  if (!source || event.origin !== origin || event.source !== source) return null;
  const d: unknown = event.data;
  if (!d || typeof d !== 'object') return null;
  const data = d as Record<string, unknown>;
  return data.type === RESIZE_TYPE &&
    data.version === 1 &&
    typeof data.height === 'number' &&
    Number.isInteger(data.height) &&
    data.height >= 1 &&
    data.height <= 100000
    ? data.height
    : null;
}
export function reportHeight(root: HTMLElement): () => void {
  const origin = exactHttpOrigin(new URLSearchParams(location.search).get('parentOrigin'));
  if (window.parent === window || !origin) return () => {};
  let last = 0;
  const measure = () => {
    const height = Math.ceil(root.getBoundingClientRect().height);
    if (height !== last && height >= 1 && height <= 100000) {
      last = height;
      parent.postMessage({ type: RESIZE_TYPE, version: 1, height }, origin);
    }
  };
  // ResizeObserver already delivers at most once per rendering update, so measure
  // in its callback. Browsers may stop rendering an offscreen cross-origin frame,
  // the usual place for an embed, and then neither requestAnimationFrame nor
  // ResizeObserver fires. Measuring forces layout without rendering, so also
  // measure whenever the player settles on a step, and once the page has loaded.
  const observer = new ResizeObserver(measure);
  observer.observe(root);
  document.addEventListener('rayner:step', measure);
  window.addEventListener('load', measure);
  measure();
  return () => {
    observer.disconnect();
    document.removeEventListener('rayner:step', measure);
    window.removeEventListener('load', measure);
  };
}
