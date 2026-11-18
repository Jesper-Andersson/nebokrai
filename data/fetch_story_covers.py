#!/usr/bin/env python3
"""Make the covers of the stories for /read.

Usage:
    python3 data/fetch_story_covers.py nebokrai.db [--raw data/raw/storybooks] [--ffmpeg path/to/ffmpeg]

A story's cover is the picture of its first page on Storybooks (`texts.cover_url`,
which import_stories.py fills), so only the CC BY stories kept there are fetched.
The script

1. keeps each original in data/raw/storybooks/<number>/cover.jpg (about 1.3 MB
   in all; a file already there is not fetched again),
2. scales it with ffmpeg to 480 pixels wide and writes it as WebP into
   src/lib/assets/covers/<slug>.webp, where src/lib/covers.ts finds it, and
3. prints how many it made and their size.

The site never loads a picture from Storybooks itself: a visitor's browser
asks only this site. The pictures carry their story's licence, and the
reader page credits the illustrator.

Needs ffmpeg (https://ffmpeg.org), on the PATH or named with --ffmpeg. Run it
again after import_stories.py when a slug changed.
"""
import argparse
import sqlite3
import sys
from pathlib import Path

from fetch_story_audio import fetch, run
from import_stories import RAW, ROOT

WIDTH = 480
QUALITY = "75"

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Fetch the covers of the stories and make WebP copies.")
    ap.add_argument("database")
    ap.add_argument("--raw", type=Path, default=RAW, help="folder of the downloaded story pages")
    ap.add_argument("--ffmpeg", default="ffmpeg")
    args = ap.parse_args()

    db = sqlite3.connect(args.database)
    texts = db.execute("SELECT source_id, slug, cover_url FROM texts WHERE cover_url IS NOT NULL ORDER BY source_id").fetchall()
    if not texts:
        sys.exit("No covers in texts: run import_stories.py first.")

    out = ROOT / "src" / "lib" / "assets" / "covers"
    out.mkdir(parents=True, exist_ok=True)
    fetched = made = size = 0
    for source_id, slug, url in texts:
        original = args.raw / source_id / "cover.jpg"
        fetched += fetch(url, original)
        target = out / f"{slug}.webp"
        run(args.ffmpeg, "-i", str(original), "-map_metadata", "-1", "-vf", f"scale={WIDTH}:-2",
            "-c:v", "libwebp", "-quality", QUALITY, str(target))
        made += 1
        size += target.stat().st_size
    print(f"{len(texts)} stories, {fetched} originals fetched now, {made} covers made,"
          f" {size / 1e6:.2f} MB in src/lib/assets/covers/")
