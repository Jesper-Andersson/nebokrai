#!/usr/bin/env python3
"""Make the `cloze` table again in a dictionary database that is already built.

Usage:
    python3 data/add_cloze.py nebokrai.db data/raw [--sample N]

    --sample N   print N of the sentences kept, drawn at random, to read through,
                 and N more of the case-government points (src/lib/practice/government.ts)

A full build (import_wiktionary.py) fills `cloze` too. This script is for
changing the grammar points or their rules without a full build: that would
give every entry a new id, and tests/search-cases.json would have to be
recorded again.

Only the Python standard library is used.
"""
import argparse
import json
import sqlite3
import sys

from import_wiktionary import CLOZE_SCHEMA, add_cloze, add_government, form_index, tatoeba_pairs, load_ratings

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Rebuild the sentences with a gap for grammar practice.")
    ap.add_argument("database")
    ap.add_argument("tatoeba", help="folder holding the three Tatoeba files")
    ap.add_argument("--sample", type=int, default=0)
    args = ap.parse_args()

    db = sqlite3.connect(args.database)
    db.executescript("DROP TABLE IF EXISTS cloze;" + CLOZE_SCHEMA)
    index, pairs, ratings = form_index(db), tatoeba_pairs(args.tatoeba), load_ratings()
    stats = add_cloze(db, index, pairs, ratings=ratings)
    government = add_government(db, index, pairs, ratings=ratings)
    points = {**stats["cloze_points"], **government["government_points"]}
    db.execute("INSERT OR REPLACE INTO meta VALUES ('cloze_points', ?)", (json.dumps(points),))
    db.commit()

    for point, count in stats["cloze_points"].items():
        print(f"{point:>16}: {count}")
    print(f"{'sentences':>16}: {stats['cloze_sentences']}")
    print(f"{'too small':>16}: {', '.join(stats['cloze_points_too_small']) or '-'}")
    print()
    print(f"{'government':>28}  found  made")
    for point, found in government["government_found"].items():
        made = government["government_made"][point]
        mark = "" if point in government["government_points"] else "  (too few: not offered)"
        print(f"{point:>28}  {found:>5}  {made:>4}{mark}")

    for where, label in (("cue_start IS NULL", "prepositions"), ("cue_start IS NOT NULL", "government")):
        if args.sample:
            print(f"\n--- {label} ---")
        for point, uk, start, length, form, number, en, sid in db.execute(
                f"SELECT point, uk, start, length, form, number, en, tatoeba_id FROM cloze WHERE {where}"
                " ORDER BY RANDOM() LIMIT ?", (args.sample,)):
            source = f"#{sid}" if sid else "frame"
            print(f"{point:>22} | {uk[:start]}[{uk[start:start + length]}]{uk[start + length:]} | {form} {number}"
                  f" | {en} | {source}")
    db.close()
