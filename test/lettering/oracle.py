"""Independent fixture oracle: call HarfBuzz directly, without Rayner's itemizer.
Arguments: font file, text, and optionally a JSON object of OpenType features."""
import io, json, sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1]); f.flavor = None
out = io.BytesIO(); f.save(out)
font = hb.Font(hb.Face(out.getvalue()))
em = f['head'].unitsPerEm
font.scale = (em, em)
b = hb.Buffer(); b.add_codepoints([ord(c) for c in sys.argv[2]])
b.guess_segment_properties(); hb.shape(font, b, json.loads(sys.argv[3]) if len(sys.argv) > 3 else {})
pen = 0; glyphs = []
for i, p in zip(b.glyph_infos, b.glyph_positions):
    glyphs.append(dict(gid=i.codepoint, cluster=i.cluster, x=pen/em,
                       dx=p.x_offset/em, dy=p.y_offset/em, ax=p.x_advance/em))
    pen += p.x_advance
print(json.dumps(glyphs, separators=(',', ':')))
