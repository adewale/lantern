# Restore, copies and sequencing

Three animations from manim's set, with Lantern's guarantees: every frame is a pure
function of alpha over endpoints fixed when the animation begins, and a seek renders
the byte-identical frame a full run produces (`test/anim-utils.test.ts`).

## Restore: come back exactly

```ts
box.saveState();
await this.play(box.animate.setFill(RED).scale(1.5));
await this.play(new Restore(box));        // back to the saved look, animated
```

`saveState()` stores a deep copy on the mobject (`box.saved`). `restore()` returns to
it at once, `Restore` transforms back to it. After either, the mobject equals the saved
state exactly: points, style, and fields such as a `Text`'s string. That holds even
when the mobject changed shape on the way (morphed into a circle, which subdivides its
curves): `Restore` aligns to morph, then lands on the saved data itself.

The contract for structure: restore expects the family to have the same shape as when
saved, and then rewrites each member's data in place, so references to children stay
valid. If children were added or removed since, the saved children replace them
wholesale (as fresh copies); the mobject itself keeps its identity, parent and
updaters either way. Fields that name a part, such as `Code.lines`, name this
mobject's own children after a restore, not the saved copy's (`test/anim-utils.test.ts`,
"restore() on a Code keeps `lines` naming its own children, not the saved copy's"). The saved state stays, so you can restore again. `copy()` does not
carry it: a copy is a new mobject with no history.

## TransformFromCopy: derive one thing from another

```ts
await this.play(new TransformFromCopy(formula, result), new Indicate(formula));
```

A copy of `formula` morphs into `result`. `formula` stays where it is, unchanged, and
the scene holds `result` at the end. The copy is made when the play begins and is a
different mobject from the source, so the source can be animated in the same play.

## Succession: one after another, in one play

```ts
await this.play(new Succession([
  new Indicate(box),
  box.animate.shift(RIGHT),
  new FadeOut(box),
]));
```

Each member begins when the previous ends, exactly as consecutive `play()` calls would:
its endpoints are fixed from the state the previous member left (an `.animate` member
builds its target then, too), and it finishes and is cleaned up at its own end (the box
is removed when the `FadeOut` ends). So members may drive the same mobject. Run time is
the sum of the members'. With run times in whole frames (the default 1 s, or any
multiple of 1/fps), frame counts and step times equal those of the consecutive plays,
and in the tests so do the frames, byte for byte. Otherwise they can differ by a frame:
each play rounds its own length to whole frames, a `Succession` rounds the total.

It nests both ways with `AnimationGroup` and `LaggedStart`. `play()`'s rule that two
animations may not drive one mobject at the same time looks through it: members of one
`Succession` may share a mobject, but none may share with an animation running beside
the `Succession`.

Time through a `Succession` is linear by default; members ease with their own rate
functions. A group rate function must not run time backwards.

## In the explainers

- `saveState`/`Restore`: [state-machine](../scenes/explainers/state-machine/scene.ts) saves every reducer
  line, recolours the row that fired, and restores it when the next event arrives.
- `TransformFromCopy`: [ring-buffer](../scenes/explainers/ring-buffer/scene.ts) copies values into and out
  of slots; [exgit](../scenes/explainers/exgit/scene.ts) sends the shared blob to tree two.
- `Succession`: [state-machine](../scenes/explainers/state-machine/scene.ts),
  [token-bucket](../scenes/explainers/token-bucket/scene.ts) and
  [ring-buffer](../scenes/explainers/ring-buffer/scene.ts) each play a step's events as one `Succession`.
