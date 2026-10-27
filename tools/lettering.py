#!/usr/bin/env python3
"""Build-time only: HarfBuzz outlines, Unicode bidi, and fontTools subsetting.
JSON in/out. Never used by the self-contained reader or video renderer.
"""
import base64
import io
import json
import re
import sys
import unicodedata
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.unicodedata import script
import uharfbuzz as hb
from bidi import get_display


def reorder_paragraph(chars, base_level):
    """UAX #9 L1/L2 over resolved levels (including modern levels up to 126)."""
    reset = True
    for c in reversed(chars):
        # X9 removes joiners only from bidi ordering, not from shaping. They
        # retain the neighbouring resolved level and must not stop L1's scan.
        if c['ch'] in ('\u200c', '\u200d'):
            continue
        if c['orig'] in ('B', 'S'):
            c['level'], reset = base_level, True
        elif reset and c['orig'] in ('BN', 'WS'):
            c['level'] = base_level
        else:
            reset = False
    visual, start = [], 0
    for index, c in enumerate(chars):
        if c['orig'] != 'B' and index != len(chars) - 1:
            continue
        end = index if c['orig'] == 'B' else index + 1
        line = chars[start:end]
        odd = [item['level'] for item in line if item['level'] % 2]
        if odd:
            for level in range(max(item['level'] for item in line), min(odd) - 1, -1):
                first = 0
                while first < len(line):
                    if line[first]['level'] < level:
                        first += 1
                        continue
                    last = first + 1
                    while last < len(line) and line[last]['level'] >= level:
                        last += 1
                    line[first:last] = reversed(line[first:last])
                    first = last
        visual.extend(line)
        if c['orig'] == 'B':
            visual.append(c)
        start = index + 1
    return visual


def bidi_chars(text):
    """Resolve modern UAX #9 levels while keeping logical code-point indices.

    python-bidi 0.6.12's public Rust wrapper exposes resolved levels through
    get_display(debug=True), but does not expose a visual-to-logical map. Its
    metadata indexes UTF-8 bytes. Validate that pinned format strictly, convert
    to source code points, and apply L1/L2 per paragraph. The legacy Python
    resolver cannot be used here: it predates N0 paired-bracket resolution.
    HarfBuzz performs glyph mirroring, so the source characters stay unchanged.
    """
    if not text:
        return []
    if any(unicodedata.bidirectional(ch) in ('LRI', 'RLI', 'FSI', 'PDI') for ch in text):
        raise ValueError('Bidi isolate controls are not supported in lettering')
    metadata = get_display(text, debug=True)
    levels_match = re.search(r'^    levels: \[\n(.*?)^    \],$', metadata, re.M | re.S)
    paragraphs_match = re.search(r'^    paragraphs: \[\n(.*?)^    \],$', metadata, re.M | re.S)
    if not levels_match or not paragraphs_match:
        raise ValueError('Unsupported python-bidi debug metadata; install the pinned lettering requirements')
    levels = [int(n) for n in re.findall(r'Level\(\s*(\d+),?\s*\)', levels_match[1])]
    paragraphs = [(int(a), int(b), int(level)) for a, b, level in re.findall(
        r'ParagraphInfo\s*\{\s*range:\s*(\d+)\.\.(\d+),\s*level:\s*Level\(\s*(\d+),?\s*\),?\s*\}', paragraphs_match[1])]
    byte_length = len(text.encode('utf-8'))
    if len(levels) != byte_length or any(n > 126 for n in levels):
        raise ValueError('Invalid python-bidi level metadata')
    if (paragraphs and (paragraphs[0][0] != 0 or paragraphs[-1][1] != byte_length or
                       any(a >= b or level not in (0, 1) for a, b, level in paragraphs) or
                       any(a[1] != b[0] for a, b in zip(paragraphs, paragraphs[1:])))) or (not paragraphs and byte_length):
        raise ValueError('Invalid python-bidi paragraph metadata')
    chars, offset = [], 0
    for index, ch in enumerate(text):
        orig = unicodedata.bidirectional(ch)
        # X9 controls participate in resolution but have no displayed glyph.
        if (orig not in ('RLE', 'LRE', 'RLO', 'LRO', 'PDF', 'BN') or
                ch in ('\u200c', '\u200d') or unicodedata.category(ch) == 'Cc'):
            chars.append(dict(ch=ch, index=index, offset=offset, level=levels[offset], orig=orig))
        offset += len(ch.encode('utf-8'))
    visual = []
    for paragraph, (start, end, base_level) in enumerate(paragraphs):
        line = [c for c in chars if start <= c['offset'] < end]
        for c in line:
            c['paragraph'] = paragraph
        visual.extend(reorder_paragraph(line, base_level))
    return visual


def face(path):
    f = TTFont(path, recalcTimestamp=False)
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    hf = hb.Font(hb.Face(buf.getvalue()))
    hf.scale = (f['head'].unitsPerEm, f['head'].unitsPerEm)
    return f, hf


def draw(font, gid):
    out = []
    d = hb.DrawFuncs()
    d.set_move_to_func(lambda x, y, _: out.append(dict(tag='MoveTo', x=x, y=y)))
    d.set_line_to_func(lambda x, y, _: out.append(dict(tag='LineTo', x=x, y=y)))
    d.set_quadratic_to_func(lambda x1, y1, x, y, _: out.append(dict(tag='QuadTo', x1=x1, y1=y1, x=x, y=y)))
    d.set_cubic_to_func(lambda x1, y1, x2, y2, x, y, _: out.append(dict(tag='CubicTo', x1=x1, y1=y1, x2=x2, y2=y2, x=x, y=y)))
    d.set_close_path_func(lambda _: out.append(dict(tag='Close')))
    font.draw_glyph(gid, d)
    return out


def shape(req):
    fonts = [face(p) for p in req['fonts']]
    text = req['text']
    visual = bidi_chars(text)
    # Itemize before visual ordering, retaining logical source indices. Common
    # and inherited characters stay with their neighbouring script where possible.
    prev_script, prev_paragraph = None, None
    logical = sorted(visual, key=lambda c: c['index'])
    first_scripts = {}
    for c in logical:
        c['original_script'] = script(c['ch'])
        if c['original_script'] not in ('Zyyy', 'Zinh'):
            first_scripts.setdefault(c['paragraph'], c['original_script'])
    clusters = []
    for c in logical:
        ch = c['ch']
        if c['paragraph'] != prev_paragraph:
            prev_script, prev_paragraph = None, c['paragraph']
        sc = c['original_script']
        if sc not in ('Zyyy', 'Zinh'):
            prev_script = sc
        c['script'] = prev_script or (first_scripts.get(c['paragraph'], 'Latn') if ch in ('\u200c', '\u200d') else 'Latn')
        # Keep a base and its combining marks in one font so mark attachment is
        # not lost at a fallback boundary. Joining runs with the same owner and
        # script are still shaped together below (including Indic conjuncts).
        if (clusters and c['paragraph'] == clusters[-1][0]['paragraph'] and
                unicodedata.category(clusters[-1][-1]['ch']) != 'Cc' and c['script'] == clusters[-1][0]['script'] and (
                unicodedata.category(ch).startswith('M') or ch in ('\u200c', '\u200d') or
                clusters[-1][-1]['ch'] == '\u200d')):
            clusters[-1].append(c)
        else:
            clusters.append([c])
    for cluster in clusters:
        drawable = [c['ch'] for c in cluster if unicodedata.category(c['ch']) not in ('Cc', 'Cf')]
        owners = [i for i, (f, _) in enumerate(fonts) if all(ord(ch) in (f.getBestCmap() or {}) for ch in drawable)]
        if not owners:
            raise ValueError('No requested face draws cluster ' + ' '.join('U+%04X' % ord(ch) for ch in drawable))
        preferred = req.get('preferred', {}).get(cluster[0]['script'])
        literal_common = ((req.get('mono') and all(script(c['ch']) in ('Zyyy', 'Zinh') for c in cluster)) or
                          all(unicodedata.category(c['ch']) == 'Cc' for c in cluster))
        owner = 0 if 0 in owners and (req.get('explicitPrimary') or literal_common) else preferred if preferred in owners else owners[0]
        for c in cluster:
            c['owner'] = owner
    groups = []
    for c in visual:
        key = c['level'], c['owner'], c['script'], c['paragraph'], unicodedata.category(c['ch']) == 'Cc'
        # Combining marks reordered visually by bidi still belong to the same run.
        if not groups or groups[-1][0] != key:
            groups.append((key, []))
        groups[-1][1].append(c)
    glyphs, pen = [], 0
    # The code points each face drew, by its index in req['fonts'], so a subset
    # holds only what its face drew.
    uses = {}
    for (level, owner, sc, _paragraph, _control), chars in groups:
        uses.setdefault(owner, set()).update(ord(c['ch']) for c in chars)
        chars = sorted(chars, key=lambda c: c['index'])
        f, hf = fonts[owner]
        buf = hb.Buffer()
        buf.add_codepoints([ord(c['ch']) for c in chars])
        buf.direction = 'rtl' if level % 2 else 'ltr'
        buf.script = sc
        buf.guess_segment_properties()
        # Literal code has no ligatures, like the existing mono face. JetBrains
        # Mono draws its code ligatures with calt, which the embedded cut drops.
        features = {'liga': False, 'clig': False} if req.get('mono') else {}
        if req.get('mono') and owner in req.get('literal', []):
            features['calt'] = False
        hb.shape(hf, buf, features)
        scale = 1 / f['head'].unitsPerEm
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            control_glyph = info.codepoint == 0 and unicodedata.category(chars[info.cluster]['ch']) in ('Cc', 'Cf')
            if info.codepoint == 0 and not control_glyph:
                raise ValueError('HarfBuzz returned an undrawable glyph')
            glyphs.append(dict(gid=info.codepoint, cluster=chars[info.cluster]['index'],
                x=pen, dx=pos.x_offset * scale, dy=pos.y_offset * scale,
                ax=pos.x_advance * scale, s=scale, path=[] if control_glyph else draw(hf, info.codepoint)))
            pen += pos.x_advance * scale
    first = fonts[0][0]
    em = first['head'].unitsPerEm
    # The caller stores the run without `uses`.
    return dict(glyphs=glyphs, width=pen, ascent=first['hhea'].ascent/em,
                descent=-first['hhea'].descent/em, s=1/em,
                uses={str(k): sorted(v) for k, v in uses.items()})


def sub(req):
    f = TTFont(req['font'], recalcTimestamp=False)
    options = subset.Options()
    # A page decodes a subset only to shape counter values with glyph's Latin
    # shaper, so keep the features that shaper applies (the caller passes them:
    # glyph's defaults, without ligatures for a literal code face), and drop
    # hinting: outlines are drawn unhinted.
    options.layout_features = req['features']
    options.hinting = False
    options.recalc_timestamp = False
    options.flavor = 'woff2'
    s = subset.Subsetter(options=options)
    s.populate(unicodes=req.get('codepoints', []), gids=req.get('gids', []))
    s.subset(f)
    f.flavor = 'woff2'
    out = io.BytesIO()
    f.save(out)
    return base64.b64encode(out.getvalue()).decode('ascii')

if __name__ == '__main__':
    try:
        req = json.load(sys.stdin)
        result = shape(req) if req['command'] == 'shape' else sub(req)
        json.dump(result, sys.stdout, ensure_ascii=True, separators=(',', ':'))
    except Exception as e:
        print('lettering: ' + str(e), file=sys.stderr)
        sys.exit(1)
