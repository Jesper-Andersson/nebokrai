#!/usr/bin/env python3
"""Make the recordings of the stories for /read.

Usage:
    python3 data/fetch_story_audio.py nebokrai.db [--raw data/raw/storybooks] [--ffmpeg path/to/ffmpeg]

Each page of a Storybooks story is read aloud by a person, one mp3 per page.
This script takes the pages from the `text_pages` table that import_stories.py
fills, so only the CC BY stories kept there are fetched, and

1. keeps each original in data/raw/storybooks/<number>/audio/ (about 55 MB in
   all; a file already there is not fetched again),
2. re-encodes it with ffmpeg to mono mp3 at 48 kbit/s, enough for a voice, into
   the page's `audio` path under static/ (static/audio/texts/<slug>/02.mp3),
   about 15 to 20 MB in all, and
3. prints how many files it made and their size.

The recordings carry the licence of their story, which the reader page credits
with the reader's name ("Read by" in the story's credits). Re-encoding changes
nothing that can be heard, so it is not listed among the changes.

Needs ffmpeg (https://ffmpeg.org), on the PATH or named with --ffmpeg. Run it
again after import_stories.py when a slug or a page changed.
"""
import argparse
import sqlite3
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from import_stories import AGENT, RAW, ROOT

BITRATE = "48k"


def run(ffmpeg, *args):
    done = subprocess.run([ffmpeg, "-hide_banner", "-nostdin", "-y", *args], capture_output=True)
    if done.returncode:
        sys.exit(done.stderr.decode("utf-8", "replace")[-2000:])


def fetch(url, target):
    if target.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=60) as r:
        data = r.read()
    target.write_bytes(data)
    time.sleep(0.3)
    return True


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Fetch and re-encode the recordings of the stories.")
    ap.add_argument("database")
    ap.add_argument("--raw", type=Path, default=RAW, help="folder of the downloaded story pages")
    ap.add_argument("--ffmpeg", default="ffmpeg")
    args = ap.parse_args()

    db = sqlite3.connect(args.database)
    pages = db.execute(
        "SELECT t.source_id, p.page, p.audio, p.audio_url FROM text_pages p JOIN texts t ON t.id = p.text_id"
        " ORDER BY t.source_id, p.page").fetchall()
    if not pages:
        sys.exit("No pages in text_pages: run import_stories.py first.")

    fetched = made = size = 0
    for source_id, page, audio, url in pages:
        original = args.raw / source_id / "audio" / f"{page:02d}.mp3"
        fetched += fetch(url, original)
        target = ROOT / "static" / audio.lstrip("/")
        target.parent.mkdir(parents=True, exist_ok=True)
        run(args.ffmpeg, "-i", str(original), "-map_metadata", "-1", "-ac", "1", "-c:a", "libmp3lame",
            "-b:a", BITRATE, str(target))
        made += 1
        size += target.stat().st_size

    print(f"{len(pages)} pages, {fetched} originals fetched now, {made} mp3 files made,"
          f" {size / 1e6:.1f} MB in static/audio/texts/")
