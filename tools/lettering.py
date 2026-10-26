#!/usr/bin/env python3
"""Build-time only: HarfBuzz outlines, Unicode bidi, and fontTools subsetting.
JSON in/out. Never used by the self-contained reader or video renderer.
"""
import base64
import io
import json
import sys
import unicodedata
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.unicodedata import script
import uharfbuzz as hb
from bidi.algorithm import (get_empty_storage, get_base_level, get_embedding_levels,
    explicit_embed_and_overrides, resolve_weak_types, resolve_neutral_types,
    resolve_implicit_levels, reorder_resolved_levels)


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
    storage = get_empty_storage()
    storage['base_level'] = get_base_level(text)
    storage['base_dir'] = 'R' if storage['base_level'] else 'L'
    get_embedding_levels(text, storage)
    for i, c in enumerate(storage['chars']):
        c['index'] = i
    explicit_embed_and_overrides(storage)
    resolve_weak_types(storage)
    resolve_neutral_types(storage, False)
    resolve_implicit_levels(storage, False)
    # Itemize before visual ordering, retaining logical source indices. Common
    # and inherited characters stay with their neighbouring script where possible.
    prev_script, prev_owner = 'Latn', 0
    for c in storage['chars']:
        ch = c['ch']
        sc = script(ch)
        if sc not in ('Zyyy', 'Zinh'):
            prev_script = sc
        c['script'] = prev_script
        owners = [i for i, (f, _) in enumerate(fonts) if ord(ch) in (f.getBestCmap() or {})]
        if not owners and unicodedata.category(ch) not in ('Cc', 'Cf'):
            raise ValueError('No requested face draws U+%04X' % ord(ch))
        preferred = req.get('preferred', {}).get(c['script'])
        c['owner'] = preferred if preferred in owners else (owners[0] if owners else prev_owner)
        prev_owner = c['owner']
    reorder_resolved_levels(storage, False)
    groups = []
    for c in storage['chars']:
        key = c['level'], c['owner'], c['script']
        # Combining marks reordered visually by bidi still belong to the same run.
        if not groups or groups[-1][0] != key:
            groups.append((key, []))
        groups[-1][1].append(c)
    glyphs, pen = [], 0
    for (level, owner, sc), chars in groups:
        chars = sorted(chars, key=lambda c: c['index'])
        f, hf = fonts[owner]
        buf = hb.Buffer()
        buf.add_codepoints([ord(c['ch']) for c in chars])
        buf.direction = 'rtl' if level % 2 else 'ltr'
        buf.script = sc
        buf.guess_segment_properties()
        # Literal code has no ligatures, like the existing mono face.
        hb.shape(hf, buf, {'liga': False, 'clig': False} if req.get('mono') else {})
        scale = 1 / f['head'].unitsPerEm
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            if info.codepoint == 0:
                raise ValueError('HarfBuzz returned an undrawable glyph')
            glyphs.append(dict(gid=info.codepoint, cluster=chars[info.cluster]['index'],
                x=pen, dx=pos.x_offset * scale, dy=pos.y_offset * scale,
                ax=pos.x_advance * scale, s=scale, path=draw(hf, info.codepoint)))
            pen += pos.x_advance * scale
    first = fonts[0][0]
    em = first['head'].unitsPerEm
    return dict(glyphs=glyphs, width=pen, ascent=first['hhea'].ascent/em,
                descent=-first['hhea'].descent/em, s=1/em)


def sub(req):
    f = TTFont(req['font'], recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = ['*']
    options.recalc_timestamp = False
    options.flavor = 'woff2'
    s = subset.Subsetter(options=options)
    s.populate(unicodes=req.get('codepoints', []), gids=req.get('gids', []))
    s.subset(f)
    f.flavor = 'woff2'
    out = io.BytesIO()
    f.save(out)
    return base64.b64encode(out.getvalue()).decode('ascii')

try:
    req = json.load(sys.stdin)
    result = shape(req) if req['command'] == 'shape' else sub(req)
    json.dump(result, sys.stdout, ensure_ascii=True, separators=(',', ':'))
except Exception as e:
    print('lettering: ' + str(e), file=sys.stderr)
    sys.exit(1)
