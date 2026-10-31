// Player icons: one stroke weight, drawn on a 24-unit grid, coloured by currentColor. A few
// parts are filled instead (FILLED), with the same colour.
const PATHS = {
  previous: ['M15 18l-6-6 6-6'],
  next: ['M9 18l6-6-6-6'],
  link: ['M10 13.5a4.5 4.5 0 0 0 6.36 0l3-3a4.5 4.5 0 0 0-6.36-6.36l-1.25 1.25', 'M14 10.5a4.5 4.5 0 0 0-6.36 0l-3 3a4.5 4.5 0 0 0 6.36 6.36l1.25-1.25'],
  zoomIn: ['M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14z', 'M20 20l-4-4', 'M11 8v6', 'M8 11h6'],
  zoomOut: ['M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14z', 'M20 20l-4-4', 'M8 11h6'],
  fit: ['M9 4v5H4', 'M15 4v5h5', 'M9 20v-5H4', 'M15 20v-5h5'],
  // A crosshair: look here.
  closeUp: ['M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z', 'M12 1.5v3', 'M12 19.5v3', 'M1.5 12h3', 'M19.5 12h3', 'M12 11.5v1'],
  enlarge: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  // Rayner's mark: three rounded bars in a row, like the step bar, the first one filled (FILLED).
  mark: ['M9.5 10.5h5a1.5 1.5 0 0 1 0 3h-5a1.5 1.5 0 0 1 0-3z', 'M17 10.5h5a1.5 1.5 0 0 1 0 3h-5a1.5 1.5 0 0 1 0-3z'],
  // Back to the start: a loop that returns to its own beginning.
  restart: ['M4 12a8 8 0 1 0 2.34-5.66', 'M4 4v4h4'],
  // Out of the frame, up and to the right.
  open: ['M7 17L17 7', 'M9 7h8v8'],
} as const;
export type IconName = keyof typeof PATHS;
const FILLED: Partial<Record<IconName, readonly string[]>> = {
  mark: ['M2 10.5h5a1.5 1.5 0 0 1 0 3H2a1.5 1.5 0 0 1 0-3z'],
};

export function icon(name: IconName): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({
    viewBox: '0 0 24 24',
    width: '20',
    height: '20',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.75',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  }))
    svg.setAttribute(k, v);
  for (const d of PATHS[name]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  for (const d of FILLED[name] ?? []) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('stroke', 'none');
    svg.append(path);
  }
  return svg;
}
