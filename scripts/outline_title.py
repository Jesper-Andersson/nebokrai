"""Draw the home page's handwritten word as outlines.

The title of the home page ends in one word in the hand of the logo: Словник
in the Ukrainian interface, Dictionary in the English one. The logo is Caveat
Bold converted to outlines (src/lib/logo-paths.ts), so that the site loads no
font for it; this script does the same for the word, with the same size,
spacing and line of writing, and writes src/lib/title-paths.ts.

Caveat is not part of this project. Take Caveat Bold from
https://github.com/googlefonts/caveat (SIL Open Font License 1.1); the
variable font works too if it is first fixed at weight 700.

    pip install fonttools uharfbuzz
    python scripts/outline_title.py path/to/Caveat-Bold.ttf

To change a word, change WORDS below and run it again.
"""

import io
import sys

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

WORDS = {"uk": "Словник", "en": "Dictionary"}
OUT = "src/lib/title-paths.ts"

# As the logo is drawn: 60 units to the em, the line of writing 50 units down,
# and the letters 14 thousandths of an em further apart than the font sets them
SIZE = 60
BASELINE = 50
TRACKING = 0.014
# Clear space around the ink, for the outline that thickens each letter
MARGIN = 3


def number(value):
    return f"{value:.1f}".rstrip("0").rstrip(".")


def outline(path, text, language):
    font = TTFont(path)
    glyphs = font.getGlyphSet()
    names = font.getGlyphOrder()
    scale = SIZE / font["head"].unitsPerEm

    with open(path, "rb") as file:
        shaper = hb.Font(hb.Face(file.read()))
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    buffer.language = language
    hb.shape(shaper, buffer)

    svg = SVGPathPen(glyphs, ntos=number)
    box = BoundsPen(glyphs)
    x = 0
    for info, position in zip(buffer.glyph_infos, buffer.glyph_positions):
        # Font units to the page: scaled, moved to the pen, and turned over,
        # since a font counts upward from the line and a page counts down
        place = (scale, 0, 0, -scale, (x + position.x_offset) * scale, BASELINE - position.y_offset * scale)
        for pen in (svg, box):
            glyphs[names[info.codepoint]].draw(TransformPen(pen, place))
        x += position.x_advance + TRACKING * font["head"].unitsPerEm
    return svg.getCommands(), box.bounds


def entry(path, text, language):
    d, (left, top, right, bottom) = outline(path, text, language)
    # Each word in a box of its own, cut close: Словник has nothing below
    # its line of writing, and would float in a box made for Dictionary
    return (f"{{\n\t\tname: '{text}',\n"
            f"\t\tbox: '{number(left - MARGIN)} {number(top - MARGIN)} "
            f"{number(right - left + 2 * MARGIN)} {number(bottom - top + 2 * MARGIN)}',\n"
            f"\t\t/** The box's height in ems of the handwriting: multiply by the size wanted. */\n"
            f"\t\tems: {(bottom - top + 2 * MARGIN) / SIZE:.3f},\n"
            f"\t\td: '{d}'\n\t}}")


def main(path):
    font = TTFont(path)
    family, style = font["name"].getDebugName(1), font["name"].getDebugName(2)
    entries = ",\n\t".join(f"{lang}: {entry(path, text, lang)}" for lang, text in WORDS.items())
    module = f"""// Made by scripts/outline_title.py; change the words there, not here.
//
// The last word of the home page's title in the hand of the logo
// (logo-paths.ts): "{WORDS['uk']}" and "{WORDS['en']}" set in {family} {style}, {SIZE} units to
// the em, as outlines, so the site loads no font for it.
//
// Caveat, Copyright 2014 The Caveat Project Authors
// (https://github.com/googlefonts/caveat),
// SIL Open Font License 1.1.

export const TITLE_WORD = {{
	{entries}
}} as const;
"""
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(module)
    # A Windows console is not UTF-8 unless told to be
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"{OUT}: {', '.join(WORDS.values())}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
