# Flowcharts

Mermaid flowchart syntax, parsed, laid out and drawn by Lantern. Every node,
edge, arrowhead, label and subgraph box is an ordinary mobject, so a diagram
animates, steps and seeks like anything else.

```js
import { Scene, flowchart, LaggedStart, Indicate, MoveAlongPath, Dot } from 'lantern';

class Cache extends Scene {
  async construct() {
    const chart = flowchart(`flowchart LR
      R[Request] --> W{cached?}
      W -- hit --> K[(KV)]
      W -. miss .-> D[(D1)] --> K`);
    // Build it in, rank by rank
    for (const stage of chart.reveal()) await this.play(new LaggedStart(stage, { lagRatio: 0.15 }));
    // Then use its parts
    await this.play(new Indicate(chart.node('W').shape));
    const token = new Dot().moveTo(chart.node('W').shape.center());
    await this.play(new MoveAlongPath(token, chart.edge('W', 'D').children[0]));
  }
}
```

- `chart.node(id)` is a `Labeled` (`.shape`, `.label`); `chart.edge(from, to, k)` a group
  `[path, arrowheads…, label?]`; `chart.cluster(id)` a `Labeled` (box, title).
- `chart.reveal()` returns stages of animations in layout order; `chart.drawEdge(a, b)`
  draws one edge in.
- The chart is one mobject: `chart.animate.shift(…).scale(…)` is a camera move.
- Options: `width`/`height` to fit, `fontSize`, `theme` (`FLOWCHART_THEME`), and
  `layout: { rankSep, nodeSep, clusterPad }`.

## Syntax

`flowchart` / `graph` with `TB` `TD` `BT` `LR` `RL`. Node shapes `[ ]` `( )` `([ ])` `(( ))`
`((( )))` `{ }` `{{ }}` `[[ ]]` `[( )]` `> ]` `[/ /]` `[\ \]` `[/ \]` `[\ /]`, labels quoted or
bare, `<br/>` for line breaks. Links `-->` `---` `-.->` `-.-` `==>` `===` `--x` `--o` `<-->`,
longer with extra marks, labels as `-- text -->`, `-. text .->`, `== text ==>` or `-->|text|`.
`&` lists, chains, `subgraph id [title] … end` (nested), `direction`, `classDef`, `class`,
`:::class`, `style`, `linkStyle`, `%%` comments, `;` separators.

The parser is checked against mermaid's own (`test/flowchart.test.ts`, with
`MERMAID_JS` pointing at mermaid 11's `mermaid.min.js`): vertex ids, text, shape and
classes, edge type, stroke, label and length, and subgraph membership agree on 2000
generated flowcharts. Writing that test found the rules the docs don't state:
a node belongs to the first subgraph closed that references it, `class` reaches only
nodes that exist when it runs while `style` creates one, a quoted edge label is its
contents, and edge length counts only the closing marks.

## Layout

Layered (Sugiyama), as dagre does it for mermaid:

1. cycles broken by reversing DFS back edges;
2. ranks by longest path, every edge spanning two ranks so it has a midpoint to bend
   through and a slot for its label; a subgraph whose members share no edges is a row;
3. dummy nodes where long edges cross ranks;
4. each rank ordered by barycenter sweeps with subgraphs kept contiguous, keeping the
   ordering with fewest crossings;
5. positions along each rank by weighted least squares toward neighbors under minimum
   separation, solved exactly by isotonic regression (pool adjacent violators);
6. subgraph boxes, with non-members and unrelated boxes pushed out.

Edges are d3's `curveBasis` through their points (what mermaid draws). Properties checked
on 2000 random flowcharts: no node overlaps, every non-reversed edge flows down a rank,
every box contains its members and no other node, unrelated boxes never overlap, and the
layout is deterministic.

Not implemented: subgraph `direction` (mermaid ignores it too when a subgraph links
outside), `click`, icons, markdown strings, and edges *to* subgraphs attach to the
subgraph's first node rather than its border.
