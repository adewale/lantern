The optional `glyph-math.js` typesetter is MIT-licensed glyph at
6398654dfda7d5a91763e3ef07369b9a9d8e3b2b (Ivar Vong). Rebuild with
`node tools/vendor-glyph-math.ts /path/to/glyph`. It reuses the combining-class
data already present in `glyph.js` and exports only `typeset`, not the renderer.
It is imported only during requested maths snapshot capture, never by a page.

Requested text faces come from pinned Fontsource 5.3.0 packages and Inter UI
4.1.1 (OFL). Optional Noto Sans SC uses the checksum-pinned Sans2.004 TrueType
release. `tools/lettering-outline-fonts.sh` retrieves them without changing default faces.
Each requested face's licence is stored in its snapshot and included in the
page's licence block. Latin Modern Math 1.959 is the explicit GUST/LPPL exception;
its source checksum and notice are checked before subsetting.
