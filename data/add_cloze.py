#!/usr/bin/env python3
"""Make the `cloze` table again in a dictionary database that is already built.

Usage:
    python3 data/add_cloze.py nebokrai.db data/raw [--sample N]

    --sample N   print N of the sentences kept, drawn at random, to read through

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

from import_wiktionary import CLOZE_SCHEMA, add_cloze, form_index, tatoeba_pairs

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Rebuild the sentences with a gap for grammar practice.")
    ap.add_argument("database")
    ap.add_argument("tatoeba", help="folder holding the three Tatoeba files")
    ap.add_argument("--sample", type=int, default=0)
    args = ap.parse_args()

    db = sqlite3.connect(args.database)
    db.executescript("DROP TABLE IF EXISTS cloze;" + CLOZE_SCHEMA)
    stats = add_cloze(db, form_index(db), tatoeba_pairs(args.tatoeba))
    db.execute("INSERT OR REPLACE INTO meta VALUES ('cloze_points', ?)", (json.dumps(stats["cloze_points"]),))
    db.commit()

    for point, count in stats["cloze_points"].items():
        print(f"{point:>16}: {count}")
    print(f"{'sentences':>16}: {stats['cloze_sentences']}")
    print(f"{'too small':>16}: {', '.join(stats['cloze_points_too_small']) or '-'}")

    for point, uk, start, length, form, number, en in db.execute(
            "SELECT point, uk, start, length, form, number, en FROM cloze ORDER BY RANDOM() LIMIT ?", (args.sample,)):
        print(f"{point:>12} | {uk[:start]}[{uk[start:start + length]}]{uk[start + length:]} | {form} {number} | {en}")
    db.close()
