#!/usr/bin/env python3
"""Pull the Ukrainian translations out of the kaikki.org English extract.

Usage, from the repo root:
    curl -L https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz \\
        | python3 data/extract_translations.py > data/raw/uk_translations.jsonl

An English Wiktionary entry lists translations of each of its meanings. Under
"book" (noun), for the meaning "collection of sheets of paper bound together",
the Ukrainian is кни́га. Those lists name several thousand Ukrainian words that
have no entry of their own yet, with their stress and often their gender.

The English extract is 534 MB compressed and 3.4 GB unpacked, nearly all of it
about other languages, so it is read as a stream and never stored. What is
kept is one line per translation, 53,511 lines and 8 MB in October 2026:

    {"en": "book", "pos": "noun", "sense": "collection of sheets of paper ...",
     "uk": "кни́га", "roman": "knýha", "tags": ["feminine"]}

import_wiktionary.py reads that file with --translations. Only the Python
standard library is used.
"""
import gzip
import json
import sys


def ukrainian(entry):
    """The Ukrainian translations of one English entry, wherever kaikki put
    them: on the entry, or on the meaning they belong to."""
    lists = [entry.get("translations") or []]
    lists += [s.get("translations") or [] for s in entry.get("senses") or []]
    for translations in lists:
        for t in translations:
            if (t.get("lang_code") or t.get("code")) != "uk" or not t.get("word"):
                continue
            row = {"en": entry["word"], "pos": entry.get("pos"), "sense": t.get("sense") or "",
                   "uk": t["word"]}
            for field in ("roman", "tags", "note", "alt", "english"):
                if t.get(field):
                    row[field] = t[field]
            yield row


if __name__ == "__main__":
    source = gzip.open(sys.stdin.buffer, "rt", encoding="utf-8")
    out = open(sys.stdout.fileno(), "w", encoding="utf-8", newline="\n", closefd=False)
    entries = kept = 0
    try:
        for line in source:
            entries += 1
            # Cheap test first: most of the 1.5 million lines have no Ukrainian
            if '"uk"' not in line:
                continue
            for row in ukrainian(json.loads(line)):
                out.write(json.dumps(row, ensure_ascii=False) + "\n")
                kept += 1
    except EOFError:  # a download that was cut short; say so and keep what there is
        print("warning: the input ended early", file=sys.stderr)
    out.flush()
    print(f"{entries} English entries read, {kept} Ukrainian translations kept", file=sys.stderr)
