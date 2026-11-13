#!/usr/bin/env python3
"""Make the recordings of the letters for the alphabet page.

Usage:
    python3 data/letter_recordings.py [--ffmpeg path/to/ffmpeg]

Wikimedia Commons has a recording of each Ukrainian letter by one speaker
(every letter but ь, which has no sound of its own). As recorded, each begins
with up to a second of nothing and has a hiss under it, so the page does not
play them from Commons: this script

1. asks Commons for the files of the category and keeps each original in
   data/raw/letters/ (5 MB in all; a file already there is not fetched again),
2. cuts each down to the letter itself (without the clicks and breaths around
   it), takes the hiss down and brings every letter to the same loudness, with
   ffmpeg, into static/audio/letters/,
3. writes src/lib/alphabet/recordings.ts: where each letter's mp3 is, and the
   Commons page of the recording it was made from.

The mp3 files are adaptations of the originals and so are under the same
licence, CC BY-SA 4.0; the page says who read them and that they were changed.
One speaker and one licence for all of them is what lets it say so in one
line, so the script stops if a file differs.

Needs ffmpeg (https://ffmpeg.org), on the PATH or named with --ffmpeg, and no
database. Run it again only if the category or the cleaning changes.
"""
import argparse
import json
import math
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from array import array
from pathlib import Path

from import_wiktionary import national_translit

CATEGORY = "Category:Ukrainian pronunciation of letters by a young male uploaded by Tabrus"
API = "https://commons.wikimedia.org/w/api.php"
ALPHABET = "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя"
AGENT = {"User-Agent": "letter-recordings/1.0"}

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "letters"
OUT = ROOT / "static" / "audio" / "letters"
MODULE = ROOT / "src" / "lib" / "alphabet" / "recordings.ts"

# How the letter is found in a recording. Each is about two and a half seconds
# long and the letter itself half a second: before it comes a second of quiet,
# often with a click of the lips in it, and after it another, often with a
# low thump or a breath. A plain "cut the silence" keeps the click and the
# thump, since both are louder than the room, so the letter is looked for
# instead. The loudness is measured every 10 ms, in dB under the loudest
# moment, twice: of everything, and of what lies above 300 Hz, where a voice
# has most of its sound and a thump almost none.
#
# - The letter's body is everything from the first to the last stretch that
#   stays within BODY_DB of the loudest for BODY_MS, above 300 Hz. A click is
#   loud but over in 20 ms; a thump is long but low. What lies between two
#   such stretches is the letter's too, quiet or not: the closure in ґе or ща.
# - From the body the cut moves outwards for as long as the sound goes on
#   dying away: a soft beginning (х, ф), the hum before б, д and ґ, the end of
#   a vowel. It stops where the sound is down to EDGE_DB, or where, already
#   faint, it grows by RISE_DB again: that is something else beginning, and
#   the cut is put at the faintest moment between the two.
# - The cut is faded in over FADE_IN_MS and out over FADE_OUT_MS, inside what
#   is kept, so that it is not heard and nothing from beyond it is.
#
# CUTS overrides what this finds for a letter, in seconds of the original:
# the place to put right a letter that is heard to be clipped.
FRAME_MS = 10
BODY_HZ = 300
BODY_DB, BODY_MS = -25, 40
EDGE_DB = -42
FAINT_DB, RISE_DB = -30, 8
FADE_IN_MS, FADE_OUT_MS = 10, 60
CUTS = {}

# What is then done to the sound. The two channels are one voice and are made
# one. Below 70 Hz there is no voice, only rumble. The hiss is measured in the
# recording's own quiet (tn=1) and taken down by 10 dB: more begins to eat the
# letters that are hiss themselves (с, ш, х). Last, every letter is brought to
# the same loudness, LOUD_DB on average (as recorded they differ by 12 dB),
# or as near to it as leaves its peak at PEAK_DB, with room for what the mp3
# adds.
RATE = 44100
MONO = "pan=mono|c0=0.5*c0+0.5*c1"
HIGHPASS = "highpass=f=70"
DENOISE = "afftdn=nr=10:nf=-55:tn=1"
LOUD_DB, PEAK_DB = -20.0, -3.0


def files():
    query = urllib.parse.urlencode({
        "action": "query", "format": "json", "formatversion": "2",
        "generator": "categorymembers", "gcmtitle": CATEGORY, "gcmtype": "file", "gcmlimit": "100",
        "prop": "videoinfo", "viprop": "url|extmetadata",
    })
    with urllib.request.urlopen(urllib.request.Request(f"{API}?{query}", headers=AGENT), timeout=30) as response:
        return json.load(response)["query"]["pages"]


# Commons gives a script that does not say who runs it about ten files, then
# "429 Too Many Requests" with a wait of ten minutes (seen 2026-11-13). So the
# files are asked for slowly and the wait is kept: 32 of them take about half
# an hour, once.
PAUSE = 15


def download(url, path):
    """Fetch one original, waiting and trying again when Commons says there were too many requests."""
    for attempt in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=60) as response:
                path.write_bytes(response.read())
            return
        except urllib.error.HTTPError as error:
            if error.code != 429:
                raise
            print(f"waiting: Commons said 429 (Retry-After: {error.headers.get('Retry-After')})", flush=True)
            # As long as it asks (ten minutes, when seen): asking again sooner only starts the wait afresh
            time.sleep(min(900, max(60.0, float(error.headers.get("Retry-After") or 0))) + 5)
    sys.exit(f"Commons would not give {url}")


def quoted(text):
    """A TypeScript string in single quotes, as the rest of the site writes them."""
    return "'" + text.replace("\\", "\\\\").replace("'", "\\'") + "'"


def plain(html):
    """The text of a metadata value: the author is given as a link."""
    return re.sub(r"<[^>]+>", "", html).strip()


def run(ffmpeg, *args):
    """Run ffmpeg and give back what it says (it says everything on stderr)."""
    done = subprocess.run([ffmpeg, "-hide_banner", "-nostdin", "-y", *args], capture_output=True)
    said = done.stderr.decode("utf-8", "replace")
    if done.returncode:
        sys.exit(said[-2000:])
    return said


def loudness(ffmpeg, path, above=None):
    """The loudness of a recording every FRAME_MS, in dB under its loudest frame: of all of it, or of what is above a frequency."""
    # Twice over: one pass of the filter lets too much of a thump through
    band = f"highpass=f={above},highpass=f={above}" if above else HIGHPASS
    done = subprocess.run(
        [ffmpeg, "-hide_banner", "-nostdin", "-i", str(path), "-af", band,
         "-ac", "1", "-ar", str(RATE), "-f", "s16le", "-"], capture_output=True)
    if done.returncode:
        sys.exit(done.stderr.decode("utf-8", "replace")[-2000:])
    samples = array("h", done.stdout[:len(done.stdout) // 2 * 2])
    size = RATE * FRAME_MS // 1000
    levels = []
    for start in range(0, len(samples) - size + 1, size):
        power = sum(x * x for x in samples[start:start + size]) / size
        levels.append(10 * math.log10(power) if power else -200.0)
    top = max(levels)
    return [level - top for level in levels]


def find_letter(levels, voice):
    """
    Where the letter is, as the first and the last frame to keep: see the
    comment over FRAME_MS. `levels` is the loudness of everything, `voice` of
    what is above BODY_HZ. The frame at either end is already quiet: the fade
    is made in it.
    """
    need = BODY_MS // FRAME_MS
    runs, start = [], None
    for i, level in enumerate(voice + [-200.0]):
        if level > BODY_DB and start is None:
            start = i
        elif level <= BODY_DB and start is not None:
            if i - start >= need:
                runs.append((start, i))
            start = None

    def outwards(at, step):
        lowest, lowest_at = levels[at], at
        while 0 <= at + step < len(levels):
            at += step
            if levels[at] <= EDGE_DB:
                return at
            if lowest < FAINT_DB and levels[at] > lowest + RISE_DB:
                return lowest_at
            if levels[at] < lowest:
                lowest, lowest_at = levels[at], at
        return at

    return outwards(runs[0][0], -1), outwards(runs[-1][1] - 1, 1)


def left_out(levels, first, last):
    """What was cut away although it is louder than a quiet room: the clicks and thumps, to be looked over."""
    found, start = [], None
    for i, level in enumerate(levels + [-200.0]):
        outside = i < first or i > last
        if outside and level > -35 and start is None:
            start = i
        elif (not outside or level <= -35) and start is not None:
            found.append(f"{start * FRAME_MS / 1000:.2f}-{i * FRAME_MS / 1000:.2f} ({max(levels[start:i]):.0f} dB)")
            start = None
    return found


def clean(ffmpeg, source, target, start, end):
    """The cleaned mp3 of one recording: mono, as a voice is, at a size a phone fetches at once."""
    length = end - start
    chain = (f"{MONO},{HIGHPASS},{DENOISE},atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS,"
             f"afade=t=in:d={FADE_IN_MS / 1000},"
             f"afade=t=out:st={length - FADE_OUT_MS / 1000:.3f}:d={FADE_OUT_MS / 1000}")
    # Twice through: the first pass finds how loud the cleaned letter is
    heard = run(ffmpeg, "-i", str(source), "-af", f"{chain},volumedetect", "-f", "null", "-")
    mean = float(re.search(r"mean_volume: (-?[\d.]+) dB", heard)[1])
    peak = float(re.search(r"max_volume: (-?[\d.]+) dB", heard)[1])
    gain = min(LOUD_DB - mean, PEAK_DB - peak)
    run(ffmpeg, "-i", str(source), "-af", f"{chain},volume={gain:.1f}dB",
        "-ac", "1", "-ar", str(RATE), "-c:a", "libmp3lame", "-q:a", "4",
        "-map_metadata", "-1", "-fflags", "+bitexact", str(target))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ffmpeg", default="ffmpeg", help="the ffmpeg program, if it is not on the PATH")
    ffmpeg = parser.parse_args().ffmpeg
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    recordings, credits = {}, set()
    for page in files():
        # "File:Жж – ukrainian.ogg": the capital, then the small letter
        letter = page["title"].removeprefix("File:")[1]
        if letter not in ALPHABET:
            sys.exit(f"not a letter: {page['title']}")
        info = page["videoinfo"][0]
        meta = info["extmetadata"]
        credits.add((plain(meta["Artist"]["value"]), meta["LicenseShortName"]["value"], meta["LicenseUrl"]["value"]))
        # 09-zh.mp3: the letter's place in the alphabet, since и and й are both "y"
        name = f"{ALPHABET.index(letter) + 1:02d}-{national_translit(letter)}"
        original = RAW / f"{name}.ogg"
        if not original.exists():
            download(info["url"].split("?")[0], original)
            print(f"fetched {name}", flush=True)
            time.sleep(PAUSE)
        recordings[letter] = (name, info["descriptionurl"], original)
    if len(credits) != 1:
        sys.exit(f"more than one author or licence: {sorted(credits)}")
    author, licence, licence_url = credits.pop()
    category = "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(CATEGORY.replace(" ", "_"), safe=":_")

    before = after = size = 0
    for letter, (name, _, original) in sorted(recordings.items(), key=lambda item: ALPHABET.index(item[0])):
        target = OUT / f"{name}.mp3"
        levels = loudness(ffmpeg, original)
        first, last = find_letter(levels, loudness(ffmpeg, original, BODY_HZ))
        was = len(levels) * FRAME_MS / 1000
        start, end = CUTS.get(letter) or (first * FRAME_MS / 1000, (last + 1) * FRAME_MS / 1000)
        clean(ffmpeg, original, target, start, end)
        before, after, size = before + was, after + end - start, size + target.stat().st_size
        away = left_out(levels, int(start * 1000 / FRAME_MS), int(end * 1000 / FRAME_MS))
        print(f"{name:8} {was:4.2f} s: {start:4.2f}-{end:4.2f} = {end - start:4.2f} s, {target.stat().st_size:5} bytes"
              + (f"{' (set by hand)' if letter in CUTS else ''}; left out: {', '.join(away)}" if away or letter in CUTS else ""))

    lines = [
        "// The recordings of the letters on the alphabet page (/alphabet): one of each",
        "// letter but ь, by one speaker. The files in static/audio/letters/ are made",
        "// from recordings on Wikimedia Commons, with the silence cut from both ends",
        "// and the hiss taken down; each letter names the Commons page of its original.",
        "//",
        "// Made by data/letter_recordings.py; do not edit by hand.",
        "",
        "/** Who recorded them and under which licence: said once, beside the letters. */",
        "export const RECORDINGS_CREDIT = {",
        f"\tauthor: {quoted(author)},",
        f"\tlicence: {quoted(licence)},",
        f"\tlicenceUrl: {quoted(licence_url)},",
        f"\tcategory: {quoted(category)}",
        "};",
        "",
        "/** By the letter in lower case: the mp3, and the Commons page of the recording it was made from. */",
        "export const RECORDINGS: Record<string, { src: string; page: string }> = {",
    ]
    lines += [
        f"\t{letter}: {{ src: {quoted(f'/audio/letters/{recordings[letter][0]}.mp3')}, page: {quoted(recordings[letter][1])} }},"
        for letter in ALPHABET if letter in recordings
    ]
    lines[-1] = lines[-1].rstrip(",")
    lines += ["};", ""]
    with open(MODULE, "w", encoding="utf-8", newline="\n") as out:
        out.write("\n".join(lines))
    missing = [letter for letter in ALPHABET if letter not in recordings]
    summary = (f"{len(recordings)} recordings by {author}, {licence}: {before:.1f} s cut to {after:.1f} s, "
               f"{size // 1024} KB; none of: {' '.join(missing) or '-'}")
    print(summary.encode("ascii", "replace").decode())
