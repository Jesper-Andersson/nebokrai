#!/usr/bin/env python3
"""Find the words of a pile of Ukrainian text that nebokrai.db has no entry for,
and say what kind of word each is.

Usage:
    pip install pymorphy3 pymorphy3-dicts-uk
    python3 data/fetch_text.py wiki-titles TEXT_DIR/wiki "Хліб" "Міст" ...
    python3 data/missing_words.py nebokrai.db TEXT_DIR OUT_DIR [--stoplist FILE] [--labels FILE]

TEXT_DIR holds .txt files, in one folder per source (fetch_text.py writes
them). Every word is looked up as a headword or a listed form; what is not
found is given its dictionary form and grammar by VESUM (through pymorphy3) and
sorted into categories. OUT_DIR gets three files:

    remaining-words.tsv  every unknown word with its category, counts and an example
    backlog.tsv          the ordinary words seen in three or more texts: what to define next
    stoplist.tsv         spellings not worth reporting again: names seen once, Russian, fragments

--stoplist takes a stoplist.tsv from an earlier run and leaves its spellings
out, so that a new pile of text reports only what is new. --labels takes
"spelling<TAB>label<TAB>dictionary form" lines that say what a proper noun
names (place, person, organisation, work-or-brand, people-or-language,
other-name, not-a-name) where VESUM does not.

LICENCE: the dictionary forms and categories come from VESUM, CC BY-NC-SA 4.0.
The output is a working list. It is never committed, never loaded into
nebokrai.db and never shipped; the script refuses to write it into a folder
that git tracks.
"""
import argparse
import collections
import os
import re
import sqlite3
import subprocess
import sys

import pymorphy3

from import_wiktionary import plain

TOKEN = re.compile(r"[а-щьюяєіїґА-ЩЬЮЯЄІЇҐыэъёЫЭЪЁ'ʼ’́-]+")
RUSSIAN = re.compile(r"[ыэъё]")
SENTENCE = re.compile(r"[^.!?\n]+[.!?]?")
# "англ. word", "ст. до н. е.": a full stop with the sentence going on after it marks an abbreviation.
DOTTED = re.compile(r"(?<![а-щьюяєіїґА-ЩЬЮЯЄІЇҐ'’ʼ-])([а-щьюяєіїґА-ЩЬЮЯЄІЇҐ'’ʼ-]+)\.(?=\s*[а-щьюяєіїґa-z0-9,;:)\]«\"—–-])")
VOWEL = re.compile(r"[аеиіоуяюєї]")
PERSON = {"Name": "person: given name", "Patr": "person: patronymic", "Surn": "person: surname"}
STYLE = {"Slng": "slang", "Arch": "archaic", "Infr": "informal", "Bad": "nonstandard", "Dist": "distorted",
         "Coll": "colloquial", "Rare": "rare", "Vulg": "vulgar", "Subx": "substandard", "Obsc": "obscene"}
LABELS = {"place": "place", "person": "person: labelled", "organisation": "organisation",
          "work-or-brand": "work or brand", "people-or-language": "people, language or name-derived adjective",
          "other-name": "other proper noun", "not-a-name": "capitalised common word, typo or fragment"}
ONCE = "proper noun, seen once, not labelled"
# What a later run need not report again.
STOP = {ONCE, "not Ukrainian: Russian", "unrecognised, sentence-initial only",
        "capitalised common word, typo or fragment"}
# What search already answers although there is no entry: a name is called a name, and a reflexive verb
# leads to the verb it is made from.
ANSWERED = "common: reflexive verb, base verb has an entry"


def norm(token):
    return plain(token).strip("'-")


def refuse_tracked(out_dir):
    """Stop when OUT_DIR is inside the repository and git does not ignore it."""
    here = os.path.dirname(os.path.abspath(__file__))
    probe = os.path.join(os.path.abspath(out_dir), "remaining-words.tsv")
    try:
        root = subprocess.run(["git", "-C", here, "rev-parse", "--show-toplevel"],
                              capture_output=True, text=True).stdout.strip()
        if not root or os.path.commonpath([os.path.abspath(root), probe]) != os.path.abspath(root):
            return
        ignored = subprocess.run(["git", "-C", root, "check-ignore", "-q", probe]).returncode == 0
    except (OSError, ValueError):
        return
    if not ignored:
        sys.exit(f"{out_dir} is tracked by git. The lists are derived from VESUM and must not be committed:"
                 " write them outside the repository or into an ignored folder.")


def main():
    ap = argparse.ArgumentParser(description="List and categorise the words nebokrai.db lacks.")
    ap.add_argument("database")
    ap.add_argument("text_dir")
    ap.add_argument("out_dir")
    ap.add_argument("--stoplist")
    ap.add_argument("--labels")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # Windows defaults to cp1252 when redirected
    refuse_tracked(args.out_dir)

    stop = set()
    if args.stoplist:
        with open(args.stoplist, encoding="utf-8") as handle:
            stop = {line.split("\t")[0].strip() for line in handle if line.strip()}
    labels = {}
    if args.labels:
        with open(args.labels, encoding="utf-8") as handle:
            for line in handle:
                cells = line.rstrip("\n").split("\t")
                if len(cells) >= 2 and cells[1].strip() in LABELS:
                    base = norm(cells[2].strip()) if len(cells) > 2 else ""
                    labels[cells[0].strip()] = (cells[1].strip(), base or cells[0].strip())

    db = sqlite3.connect(f"file:{args.database}?mode=ro", uri=True)
    known, verbs = set(), set()
    for word, pos in db.execute("SELECT word, pos FROM entries"):
        word = norm(word)
        known.add(word)
        known.add(word.rstrip(". "))    # ст for ст.
        known.update(word.split())      # Європейський Союз covers both of its words
        if pos == "verb":
            verbs.add(word)
    for (form,) in db.execute("SELECT DISTINCT plain FROM forms"):
        known.add(norm(form))

    count = collections.Counter()
    lower = collections.Counter()    # written in lower case
    capital = collections.Counter()  # written with a capital away from the start of a sentence
    dotted = collections.Counter()   # followed by a full stop inside a sentence
    docs = collections.defaultdict(set)
    sources = collections.defaultdict(set)
    example = {}
    total = files = stopped = 0
    for folder, _, names in os.walk(args.text_dir):
        source = os.path.relpath(folder, args.text_dir).split(os.sep)[0]
        for name in names:
            if not name.endswith(".txt"):
                continue
            files += 1
            with open(os.path.join(folder, name), encoding="utf-8", errors="replace") as handle:
                text = handle.read()
            for found in DOTTED.findall(text):
                dotted[norm(found)] += 1
            for sentence in SENTENCE.findall(text):
                for at, match in enumerate(TOKEN.finditer(sentence)):
                    raw = match.group().replace("́", "").replace("’", "'").replace("ʼ", "'").strip("'-")
                    if len(raw) < 2:
                        continue
                    total += 1
                    key = raw.lower()
                    if key in known or ("-" in key and all(p in known for p in key.split("-") if p)):
                        continue
                    if key in stop:
                        stopped += 1
                        continue
                    count[key] += 1
                    if raw == key:
                        lower[key] += 1
                    elif at > 0:
                        capital[key] += 1
                    docs[key].add(name)
                    sources[key].add(source)
                    example.setdefault(key, sentence.strip()[:140])

    def abbreviated(key):
        """Mostly written with a full stop mid-sentence, or too short and vowelless to be a word."""
        return dotted[key] * 2 >= count[key] or (len(key) <= 4 and not VOWEL.search(key))

    morph = pymorphy3.MorphAnalyzer(lang="uk")
    words = {}  # (word, category) -> [count, texts, sources, spellings, part of speech, style, example]
    form_gaps = 0

    def add(word, category, key, pos="", style=""):
        slot = words.setdefault((word, category), [0, set(), set(), set(), pos, style, example[key]])
        slot[0] += count[key]
        slot[1] |= docs[key]
        slot[2] |= sources[key]
        slot[3].add(key)

    for key in count:
        proper = lower[key] == 0 and capital[key] > 0
        unclear = lower[key] == 0 and capital[key] == 0   # only ever at the start of a sentence
        parses = [p for p in morph.parse(key) if p.is_known]
        if any(norm(p.normal_form) in known for p in parses):
            form_gaps += count[key]     # the word has an entry; this form is not in its table
            continue
        if not parses:
            if RUSSIAN.search(key):
                add(key, "not Ukrainian: Russian", key)
            elif abbreviated(key):
                add(key, "abbreviation", key)
            elif proper:
                add(key, "proper noun, untagged", key)
            elif "-" in key:
                add(key, "hyphenated compound", key)
            elif unclear:
                add(key, "unrecognised, sentence-initial only", key)
            else:
                add(key, "unrecognised: new word, borrowing or typo", key)
            continue

        # A word never written small is read as a name where VESUM offers one, and the other way round.
        def fit(p):
            return bool({"Name", "Surn", "Patr"} & set(p.tag.grammemes)) == (proper or unclear)
        p = next((p for p in parses if fit(p)), parses[0])
        grams = set(p.tag.grammemes)
        lemma = norm(p.normal_form)
        pos = str(p.tag.POS or "")
        style = ", ".join(v for k, v in STYLE.items() if k in grams)
        person = next((v for k, v in PERSON.items() if k in grams), None)
        if person and (proper or unclear):
            category = person
        elif "Abbr" in grams or abbreviated(key):
            category = "abbreviation"
        elif proper:
            category = "proper noun, untagged"
        elif pos in ("VERB", "INFN") and "Refl" in grams:
            category = ANSWERED if lemma[:-2] in verbs else "common: reflexive verb"
        elif pos in ("VERB", "INFN"):
            category = "common: verb"
        elif pos == "GRND":
            category = "common: verbal adverb"
        elif pos in ("ADJF", "ADJS", "PRTF") and ({"pssv", "actv"} & grams or pos == "PRTF"):
            category = "common: participle"
        elif pos in ("ADJF", "ADJS", "COMP") and lemma.startswith("най") and len(lemma) > 6:
            category = "common: superlative"
        elif pos == "COMP" or (pos in ("ADJF", "ADJS") and lemma.endswith(("іший", "ший"))):
            category = "common: comparative"
        elif pos in ("ADJF", "ADJS"):
            category = "common: adjective"
        elif pos == "NOUN" and lemma.endswith(("ння", "ття")):
            category = "common: verbal noun"
        elif pos == "NOUN":
            category = "common: noun"
        elif pos == "ADVB":
            category = "common: adverb"
        else:
            category = "common: other (numeral, pronoun, particle...)"
        add(lemma, category, key, pos, style)

    # The labels settle what a proper noun names and give its dictionary form, so that драпатого and
    # драпатому become one row, драпатий.
    merged = {}
    for (word, category), s in words.items():
        if category in ("proper noun, untagged", "unrecognised, sentence-initial only"):
            if word in labels:
                label, word = labels[word]
                category = LABELS[label]
            elif category == "proper noun, untagged":
                category = ONCE if s[0] == 1 else "proper noun, not labelled"
        slot = merged.setdefault((word, category), [0, set(), set(), set(), s[4], s[5], s[6]])
        slot[0] += s[0]
        slot[1] |= s[1]
        slot[2] |= s[2]
        slot[3] |= s[3]
    rows = [(word, category, s[4], s[5], s[0], len(s[1]), len(s[2]), sorted(s[3]), s[6])
            for (word, category), s in merged.items()]
    rows.sort(key=lambda r: (r[1], -r[5], -r[4], r[0]))

    os.makedirs(args.out_dir, exist_ok=True)

    def write(name, header, lines):
        with open(os.path.join(args.out_dir, name), "w", encoding="utf-8", newline="\n") as out:
            out.write("\t".join(header) + "\n")
            for line in lines:
                out.write("\t".join(str(cell) for cell in line) + "\n")
        return len(lines)

    write("remaining-words.tsv",
          ("word", "category", "pos", "style", "count", "texts", "sources", "spellings", "example"),
          [r[:7] + (" ".join(r[7][:6]), r[8]) for r in rows])
    # What to define next: ordinary words met in three or more texts, the most widespread first.
    backlog = sorted((r for r in rows if r[1].startswith("common:") and r[1] != ANSWERED and r[5] >= 3),
                     key=lambda r: (-r[5], -r[4], r[0]))
    write("backlog.tsv", ("word", "kind", "texts", "count", "sources", "example"),
          [(r[0], r[1][len("common: "):], r[5], r[4], r[6], r[8]) for r in backlog])
    stop_rows = [(spelling, r[1]) for r in rows for spelling in r[7]
                 if r[1] in STOP or (r[1] == "hyphenated compound" and r[4] == 1)]
    write("stoplist.tsv", ("spelling", "why"), sorted(set(stop_rows) | {(s, "from an earlier run") for s in stop}))

    table = collections.defaultdict(lambda: [0, 0, 0, []])
    for word, category, _, _, n, texts, _, _, _ in rows:
        slot = table[category]
        slot[0] += 1
        slot[1] += n
        slot[2] += texts >= 3
        if len(slot[3]) < 5:
            slot[3].append(word)
    print(f"texts {files}, running words {total}, unknown {sum(count.values())},"
          f" left out by the stoplist {stopped}, forms missing from an existing entry {form_gaps}")
    print(f"backlog {len(backlog)} words, stoplist {len(set(stop_rows)) + len(stop)} spellings")
    print("category | words | occurrences | words in 3+ texts | most widespread")
    for category, (n, occ, wide, top) in sorted(table.items(), key=lambda item: -item[1][1]):
        print(f"{category} | {n} | {occ} | {wide} | {' '.join(top)}")


if __name__ == "__main__":
    main()
