#!/usr/bin/env python3
"""Decide whether a word that a source offers is new to the dictionary.

Every importer that adds entries asks this before it adds one: the
translation tables now, other sources later. A word is not new when the
dictionary already has it under another guise:

    same-word   the spelling is an entry with the same part of speech
    other-pos   the spelling is an entry, but with another part of speech
    form        the spelling is a cell of an entry's table (книги, читаю)
    spelling    another spelling of an entry or of one of its forms, with the
                same part of speech: удома for вдома, ізо for з, проект for
                проєкт, ґанок for ганок

A `spelling` match is only offered when the other spelling is in the
dictionary; nothing here invents words. Two real words can still meet this
way: уступати "to yield" and вступати "to enter", уходити "to leave" and
входити "to come in", гвалтувати "to rape" and ґвалтувати "to shout". So when
the caller knows the candidate's English meanings, a spelling match also needs
one English word in common with the entry it meets (`spelling-differs`
otherwise, and the word is new). Every verdict is written to a review file
with the entry it matched.

Keys are compared after import_wiktionary.plain(): no stress, lowercase, one
apostrophe. The caller passes keys in that form, so this module needs no
import of its own and changes no search key: search parity is untouched.

    python3 data/new_words.py --selftest
"""
import collections
import sys

# Prepositions that are one word written three ways (з книжкою, із книжкою,
# зі мною) and a fourth, older one (зо мною).
Z_FAMILY = frozenset({"з", "із", "зі", "зо"})
VOWELS = frozenset("аеиіїоуюяє")


def fold(key):
    """The key with the 2019 spelling folded into the 1993 one: є after a
    vowel in -єкт (проєкт, проект; траєкторія, траекторія)."""
    return key.replace("оєкт", "оект").replace("аєкт", "аект")


def other_spellings(key):
    """Keys of the other spellings of the same word, folded, the word's own
    folded key included.

    у/в and і/й alternate at the start of a word before a consonant, by the
    sound of the word before it: удома and вдома, уміти and вміти, іти and
    йти. Before a vowel there is no such choice (вухо is not ухо).

    A ґ in the candidate may stand for the г of the dictionary's spelling, as
    in loanwords and names written the older way (Норвеґія, блоґ). Not the
    other way round: a г where the dictionary has ґ is as often another word
    (гуля "bump", ґуля "ball"; гвалтувати, ґвалтувати)."""
    found = {fold(key)}
    if "ґ" in key:
        found.add(fold(key.replace("ґ", "г")))
    if key in Z_FAMILY:
        found |= Z_FAMILY
    if len(key) > 2 and key[1] not in VOWELS:
        swap = {"у": "в", "в": "у", "і": "й", "й": "і"}.get(key[0])
        if swap:
            found.add(fold(swap + key[1:]))
    return found


class Known:
    """What the dictionary has, indexed for check().

    words: (key, entry id, part of speech) for every entry
    forms: (key, entry id, part of speech of the entry) for every table cell
    """

    def __init__(self, words, forms):
        self.words = collections.defaultdict(list)    # key -> [(id, pos)]
        self.forms = collections.defaultdict(list)
        self.folded_words = collections.defaultdict(list)
        self.folded_forms = collections.defaultdict(list)
        for key, eid, pos in words:
            self.add_word(key, eid, pos)
        for key, eid, pos in forms:
            self.forms[key].append((eid, pos))
            self.folded_forms[fold(key)].append((eid, pos))

    def add_word(self, key, eid, pos):
        """Count an entry the caller has just added, so a later candidate
        with another spelling of it is caught too."""
        self.words[key].append((eid, pos))
        self.folded_words[fold(key)].append((eid, pos))

    def check(self, key, pos, meanings=None, english=None, spellings=True):
        """(verdict, reason, entry ids): verdict is 'new' or 'known'.

        `meanings` is the candidate's set of English words and `english` maps
        an entry id to its own; with both, a spelling match needs a word in
        common. `spellings=False` leaves the spelling rules out, for a caller
        that asks them later, once it has all of a candidate's meanings.

        For same-word and spelling, the ids are the entries of the same part
        of speech, which may take the candidate's meanings as search keys.
        For the others they are the entries matched, for the review."""
        same = [eid for eid, p in self.words.get(key, ()) if p == pos]
        if same:
            return "known", "same-word", same
        if key in self.words:
            return "known", "other-pos", [eid for eid, _ in self.words[key]]
        if key in self.forms:
            return "known", "form", sorted({eid for eid, _ in self.forms[key]})
        if not spellings:
            return "new", "", []
        others = other_spellings(key)
        differs = []
        for reason, index in (("spelling", self.folded_words), ("spelling-of-form", self.folded_forms)):
            same = sorted({eid for k in others for eid, p in index.get(k, ()) if p == pos})
            if same and meanings is not None and english is not None:
                differs += same
                same = [eid for eid in same if meanings & english.get(eid, set())]
            if same:
                return "known", reason, same
        if differs:
            return "new", "spelling-differs", sorted(set(differs))
        return "new", "", []


def from_db(db, exclude_source=None):
    """A Known filled from nebokrai.db's search keys. Entries whose source is
    `exclude_source` are left out, so an importer is not matched against the
    entries it is about to make."""
    where = "WHERE e.source != ?" if exclude_source else ""
    args = (exclude_source,) if exclude_source else ()
    rows = db.execute(
        "SELECT k.key, k.entry_id, e.pos, k.kind FROM search_keys k JOIN entries e ON e.id = k.entry_id "
        f"{where} {'AND' if where else 'WHERE'} k.kind IN ('word', 'form')", args).fetchall()
    return Known([(k, eid, pos) for k, eid, pos, kind in rows if kind == "word"],
                 [(k, eid, pos) for k, eid, pos, kind in rows if kind == "form"])


def write_review(path, rows):
    """rows: (source, word, pos, verdict, reason, matched words). Tab-separated,
    for reading, never for loading."""
    with open(path, "w", encoding="utf-8", newline="\n") as out:
        out.write("source\tword\tpos\tverdict\treason\tmatched\n")
        for row in rows:
            out.write("\t".join(row) + "\n")


def selftest():
    known = Known(
        words=[("книга", 1, "noun"), ("вдома", 2, "adv"), ("з", 3, "prep"), ("проєкт", 4, "noun"),
               ("ганок", 5, "noun"), ("уміти", 6, "verb"), ("вухо", 7, "noun"), ("добре", 8, "adv")],
        forms=[("книги", 1, "noun"), ("проєкту", 4, "noun")])
    cases = [
        (("книга", "noun"), ("known", "same-word", [1])),
        (("книги", "noun"), ("known", "form", [1])),
        (("добре", "adj"), ("known", "other-pos", [8])),
        (("удома", "adv"), ("known", "spelling", [2])),
        (("вміти", "verb"), ("known", "spelling", [6])),
        (("зі", "prep"), ("known", "spelling", [3])),
        (("проект", "noun"), ("known", "spelling", [4])),
        (("проекту", "noun"), ("known", "spelling-of-form", [4])),
        (("ґанок", "noun"), ("known", "spelling", [5])),
        (("ухо", "noun"), ("new", "", [])),         # before a vowel у/в do not alternate
        (("удома", "noun"), ("new", "", [])),       # a spelling counts only with the same part of speech
        (("шериф", "noun"), ("new", "", [])),
        (("книги", "noun", {"book"}), ("known", "form", [1])),
    ]
    # With meanings: a spelling match needs an English word in common
    known.add_word("вступати", 9, "verb")
    known.add_word("ґуля", 10, "noun")
    english = {2: {"home"}, 9: {"enter", "join"}, 10: {"ball"}}
    cases += [
        (("удома", "adv", {"home", "at"}), ("known", "spelling", [2])),
        (("уступати", "verb", {"yield", "give"}), ("new", "spelling-differs", [9])),
        (("гуля", "noun", {"bump"}), ("new", "", [])),   # г where the dictionary has ґ is not folded
    ]
    failed = 0
    for args, want in cases:
        key, pos = args[:2]
        got = known.check(key, pos, *args[2:], english if len(args) > 2 else None)
        if got != want:
            failed += 1
            print(f"FAIL {key} {pos}: {got}, wanted {want}")
    print(f"{len(cases) - failed} of {len(cases)} passed")
    return failed == 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1:] == ["--selftest"]:
        sys.exit(0 if selftest() else 1)
    print(__doc__)
