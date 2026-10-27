# Lettering on request

Plain `Latn`, `Grek`, and `Cyrl` requests retain the subset workflow introduced
in PR #10. Requests containing `faces`, `styles`, `math`, or another script use the
outline snapshot workflow described here; the existing snapshot schema remains supported.

Existing scenes keep their embedded Inter/JetBrains Mono lettering and their
page bytes and receipts. Nothing is downloaded for them. Do not regenerate
`src/font-data.ts` to add a language to one scene.

Request the work on the scene class:

```ts
import { Scene, Text, Math as Formula } from 'rayner';
import { stage } from 'rayner/explain';

export default class Example extends Scene {
  static meta = {
    id: 'joining', title: 'Arabic and maths',
    lettering: { scripts: ['Arab'], math: true },
  };
  override async construct() {
    const s = stage(this, { heading: false });
    await this.step('joining', { caption: 'Arabic joining and vowel marks.' });
    await s.enter(new Text('السَّلَامُ عَلَيْكُمْ', { color: s.palette.ink }));
    await this.step('fraction', { caption: 'A fraction and a superscript.' });
    await s.clear();
    await s.enter(new Formula('\\frac{1}{2}+x^2', { color: s.palette.ink }));
  }
}
```

`Text`, `Code`, native stage panels, headings, diagram labels, and video footers
use the requested faces. The browser and resvg draw the same stored paths;
there is no browser font request, system-font lookup, HarfBuzz or TeX runtime.
`Math` (also exported as `MathTex`) uses glyph's TeX-subset/OpenType MATH
layout at build time. `{ display: true }` selects display layout. Invalid TeX,
unavailable glyphs, and `Math` without `math: true` fail the build.

## Capture, check, build

Ordinary `npm ci` is enough to check/build the committed examples. To capture
new lettering snapshots, install the optional build-time tools:

```sh
python3 -m venv out/lettering-venv
out/lettering-venv/bin/pip install -r tools/lettering-requirements.txt
export RAYNER_LETTERING_PYTHON="$PWD/out/lettering-venv/bin/python"
bash tools/lettering-outline-fonts.sh
# Latin Modern Math 1.959 is supplied by Ubuntu's fonts-lmodern package.
# Else set RAYNER_MATH_FONT to the original latinmodern-math.otf.
npm run explain -- snapshots path/to/scene.ts
npm run explain -- check path/to/scene.ts
npm run explain -- build path/to/scene.ts --out out/example.html
```

Commit `scene.lettering.json` beside the scene, just like diagram snapshots.
Capture visits every settings case, including text built during replay and
caption/footer wrapping. HarfBuzz shapes each distinct string once at unit em;
runs retain glyph IDs, logical source clusters, advances, offsets, and outlines.
The subset keeps the used code points plus layout/glyph dependencies. Replacement faces also retain a bounded numeric alphabet for animated values, whose intermediate strings depend on playback FPS. Each
requested font's licence travels with its subset into the page's licence block.

`check`, `build`, `shots`, and `render` require a fresh snapshot and never
silently recapture. Changing a caption, imported scene code, the request, or the
lettering builder, embedded fallback fonts or core shaping code invalidates the snapshot. Cached snapshots validate their run structure and payload checksum before drawing. Run `snapshots` to refresh it.
`preview` refreshes during authoring. Unrecorded prose fails closed; seek and playback cannot start an unrecorded language case. Formatted numeric values and known simple-script prefix/suffix templates can replay through the existing glyph shaper with the requested subset, so counters work at arbitrary video frame rates. Missing characters
in an unrequested script still fail, including during capture.

`explain check` reports `lettering.bytes` (serialized snapshot payload),
`lettering.pageBytes` (what the page's script carries of it), the binary subset
size per face, and the distinct run count. A page carries the request and the
runs, which hold every outline it draws, and only the subsets its counters shape
with at runtime; hashes and licences stay in the snapshot, and each distinct
licence notice joins the page's licence block once. Subsets keep the layout
features glyph's shaper applies when a counter replays (without ligatures for
JetBrains Mono, which capture shapes as literal code) and no hinting. A cut's
subset holds only the characters that cut drew, and a cut that drew nothing is
left out. Receipts include
`letteringHash`; the snapshot includes source/font/builder hashes. The legacy
engine fingerprint deliberately excludes optional modules and type-only
metadata, so opting out preserves receipts as well as page bytes. A regression
test pins all 26 pre-feature pages and receipts, across their 140 cases.

## Supported requests

`scripts` uses ISO 15924 codes. These select build-time fallbacks, without
replacing Inter for ordinary text:

| Script | Face |
| --- | --- |
| `Arab` | Noto Naskh Arabic |
| `Deva` | Noto Sans Devanagari |
| `Hebr` | Noto Sans Hebrew |
| `Grek`, `Cyrl`, extended `Latn` | Full Inter |
| `Hani` | Noto Sans SC, TrueType outlines |

For Chinese, first run `LETTERING_CJK=1 bash tools/lettering-outline-fonts.sh`; this
fetches the checksum-pinned larger face and fixes its variable weight at 400.
The others use pinned npm packages. `RAYNER_LETTERING_FONTS` can select another
cache directory. Cached fonts and Python are required only for capture, not for
building from a snapshot. Latin Modern Math's original SHA-256 must match; the
GUST/LPPL font is an explicit exception to the OFL text-face registry.

To use a style's serif face, explicitly request it:

```ts
static meta = {
  id: 'ink', title: 'Ink on paper',
  lettering: { faces: { sans: 'eb-garamond' } },
};
// In construct(): stage(this, { style: 'pen-and-ink' })
```

The registry accepts `inter`, `eb-garamond`, `jetbrains-mono`, `noto-naskh-arabic`,
`noto-sans-devanagari`, `noto-sans-hebrew`, and `noto-sans-sc` for `sans` or
`mono`. Requests do not implicitly add scripts: Greek text in a replacement
face must still request `Grek`. Faces outside this licensed registry are rejected.
Only faces under the SIL Open Font License 1.1 or the Apache License 2.0 may be
in it: capture checks each face's notice, and every check and build from a
snapshot checks the stored notices again, so a face under another licence fails
the build. Latin Modern Math, for `Math`, is the one exception (GUST Font License).
The proposed `stage(..., { lettering: 'style' })` shorthand is not implemented;
explicit face selection keeps the request visible in `meta`.

## Bold and italic

Without a request, `weight: 'bold'` strokes the Regular outline (faux bold) and
there is no italic. Ask for the real cuts:

```ts
import { Scene, Text, ItalicText } from 'rayner';

static meta = { id: 'cuts', title: 'Cuts', lettering: { styles: ['bold', 'italic'] } };
// In construct():
this.add(new Text('Bold', { weight: 'bold' }));            // the Bold cut, no stroke
this.add(new ItalicText('Italic'));                         // the Italic cut
this.add(new ItalicText('Both', { weight: 'bold' }));       // the Bold Italic cut
```

- With `'bold'`, every bold Text in the explainer draws its face's Bold cut,
  including the stage heading and panel titles. Without it, bold stays faux.
- `ItalicText` is a `Text` in the Italic cut. It fails the build unless
  `styles` includes `'italic'`; there is no faux italic. With both styles,
  `weight: 'bold'` gives Bold Italic.
- The cuts come from the family's face: the requested `faces.sans` or
  `faces.mono`, else Inter for `sans` and JetBrains Mono for `mono` (the full
  releases of the embedded faces). A requested face without the cut fails
  capture, naming it: `noto-sans-hebrew` has no italic.
- Scripts follow the nearest cut their face has. Noto Naskh Arabic, Noto Sans
  Devanagari and Noto Sans Hebrew have Bold cuts and no italic, so italic text in
  them draws upright and bold italic draws bold. Noto Sans SC has no Bold cut in
  the registry, so bold Chinese fails capture, naming that face. Symbols and numerals that only the
  embedded Noto fallbacks draw stay at their one weight.
- Each cut is shaped by HarfBuzz at capture like any other run, keyed
  `["sans/bold", text, false]`, and stored with its outlines. A cut's subset holds
  only the characters styled runs asked of it, plus the numeric alphabet for the
  family's own cut so a bold counter replays at any frame rate.
- `test/lettering/styles` is the fixture: heading, bold, italic, bold italic,
  bold code, bold and italic Arabic, and a bold counter.

## Bidi and matching

Bidi resolves logical runs before shaping, including paired brackets in mixed-direction text; clusters always address the original string, even when the visual glyph order is right to left. The pinned Rust backend exposed by python-bidi supplies resolved UTF-8 levels; the builder validates that metadata and maps it to source code-point indices. It handles explicit embeddings/overrides, preserves shaping joiners, and rejects unsupported isolate controls. Complex scripts beyond the registered faces remain unsupported.
Picture descriptions still use the existing English/French vocabulary.

`Write` reveals stored glyphs; a ligature/conjunct is an indivisible outline.
`TransformMatchingText` retains its existing pairing by the source character at
a glyph's cluster start, including multiple glyphs at that start. Use `Transform`
for whole-formula or ligature/conjunct changes where character pairing is not
the intended motion. A formula's glyphs are not characters of its source, so
they carry no cluster, and both matching transforms pair them by shape
([Maths](REFERENCE.md#maths)). Replacement prose must be built into a case; numeric animations use the bounded exception described above.

`Code.span`, `token` and `lineSpan` keep logical UTF-16 source ranges while their boxes cover the corresponding visual RTL cells, including complete combining clusters. For colour changes, select the entire source cluster; one glyph outline cannot be split into independently styled characters. Ordinary scenes and overlapping independent renders keep separate font leases; nested runs using the same lettering provider are supported. Awaiting a nested `Scene.run()` with a different provider (including an unlettered child) is unsupported: render those scenes independently before composing their output.

## Verification

```sh
node --test test/lettering-outlines.test.ts test/lettering-styles.test.ts
EXPLAIN_LETTERING=1 node --test test/lettering-outlines.test.ts test/lettering-styles.test.ts test/lettering-*-audit.test.ts
EXPLAIN_BROWSER=1 node --test test/lettering-browser.test.ts
```

The first command uses committed Arabic, Devanagari, maths and serif fixtures
and runs the legacy cost and bare-runtime/seek gates. The second also compares
stored IDs, clusters and placement with a separate direct HarfBuzz oracle
(for each bold and italic cut too),
checks maths symbol glyphs and fraction/script layout, deterministic refresh,
and script rejection. It needs the capture dependencies above. The last builds
each fixture's page, opens every step in Chromium and asserts the live stage
draws the same path data Node draws from the same runs (`npm run test:embeds`
runs it; `CHROMIUM_EXECUTABLE_PATH` may select a system browser). No screenshot or browser assertion substitutes for the outline and
receipt comparisons.
