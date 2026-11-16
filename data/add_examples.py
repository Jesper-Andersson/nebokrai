#!/usr/bin/env python3
"""Make the `examples` table again in a dictionary database that is already built.

Usage:
    python3 data/add_examples.py nebokrai.db data/raw [--show WORD ...]

    --show WORD   print the sentences each entry spelt WORD now has, to read through

A full build (import_wiktionary.py) fills `examples` too. This script is for
changing how sentences are matched to entries without a full build: that would
give every entry a new id, and tests/search-cases.json would have to be
recorded again.

Only the Python standard library is used.
"""
import argparse
import sqlite3
import sys

from import_wiktionary import add_tatoeba, form_index, tatoeba_pairs, load_ratings, load_fixes

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Rebuild the example sentences shown on word pages.")
    ap.add_argument("database")
    ap.add_argument("tatoeba", help="folder holding the three Tatoeba files")
    ap.add_argument("--show", nargs="*", default=[])
    args = ap.parse_args()

    db = sqlite3.connect(args.database)
    if "adapted" not in {row[1] for row in db.execute("PRAGMA table_info(examples)")}:
        db.execute("ALTER TABLE examples ADD COLUMN adapted INTEGER NOT NULL DEFAULT 0")  # built before 2026-11-16
    db.execute("DELETE FROM examples")
    stats = add_tatoeba(db, form_index(db), tatoeba_pairs(args.tatoeba), ratings=load_ratings(),
                        fixes=load_fixes())
    db.commit()
    for key, value in stats.items():
        print(f"{key:>20}: {value}")

    for word in args.show:
        for eid, pos in db.execute("SELECT id, pos FROM entries WHERE word=? ORDER BY id", (word,)).fetchall():
            print(f"\n{word} ({pos})")
            for uk, en in db.execute("SELECT uk, en FROM examples WHERE entry_id=? ORDER BY id", (eid,)):
                print(f"    {uk} | {en}")
    db.execute("VACUUM")
    db.close()
