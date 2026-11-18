#!/usr/bin/env python3
"""Write the placement test's made-up words into a dictionary database that is already built.

Usage:
    python3 data/add_placement_pseudo.py nebokrai.db [--sample N]

    --sample N   print N of the words made, drawn at random, to read through

A full build (import_wiktionary.py) writes them too, as the meta row
`placement_pseudo`. This script is for adding or changing them without a full
build, which would give every entry a new id. Only that one row changes, so a
database already in Cloudflare D1 needs only it (see "Publishing to D1" in
data/README.md), not a full reload.

The words are checked against nebokrai.db here and against VESUM only when the
test is served (src/routes/api/placement): VESUM's licence keeps it out of
this file.

Only the Python standard library is used.
"""
import argparse
import json
import random
import sqlite3
import sys

from import_wiktionary import pseudo_candidates


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("database")
    ap.add_argument("--sample", type=int, default=0)
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    db = sqlite3.connect(args.database)
    words = pseudo_candidates(db)
    db.execute("INSERT OR REPLACE INTO meta VALUES ('placement_pseudo', ?)", (json.dumps(words, ensure_ascii=False),))
    db.commit()
    db.close()
    print(f"{args.database}: {len(words)} made-up words in meta.placement_pseudo")
    for word in random.sample(words, min(args.sample, len(words))):
        print(" ", word)


if __name__ == "__main__":
    main()
