// Random mermaid flowcharts from a seed, for fuzzing src/mermaid.ts against
// mermaid's own parser. Generates only syntax both are meant to accept.
import { rng } from './random-scene.ts';

const SHAPES: Array<[open: string, close: string]> = [['[', ']'], ['(', ')'], ['([', '])'], ['((', '))'], ['{', '}'], ['[[', ']]'], ['[(', ')]'], ['{{', '}}'], ['>', ']'], ['[/', '/]'], ['[\\', '\\]']];
const WORDS = ['alpha', 'beta', 'gamma', 'Request', 'D1', 'KV cache', 'step 2', 'x', 'eval_stmt', 'read file'];
const LINKS = ['-->', '---', '-.->', '-.-', '==>', '===', '--x', '--o', '<-->', '--->', '-..->', '====>'];
const LABELED: Array<[open: string, close: string]> = [['--', '-->'], ['--', '---'], ['-.', '.->'], ['==', '==>']];

export function randomFlowchart(seed: number): string {
  const r = rng(seed);
  const dir = r.pick(['TB', 'TD', 'BT', 'LR', 'RL']);
  const n = r.int(2, 9);
  const ids = Array.from({ length: n }, (_, i) => r.pick(['n', 'node', 'A', 'B', 'x']) + i);
  const declared = new Set<string>();
  const ref = (id: string): string => {
    if (declared.has(id) || r.bool(0.3)) return id;
    declared.add(id);
    const [o, c] = r.pick(SHAPES);
    const words = Array.from({ length: r.int(1, 3) }, () => r.pick(WORDS)).join(r.bool(0.2) ? '<br/>' : ' ');
    const text = r.bool(0.4) ? `"${words}"` : words;
    return id + o + text + c + (r.bool(0.15) ? ':::hot' : '');
  };
  const lines = [`flowchart ${dir}`];
  if (r.bool(0.4)) lines.push('  classDef hot fill:#300,stroke:#f66,color:#fff');
  if (r.bool(0.3)) lines.push('  %% a comment');
  const stmt = () => {
    const parts: string[] = [];
    const list = () => Array.from({ length: r.bool(0.2) ? 2 : 1 }, () => ref(r.pick(ids))).join(' & ');
    parts.push(list());
    for (let k = r.int(1, 3); k > 0; k--) {
      const lab = () => (r.bool(0.3) ? `"${r.pick(WORDS)}${r.bool(0.3) ? '<br/>' + r.pick(WORDS) : ''}"` : r.pick(WORDS));
      if (r.bool(0.3)) { const [o, c] = r.pick(LABELED); parts.push(`${o} ${lab()} ${c}`); }
      else { const l = r.pick(LINKS); parts.push(r.bool(0.25) && l.endsWith('>') ? `${l}|${lab()}|` : l); }
      parts.push(list());
    }
    return '  ' + parts.join(' ');
  };
  const body = Array.from({ length: r.int(1, 7) }, stmt);
  // wrap slices of statements in subgraphs: several, sometimes nested, titles in each syntax
  let sgN = 0;
  const wrap = (arr: string[], depth: number): string[] => {
    if (arr.length === 0 || !r.bool(depth === 0 ? 0.6 : 0.35)) return arr;
    const a = r.int(0, arr.length - 1);
    const inner = wrap(arr.splice(a, r.int(1, arr.length - a)), depth + 1);
    const id = `sg${seed}_${sgN++}`;
    const head = r.pick([`${id}["${r.pick(WORDS)}"]`, `${id} [${r.pick(WORDS)}]`, id]);
    const block = [`subgraph ${head}`, ...(r.bool(0.3) ? ['  direction ' + r.pick(['LR', 'TB'])] : []), ...inner.map((x) => '  ' + x), 'end'];
    arr.splice(a, 0, ...block);
    return r.bool(0.3) ? wrap(arr, depth) : arr;
  };
  wrap(body, 0);
  if (r.bool(0.25)) body.push(`class ${ids.slice(0, r.int(1, 3)).join(',')} hot`);
  lines.push(...body.map((x) => '  ' + x.trimStart().replace(/^/, '')));
  if (r.bool(0.3)) lines.push(`  style ${r.pick(ids)} fill:#222,stroke:#888`);
  if (r.bool(0.3)) lines.push('  linkStyle 0 stroke:#f0f');
  return lines.join('\n');
}
