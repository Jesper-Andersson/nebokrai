#!/usr/bin/env python3
"""Write the list of the letters' recordings for the alphabet page.

Usage:
    python3 data/letter_recordings.py src/lib/alphabet/recordings.ts

Asks Wikimedia Commons for the files of one category: a recording of each
Ukrainian letter by one speaker (every letter but ь, which has no sound of its
own). The output is a TypeScript module with the mp3 address of each, which the
page plays from Commons as it plays a word's recording; nothing is downloaded.

One speaker and one licence for all of them is what lets the page credit them
in one line, so the script stops if a file differs. Run it again only if the
category changes; it needs no database.
"""
import json
import re
import sys
import urllib.parse
import urllib.request

CATEGORY = "Category:Ukrainian pronunciation of letters by a young male uploaded by Tabrus"
API = "https://commons.wikimedia.org/w/api.php"
ALPHABET = "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя"


def fetch():
    query = urllib.parse.urlencode({
        "action": "query", "format": "json", "formatversion": "2",
        "generator": "categorymembers", "gcmtitle": CATEGORY, "gcmtype": "file", "gcmlimit": "100",
        "prop": "videoinfo", "viprop": "derivatives|extmetadata",
    })
    request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": "letter-recordings/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)["query"]["pages"]


def quoted(text):
    """A TypeScript string in single quotes, as the rest of the site writes them."""
    return "'" + text.replace("\\", "\\\\").replace("'", "\\'") + "'"


def plain(html):
    """The text of a metadata value: the author is given as a link."""
    return re.sub(r"<[^>]+>", "", html).strip()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    recordings, credits = {}, set()
    for page in fetch():
        # "File:Жж – ukrainian.ogg": the capital, then the small letter
        letter = page["title"].removeprefix("File:")[1]
        if letter not in ALPHABET:
            sys.exit(f"not a letter: {page['title']}")
        info = page["videoinfo"][0]
        mp3 = [d["src"] for d in info["derivatives"] if d["type"].startswith("audio/mpeg")]
        if not mp3:
            sys.exit(f"no mp3 of {page['title']}")
        recordings[letter] = mp3[0].split("?")[0]
        meta = info["extmetadata"]
        credits.add((plain(meta["Artist"]["value"]), meta["LicenseShortName"]["value"], meta["LicenseUrl"]["value"]))
    if len(credits) != 1:
        sys.exit(f"more than one author or licence: {sorted(credits)}")
    author, licence, licence_url = credits.pop()
    category = "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(CATEGORY.replace(" ", "_"), safe=":_")

    lines = [
        "// The recordings of the letters on the alphabet page (/alphabet): one of each",
        "// letter but ь, by one speaker, on Wikimedia Commons, played from there.",
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
        "/** The mp3 of each letter, by the letter in lower case. */",
        "export const RECORDINGS: Record<string, string> = {",
    ]
    lines += [f"\t{letter}: {quoted(recordings[letter])}," for letter in ALPHABET if letter in recordings]
    lines[-1] = lines[-1].rstrip(",")
    lines += ["};", ""]
    with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as out:
        out.write("\n".join(lines))
    missing = [letter for letter in ALPHABET if letter not in recordings]
    print(f"{len(recordings)} recordings by {author}, {licence}; none of: {' '.join(missing) or '-'}".encode("ascii", "replace").decode())
