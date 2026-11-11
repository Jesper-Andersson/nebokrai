#!/usr/bin/env python3
"""Record what the reference search returns, for the TypeScript tests to match.

Usage:
    python3 data/make_search_cases.py nebokrai.db vesum.db > tests/search-cases.json

Run it again whenever the database or search.py changes.
"""
import json
import sqlite3
import sys

from search import search

QUERIES = [
    # exact words and inflected forms
    "калина", "книги", "читаю", "КАЛИНА", "кали́на", "стан", "за", "читано", "м'яти", "м’яти", "мʼяти", "м`яти", "м´яти", "м‘яти", "п`ять", "об`єднання",
    # Latin input
    "kalyna", "kalina", "khata", "xata", "pryvit", "Kyiv", "shchastia", "dobryi", "čytáty",
    # English meanings
    "good", "dog", "to go", "mother", "to read", "the horizon", "viburnum", "guelder rose", "in", "water",
    # search-as-you-type prefixes
    "кал", "неб", "чит", "kal", "neb", "pry",
    # only VESUM knows these
    "соловейком", "книжечку", "нездійсненними",
    # nothing, or nearly
    "", "   ", "qqqqzz", "ъъъ", "123", "don't",
]

if __name__ == "__main__":
    db = sqlite3.connect(sys.argv[1])
    vesum = sqlite3.connect(sys.argv[2])
    cases = []
    for q in QUERIES:
        for use_vesum in (False, True):
            got = search(db, q, limit=20, vesum=vesum if use_vesum else None)
            cases.append({"query": q, "vesum": use_vesum,
                          "expect": [[r["id"], r["word"], r["pos"], r["match"]] for r in got]})
    json.dump(cases, sys.stdout, ensure_ascii=False, indent=1)
