"""Give the Fixel web fonts the stress mark.

Fixel has no combining acute accent (U+0301). A browser that meets а + U+0301
(анана́с) therefore draws the whole stressed vowel in whatever system font has
the mark, Segoe UI on Windows: a letter of another design, visibly smaller
than its neighbours in bold text.

This script adds to each file:

  * the combining acute itself, for the rare stress on any other letter;
  * one ready-made glyph for each Ukrainian vowel with the accent, small and
    capital (а́ е́ и́ і́ о́ у́ ю́ я́ є́ ї́), built from the font's own letter and its
    own acute. The accent stands where the designers put it on the Latin
    letter of the same shape (á for а́, ó for о́), and і́ loses its dot as í does;
  * a rule (`ccmp`) that swaps vowel + U+0301 for that glyph;
  * the kerning of the plain vowel for the stressed one.

Nothing else in a file changes. The SIL Open Font License allows a modified
version, and Fixel reserves no font name; the version string says what was
added.

Needs fontTools and Brotli, which are not part of this project:

    pip install fonttools brotli
    python scripts/add_stress_to_fixel.py src/lib/assets/fixel/*.woff2

A file that already has U+0301 is left alone, so to build again start from the
files as MacPaw publishes them (https://github.com/MacPaw/fixel).
"""

import copy
import glob
import sys

from fontTools.misc.transform import Offset
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables

ACUTE = 0x0301
MARK_NAME = "uni0301"

# For each vowel, the Latin letter whose accented form shows how far right of
# the letter's middle the acute belongs. The round о stands in for the vowels
# with no Latin twin.
LIKE = {
    "а": "a", "е": "e", "и": "o", "і": "dotlessi", "о": "o",
    "у": "y", "ю": "o", "я": "o", "є": "e", "ї": "dotlessi",
    "А": "A", "Е": "E", "И": "O", "І": "I", "О": "O",
    "У": "Y", "Ю": "O", "Я": "O", "Є": "O", "Ї": "I",
}
ACCENTED = {
    "a": "aacute", "e": "eacute", "o": "oacute", "y": "yacute", "dotlessi": "iacute",
    "A": "Aacute", "E": "Eacute", "O": "Oacute", "Y": "Yacute", "I": "Iacute",
}

# Above the two dots of ї the acute sits closer than above a bare letter, or
# the pair grows taller than the line.
GAP_OVER_DOTS = 28

VERSION_NOTE = "; stressed Ukrainian vowels and U+0301 added for nebokrai.app"


def contours(glyph_set, name):
    """The glyph's outline as a list of closed paths."""
    pen = RecordingPen()
    glyph_set[name].draw(pen)
    paths, current = [], []
    for step in pen.value:
        current.append(step)
        if step[0] in ("closePath", "endPath"):
            paths.append(current)
            current = []
    return paths


def bounds(steps):
    """(xMin, yMin, xMax, yMax) of recorded pen steps."""
    pen = BoundsPen(None)
    for op, args in steps:
        getattr(pen, op)(*args)
    return pen.bounds


def glyph_bounds(glyph_set, name):
    return bounds([step for path in contours(glyph_set, name) for step in path])


def middle(box):
    return (box[0] + box[2]) / 2


def accent_placement(font, glyph_set, latin):
    """How the font places the acute on a Latin letter: how far the accent's
    middle lies to the right of the letter's, and how far it is lifted."""
    upper = latin[0].isupper()
    mark = "acute.case" if upper else "acute"
    floor = (font["OS/2"].sCapHeight if upper else font["OS/2"].sxHeight) + 20
    accents = [bounds(path) for path in contours(glyph_set, ACCENTED[latin])]
    accents = [box for box in accents if box[1] >= floor]
    if len(accents) != 1:
        raise ValueError(f"cannot find the accent of {ACCENTED[latin]}")
    lean = middle(accents[0]) - middle(glyph_bounds(glyph_set, latin))
    lift = accents[0][1] - glyph_bounds(glyph_set, mark)[1]
    return mark, lean, lift


def charstring(top, glyph_set, advance, parts):
    """A CFF outline from (glyph name, dx, dy) parts."""
    private = top.Private
    # A charstring states its width as the difference from the font's nominal
    # width, and leaves it out when it is the default one.
    width = None if advance == private.defaultWidthX else advance - private.nominalWidthX
    pen = T2CharStringPen(width, glyph_set)
    record = RecordingPen()
    for name, dx, dy in parts:
        for target in (pen, record):
            glyph_set[name].draw(TransformPen(target, Offset(dx, dy)))
    program = pen.getCharString(private=private, globalSubrs=top.GlobalSubrs)
    return program, bounds(record.value)


def add_glyph(font, top, name, program, advance, box):
    index = top.CharStrings.charStringsIndex
    index.append(program)
    top.CharStrings.charStrings[name] = len(index) - 1
    top.charset.append(name)
    font["hmtx"][name] = (advance, round(box[0]))


def add_substitution(font, stressed):
    """vowel + U+0301 → the ready-made glyph, in every `ccmp` feature."""
    gsub = font["GSUB"].table
    subtable = otTables.LigatureSubst()
    subtable.ligatures = {}
    for base, name in stressed.items():
        ligature = otTables.Ligature()
        ligature.LigGlyph = name
        ligature.Component = [MARK_NAME]
        ligature.CompCount = 2
        subtable.ligatures[base] = [ligature]
    lookup = otTables.Lookup()
    lookup.LookupType = 4
    lookup.LookupFlag = 0
    lookup.SubTable = [subtable]
    lookup.SubTableCount = 1
    gsub.LookupList.Lookup.append(lookup)
    gsub.LookupList.LookupCount = len(gsub.LookupList.Lookup)
    number = gsub.LookupList.LookupCount - 1

    features = [r.Feature for r in gsub.FeatureList.FeatureRecord if r.FeatureTag == "ccmp"]
    if not features:
        raise ValueError("the font has no ccmp feature to add the rule to")
    for feature in features:
        feature.LookupListIndex.append(number)
        feature.LookupCount = len(feature.LookupListIndex)


def copy_kerning(font, stressed):
    """The stressed vowel kerns as the plain one does, on both sides. The font
    kerns its own á exactly as its a.

    The new glyphs have the highest numbers in the font, so adding them at the
    end keeps every list in glyph order, as the format requires."""
    for lookup in font["GPOS"].table.LookupList.Lookup:
        for subtable in lookup.SubTable:
            subtable = getattr(subtable, "ExtSubTable", subtable)
            if subtable.LookupType != 2:
                continue
            first = subtable.Coverage.glyphs
            if subtable.Format == 1:
                for base, name in stressed.items():
                    if base in first:
                        subtable.PairSet.append(copy.deepcopy(subtable.PairSet[first.index(base)]))
                        first.append(name)
                subtable.PairSetCount = len(subtable.PairSet)
                for pair_set in subtable.PairSet:
                    records = {r.SecondGlyph: r for r in pair_set.PairValueRecord}
                    for base, name in stressed.items():
                        if base in records:
                            record = copy.deepcopy(records[base])
                            record.SecondGlyph = name
                            pair_set.PairValueRecord.append(record)
                    pair_set.PairValueCount = len(pair_set.PairValueRecord)
            else:
                left, right = subtable.ClassDef1.classDefs, subtable.ClassDef2.classDefs
                for base, name in stressed.items():
                    if base in first:
                        first.append(name)
                    if base in left:
                        left[name] = left[base]
                    if base in right:
                        right[name] = right[base]


def add_stress(path):
    font = TTFont(path, lazy=False)
    cmap = font.getBestCmap()
    if ACUTE in cmap:
        print(f"{path}: already has U+0301, left alone")
        return

    glyph_set = font.getGlyphSet()
    top = font["CFF "].cff.topDictIndex[0]
    hmtx = font["hmtx"]
    new = []

    # The mark by itself: no width, and drawn to the left of where the pen
    # stands, over a letter of ordinary width. A browser that knows the letter
    # under it moves it to the middle of that letter.
    box = glyph_bounds(glyph_set, "acute")
    program, drawn = charstring(top, glyph_set, 0, [("acute", round(-250 - middle(box)), 0)])
    new.append((MARK_NAME, program, 0, drawn))

    stressed = {}
    for vowel, latin in LIKE.items():
        base = cmap[ord(vowel)]
        mark, lean, lift = accent_placement(font, glyph_set, latin)
        # і́ is drawn without its dot, as í is; ї́ keeps both dots
        drawn_base = "dotlessi" if vowel == "і" else base
        base_box = glyph_bounds(glyph_set, drawn_base)
        mark_box = glyph_bounds(glyph_set, mark)
        if vowel in "їЇ":
            lift = base_box[3] + GAP_OVER_DOTS - mark_box[1]
        dx = round(middle(base_box) + lean - middle(mark_box))
        advance = hmtx[base][0]
        name = f"uni{ord(vowel):04X}0301"
        program, drawn = charstring(top, glyph_set, advance, [(drawn_base, 0, 0), (mark, dx, round(lift))])
        new.append((name, program, advance, drawn))
        stressed[base] = name

    for name, program, advance, drawn in new:
        add_glyph(font, top, name, program, advance, drawn)
    font.setGlyphOrder(list(top.charset))

    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[ACUTE] = MARK_NAME
    # Class 3 is "mark": kerning looks past it
    font["GDEF"].table.GlyphClassDef.classDefs[MARK_NAME] = 3
    add_substitution(font, stressed)
    copy_kerning(font, stressed)

    for record in font["name"].names:
        if record.nameID == 5 and VERSION_NOTE not in record.toUnicode():
            record.string = record.toUnicode() + VERSION_NOTE

    font.save(path)

    # Read the file back: every new glyph is there and as wide as its vowel
    check = TTFont(path)
    after = check.getGlyphSet()
    assert check.getBestCmap()[ACUTE] == MARK_NAME
    for base, name in stressed.items():
        assert after[name].width == after[base].width, name
    print(f"{path}: added U+0301 and {len(stressed)} stressed vowels, {len(check.getGlyphOrder())} glyphs")


if __name__ == "__main__":
    paths = [path for pattern in sys.argv[1:] for path in sorted(glob.glob(pattern))]
    if not paths:
        sys.exit(__doc__)
    for path in paths:
        add_stress(path)
