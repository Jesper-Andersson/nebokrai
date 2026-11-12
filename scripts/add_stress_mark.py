"""Give a web font the stressed Ukrainian vowels.

A stressed vowel is written as the letter and a combining acute accent
(U+0301): анана́с. Fonts handle the pair badly in two ways:

  * Fixel has no U+0301 at all. A browser then draws the whole stressed vowel
    in whatever system font has the mark, Segoe UI on Windows: a letter of
    another design, visibly smaller than its neighbours in bold text.
  * Nyght Serif has the mark, but no place for it on я and є, and it sets the
    accent on top of the dot of і and into the dots of ї.

This script adds to each file:

  * the combining acute itself, if the font has none, for the rare stress on
    any other letter;
  * one ready-made glyph for each Ukrainian vowel with the accent, small and
    capital (а́ е́ и́ і́ о́ у́ ю́ я́ є́ ї́), built from the font's own letter and its
    own acute. The accent stands where the designers put it on the Latin
    letter of the same shape (á for а́, ó for о́), and і́ loses its dot as í does;
  * a rule (`ccmp`) that swaps vowel + U+0301 for that glyph;
  * the kerning of the plain vowel for the stressed one.

Nothing else in a file changes. The SIL Open Font License allows a modified
version; the version string says what was added.

A font with a Reserved Font Name may not keep that name once it is modified.
Nyght Serif reserves its name, so its files are copied under a new name first
and renamed inside with --rename:

    pip install fonttools brotli
    python scripts/add_stress_mark.py src/lib/assets/fixel/*.woff2

    cp src/lib/assets/nyght-serif-main/NyghtSerif-Bold.woff2 \
       src/lib/assets/serif/NebokraiSerif-Bold.woff2
    cp src/lib/assets/nyght-serif-main/NyghtSerif-RegularItalic.woff2 \
       src/lib/assets/serif/NebokraiSerif-Italic.woff2
    python scripts/add_stress_mark.py --rename "Nyght Serif=Nebokrai Serif" \
        src/lib/assets/serif/*.woff2

fontTools and Brotli are not part of this project. A file that already has
the stressed vowels is left alone, so to build again start from the files as
their makers publish them: https://github.com/MacPaw/fixel for Fixel, and
src/lib/assets/nyght-serif-main/ for Nyght Serif, kept here unchanged.
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
import fontTools.merge.layout  # noqa: F401  (gives the layout tables mapLookups)

ACUTE = 0x0301
# The name the mark gets in a font that has none
NEW_MARK_NAME = "uni0301"

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
    mark = "acute"
    if upper:
        # Fixel calls the flatter accent for capitals acute.case; Nyght Serif
        # has it only as a combining mark
        mark = next((name for name in ("acute.case", "acutecomb.case") if name in glyph_set), "acute")
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


def add_substitution(font, stressed, mark_name):
    """vowel + U+0301 → the ready-made glyph, in every `ccmp` feature.

    The new rule becomes the font's first. Rules run in the order they are
    stored, and Nyght Serif joins її into one glyph: in її́ the second ї must
    take its accent before that happens."""
    gsub = font["GSUB"].table
    subtable = otTables.LigatureSubst()
    subtable.ligatures = {}
    for base, name in stressed.items():
        ligature = otTables.Ligature()
        ligature.LigGlyph = name
        ligature.Component = [mark_name]
        ligature.CompCount = 2
        subtable.ligatures[base] = [ligature]
    lookup = otTables.Lookup()
    lookup.LookupType = 4
    lookup.LookupFlag = 0
    lookup.SubTable = [subtable]
    lookup.SubTableCount = 1
    # Every rule moves one place down, and so does every reference to one
    shifted = {old: old + 1 for old in range(len(gsub.LookupList.Lookup))}
    gsub.LookupList.mapLookups(shifted)
    gsub.FeatureList.mapLookups(shifted)
    gsub.LookupList.Lookup.insert(0, lookup)
    gsub.LookupList.LookupCount = len(gsub.LookupList.Lookup)
    number = 0

    features = [r.Feature for r in gsub.FeatureList.FeatureRecord if r.FeatureTag == "ccmp"]
    if not features:
        raise ValueError("the font has no ccmp feature to add the rule to")
    for feature in features:
        feature.LookupListIndex.insert(0, number)
        feature.LookupCount = len(feature.LookupListIndex)

    # A feature only works for the scripts that list it: Cyrillic must
    cyrillic = [r.Script for r in gsub.ScriptList.ScriptRecord if r.ScriptTag in ("cyrl", "DFLT")]
    indexes = {i for i, r in enumerate(gsub.FeatureList.FeatureRecord) if r.FeatureTag == "ccmp"}
    for script in cyrillic:
        systems = [script.DefaultLangSys] + [r.LangSys for r in script.LangSysRecord]
        for system in systems:
            if system is not None and not indexes & set(system.FeatureIndex):
                raise ValueError("a Cyrillic language in the font does not use ccmp")
    if not cyrillic:
        raise ValueError("the font has no Cyrillic or default script for the rule")


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


def rename(font, top, old, new):
    """Give the font another family name, with and without the space
    (Nyght Serif, NyghtSerif), wherever a program might show it."""
    pairs = [(old, new), (old.replace(" ", ""), new.replace(" ", ""))]

    def renamed(text):
        for before, after in pairs:
            text = text.replace(before, after)
        return text

    # 1 family, 3 unique id, 4 full name, 6 PostScript name, 16 typographic family
    for record in font["name"].names:
        if record.nameID in (1, 3, 4, 6, 16):
            record.string = renamed(record.toUnicode())
    cff = font["CFF "].cff
    cff.fontNames = [renamed(name) for name in cff.fontNames]
    for field in ("FullName", "FamilyName"):
        if hasattr(top, field):
            setattr(top, field, renamed(getattr(top, field)))


def add_stress(path, new_name=None):
    font = TTFont(path, lazy=False)
    cmap = font.getBestCmap()
    first = f"uni{ord('а'):04X}0301"
    if first in font.getGlyphOrder():
        print(f"{path}: already has the stressed vowels, left alone")
        return

    glyph_set = font.getGlyphSet()
    top = font["CFF "].cff.topDictIndex[0]
    hmtx = font["hmtx"]
    new = []

    mark_name = cmap.get(ACUTE)
    if mark_name is None:
        # The mark by itself: no width, and drawn to the left of where the pen
        # stands, over a letter of ordinary width. A browser that knows the
        # letter under it moves it to the middle of that letter.
        mark_name = NEW_MARK_NAME
        box = glyph_bounds(glyph_set, "acute")
        program, drawn = charstring(top, glyph_set, 0, [("acute", round(-250 - middle(box)), 0)])
        new.append((mark_name, program, 0, drawn))

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

    if mark_name == NEW_MARK_NAME:
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[ACUTE] = mark_name
        # Class 3 is "mark": kerning looks past it
        font["GDEF"].table.GlyphClassDef.classDefs[mark_name] = 3
    add_substitution(font, stressed, mark_name)
    copy_kerning(font, stressed)

    for record in font["name"].names:
        if record.nameID == 5 and VERSION_NOTE not in record.toUnicode():
            record.string = record.toUnicode() + VERSION_NOTE
    if new_name:
        rename(font, top, *new_name)

    font.save(path)

    # Read the file back: every new glyph is there and as wide as its vowel
    check = TTFont(path)
    after = check.getGlyphSet()
    assert check.getBestCmap()[ACUTE] == mark_name
    for base, name in stressed.items():
        assert after[name].width == after[base].width, name
    if new_name:
        assert not any(new_name[0] in r.toUnicode() for r in check["name"].names if r.nameID in (1, 4, 16))
    print(f"{path}: added {len(stressed)} stressed vowels, {len(check.getGlyphOrder())} glyphs")


if __name__ == "__main__":
    arguments = sys.argv[1:]
    new_name = None
    if arguments[:1] == ["--rename"]:
        new_name = tuple(arguments[1].split("=", 1))
        arguments = arguments[2:]
    paths = [path for pattern in arguments for path in sorted(glob.glob(pattern))]
    if not paths or (new_name and len(new_name) != 2):
        sys.exit(__doc__)
    for path in paths:
        add_stress(path, new_name)
