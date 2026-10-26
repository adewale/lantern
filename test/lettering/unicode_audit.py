"""Independent regressions for Unicode itemization and modern UAX #9 ordering.
The expected source maps are literal UAX #9 results, not a second call to the
snapshot builder. Font comparisons use one-face HarfBuzz runs as the oracle.
"""
import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lettering', ROOT / 'tools/lettering.py')
lettering = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lettering)
FONTS = Path(os.environ.get('RAYNER_LETTERING_FONTS', ROOT / 'out/lettering-fonts'))
INTER = FONTS / 'inter-ui-4.1.1/package/web/Inter-Regular.woff2'
GARAMOND = FONTS / 'fontsource-eb-garamond-5.3.0/package/files/eb-garamond-latin-400-normal.woff2'
HEBREW = FONTS / 'fontsource-noto-sans-hebrew-5.3.0/package/files/noto-sans-hebrew-hebrew-400-normal.woff2'
ARABIC = FONTS / 'fontsource-noto-naskh-arabic-5.3.0/package/files/noto-naskh-arabic-arabic-400-normal.woff2'


def shape(text, fonts, **options):
    return lettering.shape(dict(text=text, fonts=list(map(str, fonts)), **options))


class UnicodeAudit(unittest.TestCase):
    def test_balanced_brackets_keep_following_numbers_outside(self):
        text = 'abc ( אב ) 123'
        expected = [0, 1, 2, 3, 4, 5, 7, 6, 8, 9, 10, 11, 12, 13]
        self.assertEqual([c['index'] for c in lettering.bidi_chars(text)], expected)
        run = shape(text, [INTER, HEBREW], preferred={'Hebr': 1})
        self.assertEqual([g['cluster'] for g in run['glyphs']], expected)

    def test_brackets_in_rtl_surrounding_text(self):
        self.assertEqual([c['index'] for c in lettering.bidi_chars('abc אב ( אב )')],
                         [0, 1, 2, 3, 12, 11, 10, 9, 8, 7, 6, 5, 4])

    def test_utf8_levels_preserve_astral_source_code_point_indices(self):
        self.assertEqual([c['index'] for c in lettering.bidi_chars('𐐀 ( אב ) 123')],
                         [0, 1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11])

    def test_maximum_explicit_embedding_allows_implicit_level_126(self):
        for char, level in [('a', 126), ('א', 125)]:
            with self.subTest(char=char):
                text = '\u202b' * 64 + char + '\u202c' * 64
                self.assertEqual([(c['index'], c['level']) for c in lettering.bidi_chars(text)], [(64, level)])

    def test_paragraphs_keep_their_own_base_direction(self):
        self.assertEqual([c['index'] for c in lettering.bidi_chars('abc\nאב')], [0, 1, 2, 3, 5, 4])
        self.assertEqual(lettering.bidi_chars(''), [])

    def test_unknown_backend_metadata_fails_closed(self):
        with patch.object(lettering, 'get_display', return_value='changed metadata format'):
            with self.assertRaisesRegex(ValueError, 'Unsupported python-bidi'):
                lettering.bidi_chars('abc')

    def test_isolates_still_fail_with_an_explicit_error(self):
        with self.assertRaisesRegex(ValueError, 'isolate controls'):
            lettering.bidi_chars('abc\u2067אב\u2069')

    def test_explicit_face_is_not_overridden_by_a_script_fallback(self):
        expected = shape('Garamond', [GARAMOND])
        actual = shape('Garamond', [GARAMOND, INTER], preferred={'Latn': 1}, explicitPrimary=True)
        self.assertEqual(actual, expected)

    def test_mono_punctuation_and_numbers_remain_mono_after_hebrew(self):
        mono = FONTS / 'mono.woff2'
        text = 'abc ( אב ) 123'
        actual = shape(text, [mono, HEBREW], preferred={'Hebr': 1}, mono=True)
        expected = shape('123', [mono], mono=True)
        digits = [g for g in actual['glyphs'] if g['cluster'] >= 11]
        self.assertEqual([(g['gid'], g['ax'], g['path']) for g in digits],
                         [(g['gid'], g['ax'], g['path']) for g in expected['glyphs']])

    def test_a_base_and_combining_mark_fall_back_as_one_cluster(self):
        expected = shape('e\u0301', [INTER])
        actual = shape('e\u0301', [FONTS / 'sans.woff2', INTER])
        self.assertEqual(actual['glyphs'], expected['glyphs'])

    def test_arabic_joiners_reach_harfbuzz_with_original_source_clusters(self):
        import uharfbuzz as hb
        font, hb_font = lettering.face(ARABIC)
        em = font['head'].unitsPerEm
        for text in ['ب\u200cب', 'ب\u200dب', '\u200dب', 'ب\u200d']:
            with self.subTest(text=text):
                buf = hb.Buffer()
                buf.add_codepoints(list(map(ord, text)))
                buf.guess_segment_properties()
                hb.shape(hb_font, buf)
                actual = shape(text, [ARABIC], preferred={'Arab': 0})['glyphs']
                expected = list(zip(buf.glyph_infos, buf.glyph_positions))
                self.assertEqual(len(actual), len(expected))
                for g, (info, pos) in zip(actual, expected):
                    self.assertEqual((g['gid'], g['cluster']), (info.codepoint, info.cluster))
                    self.assertAlmostEqual(g['ax'], pos.x_advance / em)
                    self.assertAlmostEqual(g['dx'], pos.x_offset / em)
                    self.assertAlmostEqual(g['dy'], pos.y_offset / em)

    def test_common_brackets_use_primary_font_and_harfbuzz_mirroring(self):
        opening = shape('(', [INTER])['glyphs'][0]['path']
        closing = shape(')', [INTER])['glyphs'][0]['path']
        for script, font, text in [('Hebr', HEBREW, 'abc אב ( אב )'),
                                   ('Arab', ARABIC, 'abc سلام ( سلام )')]:
            with self.subTest(script=script):
                run = shape(text, [INTER, font], preferred={script: 1})
                by_source = {g['cluster']: g for g in run['glyphs']}
                # Both paired brackets have RTL levels and must mirror. The
                # script fallback faces have no ASCII parentheses, so contours
                # come from Inter while source clusters remain logical.
                self.assertEqual(by_source[text.index('(')]['path'], closing)
                self.assertEqual(by_source[text.index(')')]['path'], opening)

    def test_controls_keep_their_blank_advance_and_source_cluster(self):
        font, _ = lettering.face(INTER)
        for control in ['\t', '\n', '\r', '\x00']:
            with self.subTest(control=control):
                name = font.getBestCmap().get(ord(control), font.getGlyphOrder()[0])
                blank_advance = font['hmtx'].metrics[name][0] / font['head'].unitsPerEm
                run = shape('a' + control + 'b', [INTER])
                self.assertEqual([g['cluster'] for g in run['glyphs']], [0, 1, 2])
                blank = run['glyphs'][1]
                self.assertEqual(blank['gid'], font.getGlyphID(name))
                self.assertEqual(blank['path'], [])
                self.assertAlmostEqual(blank['ax'], blank_advance)
                self.assertEqual(run['glyphs'][2]['gid'], shape('b', [INTER])['glyphs'][0]['gid'])

    def test_rtl_paragraphs_do_not_merge_through_a_blank_control(self):
        run = shape('אב\nגד', [INTER, HEBREW], preferred={'Hebr': 1})
        self.assertEqual([g['cluster'] for g in run['glyphs']], [1, 0, 2, 4, 3])


if __name__ == '__main__':
    unittest.main()
