#!/usr/bin/env python3
"""Write the list of dictionary words for suggestions in the browser.

Usage:
    python3 data/export_wordlist.py nebokrai.db static/words.json

The output is a JSON array of headwords (with stress marks), most common first.
The site downloads it once and suggests words while the user types, without
asking the database (see src/lib/search/client-suggest.ts).
"""
import json
import sqlite3
import sys

from import_wiktionary import NOT_VOCABULARY

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    db = sqlite3.connect(sys.argv[1])
    seen, words = set(), []
    for word, headword, pos in db.execute(
            "SELECT word, headword, pos FROM entries ORDER BY freq_rank IS NULL, freq_rank, word, id"):
        if pos in NOT_VOCABULARY or word in seen:
            continue
        seen.add(word)
        words.append(headword)
    with open(sys.argv[2], "w", encoding="utf-8") as out:
        json.dump(words, out, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(words)} words")
