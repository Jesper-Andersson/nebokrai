#!/usr/bin/env python3
"""Build vesum.db: a form -> dictionary word lookup from VESUM.

Usage:
    pip install pymorphy3 pymorphy3-dicts-uk
    python3 import_vesum.py vesum.db

VESUM (Великий електронний словник української мови, the BrUK team) lists
over 400,000 Ukrainian words with all their inflected forms. It has no
definitions; Nebokrai uses it for one thing: finding the dictionary word for a
form that Wiktionary does not know.

LICENCE: VESUM data is CC BY-NC-SA 4.0 (non-commercial). Wiktionary data is
CC BY-SA 4.0. The two cannot be merged into one dataset, so this script writes
a SEPARATE database file and nothing from it is ever copied into nebokrai.db.
Deleting vesum.db removes VESUM from the site completely.

The data is read from the pymorphy3-dicts-uk package, which is VESUM compiled
for the pymorphy3 library.
"""
import sqlite3
import sys

import pymorphy3

from import_wiktionary import plain

# pymorphy part-of-speech tags -> the names used in nebokrai.db
POS = {"NOUN": "noun", "VERB": "verb", "INFN": "verb", "GRND": "verb", "ADJF": "adj",
       "ADJS": "adj", "COMP": "adj", "PRTF": "adj", "PRTS": "adj", "ADVB": "adv",
       "NUMR": "num", "NPRO": "pron", "PREP": "prep", "CONJ": "conj", "PRCL": "particle",
       "INTJ": "intj", "PRED": "adv"}


def build(dst):
    morph = pymorphy3.MorphAnalyzer(lang="uk")
    db = sqlite3.connect(dst)
    db.executescript("""
        DROP TABLE IF EXISTS vesum_forms;
        DROP TABLE IF EXISTS meta;
        CREATE TABLE vesum_forms (
            form   TEXT NOT NULL,   -- lowercase, no stress: калиною
            lemma  TEXT NOT NULL,   -- dictionary word: калина
            pos    TEXT NOT NULL,   -- noun, verb, adj, ...
            PRIMARY KEY (form, lemma, pos)
        ) WITHOUT ROWID;
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    """)
    batch, parses = set(), 0
    for p in morph.iter_known_word_parses():
        parses += 1
        pos = POS.get(str(p.tag.POS), "other")
        batch.add((plain(p.word), plain(p.normal_form), pos))
        if len(batch) >= 500_000:
            db.executemany("INSERT OR IGNORE INTO vesum_forms VALUES (?,?,?)", batch)
            batch.clear()
    db.executemany("INSERT OR IGNORE INTO vesum_forms VALUES (?,?,?)", batch)
    rows = db.execute("SELECT count(*) FROM vesum_forms").fetchone()[0]
    lemmas = db.execute("SELECT count(DISTINCT lemma) FROM vesum_forms").fetchone()[0]
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("source", "VESUM (brown-uk/dict_uk) via pymorphy3-dicts-uk"),
        ("license", "CC BY-NC-SA 4.0 - non-commercial; keep separate from nebokrai.db"),
    ])
    db.commit()
    db.execute("VACUUM")
    db.close()
    return dict(parses=parses, rows=rows, lemmas=lemmas)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    for k, v in build(sys.argv[1]).items():
        print(f"{k:>8}: {v}")
