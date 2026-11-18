#!/usr/bin/env python3
"""Add the Ukrainian Storybooks stories to a dictionary database, for /read.

Usage:
    python3 data/import_stories.py nebokrai.db [--raw data/raw/storybooks] [--fetch]
    python3 data/import_stories.py nebokrai.db --check

    --fetch   download the story pages first (40 pages, about 1 MB) into --raw;
              a page already there is not fetched again
    --check   read the tables back and stop with an error if a lemma does not
              resolve, a stress mark is not the only one the dictionary gives,
              or a page has no audio

Global Storybooks (here its Storybooks Canada site) has 40 illustrated
children's stories in Ukrainian, each read aloud page by page by a person. 29
are CC BY (3.0 or 4.0) and are kept; the other 11 are CC BY-NC and skipped, so
nothing here limits how the dictionary may be used beyond attribution. Every
row keeps its own licence, URL and credits, as Tatoeba rows do.

What the script changes in a story, and so what the reader page credits: a
stress mark (U+0301) is added to a word only when the dictionary knows exactly
one stressed spelling for it (вода́ stays вода́, but води has води́ and во́ди
and stays bare), and each page is split into sentences. Nothing else.

Three things are worked out per sentence and story:
- `lemmas`: for each word (the TOKEN pattern of import_wiktionary.py, read on
  `uk_source`), the `word` of every dictionary entry it is or is a form of,
  most frequent first; an empty list for a word the dictionary does not know.
  These are what review cards are keyed by, so the page can tell which words a
  learner knows. vesum.db is never read: VESUM may not go into this file.
- `tokens`, `unknown`: how many words, and how many the dictionary lacks.
- `bare`: the share of words of two or more syllables left without a mark.

A story's difficulty is its Storybooks `level` (1 to 5), which follows its
length and sentences. No frequency band is worked out: measured in November
2026, the stories of every level needed the same band (they are children's
stories, and FrequencyWords is film subtitles, where корова and гіпопотам
are rare). What a page shows instead is the share of the story's words the
reader knows, summed in the browser from their own cards (knownShare() in
src/lib/texts.ts).

The tables are dropped and made again on each run. import_wiktionary.py leaves
them alone, but a rebuild gives every entry a new id and may change forms and
ranks, so run this script again after one.

Only the Python standard library is used.
"""
import argparse
import html
import json
import re
import sqlite3
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

from import_wiktionary import STRESS, TOKEN, form_index, national_translit, plain, strip_stress

SITE = "https://storybookscanada.ca"
LIST = f"{SITE}/stories/uk/"
AGENT = {"User-Agent": "Mozilla/5.0 (compatible; dictionary-data-import/1.0)"}
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "storybooks"
# Where fetch_story_audio.py puts a page's recording, and the page plays it from.
AUDIO = "/audio/texts/{slug}/{page:02d}.mp3"

VOWELS = set("аеєиіїоуюяё")

TEXTS_SCHEMA = """
CREATE TABLE texts (
    id           INTEGER PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,  -- national transliteration of the title: duzhe-vysokyi-cholovik
    source_id    TEXT NOT NULL,         -- the Storybooks number: 0001
    title        TEXT NOT NULL,         -- with stress marks, as the sentences have them
    title_en     TEXT NOT NULL,
    level        INTEGER,               -- the Storybooks level, 1 to 5
    tokens       INTEGER NOT NULL,      -- words in the story
    unknown      INTEGER NOT NULL,      -- words the dictionary does not know
    bare         REAL NOT NULL,         -- share of words of 2+ syllables left without a stress mark
    pages        INTEGER NOT NULL,
    url          TEXT NOT NULL,         -- the story on Storybooks, for attribution
    licence      TEXT NOT NULL,         -- CC BY 3.0 | CC BY 4.0
    licence_url  TEXT NOT NULL,
    credits      TEXT NOT NULL,         -- JSON list of {"role","name"}: [{"role":"Written by","name":"…"}]
    origin       TEXT,                  -- JSON {"title","url","site","site_url"}: where Storybooks took it from
    cover_url    TEXT                   -- the illustration of the first page, on Storybooks
);
CREATE TABLE text_pages (
    text_id    INTEGER NOT NULL REFERENCES texts(id),
    page       INTEGER NOT NULL,        -- 1 is the title page; its sentence is the title
    en         TEXT NOT NULL,           -- the English of the whole page (not split)
    audio      TEXT NOT NULL,           -- the page's recording on this site: /audio/texts/<slug>/02.mp3
    audio_url  TEXT NOT NULL,           -- the same recording on Storybooks, where fetch_story_audio.py gets it
    PRIMARY KEY (text_id, page)
);
CREATE TABLE text_sentences (
    text_id    INTEGER NOT NULL REFERENCES texts(id),
    page       INTEGER NOT NULL,
    n          INTEGER NOT NULL,        -- order within the page, from 1
    uk         TEXT NOT NULL,           -- with the stress marks added: Його́ моти́ка була́ закоро́тка.
    uk_source  TEXT NOT NULL,           -- as Storybooks has it
    lemmas     TEXT NOT NULL,           -- JSON: one list of entry words per word of uk_source
    PRIMARY KEY (text_id, page, n)
);
"""


# ---------------------------------------------------------------- fetching

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=30) as r:
        return r.read()


def story_ids(page):
    """The story numbers the list page links to, in its order: 0001, 0002…"""
    return list(dict.fromkeys(re.findall(r'href="/stories/uk/(\d{4})/"', page)))


def fetch(raw):
    raw.mkdir(parents=True, exist_ok=True)
    listing = raw / "list.html"
    if not listing.exists():
        listing.write_bytes(get(LIST))
    ids = story_ids(listing.read_text(encoding="utf-8"))
    fetched = 0
    for sid in ids:
        target = raw / sid / "index.html"
        if target.exists():
            continue
        target.parent.mkdir(exist_ok=True)
        target.write_bytes(get(f"{SITE}/stories/uk/{sid}/"))
        fetched += 1
        time.sleep(0.5)
    print(f"{len(ids)} stories listed, {fetched} fetched now, the rest already in {raw}")


# ---------------------------------------------------------------- parsing

def text_of(fragment):
    """Visible text of an HTML fragment, on one line."""
    fragment = re.sub(r"<br\s*/?>", " ", fragment)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", html.unescape(fragment))).strip()


def parse_story(sid, page):
    """One story page as a dict, or None when it has no pages."""
    blocks = re.split(r'id="text(\d\d)"', page)
    pages = []
    for i in range(1, len(blocks) - 1, 2):
        n, block = int(blocks[i]), blocks[i + 1].split('id="colophon"')[0]
        if n == 1:
            uk = re.search(r'<span class="def">(.*?)</span>', block, re.S)
            en = re.search(r'<span class="l1">(.*?)</span>', block, re.S)
        else:
            uk = re.search(r'class="[^"]*\bdef\b[^"]*">\s*<h3>(.*?)</h3>', block, re.S)
            en = re.search(r'class="[^"]*\bl1\b[^"]*">\s*<h3>(.*?)</h3>', block, re.S)
        audio = re.search(rf'<audio id="audio{n:02d}"[^>]*src="([^"]+)"', block)
        pages.append({
            "page": n,
            "uk": text_of(uk.group(1)) if uk else "",
            "en": text_of(en.group(1)) if en else "",
            "audio_url": SITE + audio.group(1) if audio else None,
        })
    if not pages:
        return None
    colophon = page.split('id="colophon"', 1)[-1]
    credits, origin = [], None
    for role, value in re.findall(r'<span class="colophon-heading">(.*?):</span>(.*?)</h5>', colophon, re.S):
        role = text_of(role)
        if role in ("Language", "Level"):
            continue
        if role == "Source":
            links = re.findall(r'<a href="([^"]+)"[^>]*>(.*?)</a>', value, re.S)
            if len(links) >= 2:
                origin = {"title": text_of(links[0][1]), "url": links[0][0],
                          "site": text_of(links[1][1]), "site_url": links[1][0]}
            continue
        credits.append({"role": role, "name": text_of(value)})
    licence = re.search(r'rel="license" href="([^"]+)"', colophon)
    level = re.search(r'href="/stories/uk/level(\d)"', page)
    cover = re.search(r'<img class="img-responsive" src="([^"]+)"', page)
    return {
        "source_id": sid,
        "title": pages[0]["uk"],
        "title_en": pages[0]["en"],
        "level": int(level.group(1)) if level else None,
        "url": f"{SITE}/stories/uk/{sid}/",
        "licence_url": licence.group(1) if licence else "",
        "credits": credits,
        "origin": origin,
        "cover_url": SITE + cover.group(1) if cover else None,
        "pages": pages,
    }


def licence_name(url):
    """CC BY 3.0 for .../licenses/by/3.0/; None for anything that is not plain CC BY."""
    m = re.search(r"creativecommons\.org/licenses/by/(\d\.\d)/?$", url)
    return f"CC BY {m.group(1)}" if m else None


# A sentence ends at . ! ? or … (with any closing quote or bracket after it)
# when the next one starts with a capital, perhaps after an opening quote or a
# dash of dialogue: «Ходімо!» – сказала вона. Мама кивнула.
SENTENCE_END = re.compile(r'([.!?…]+[»"”)]*)\s+(?=[«"“„(–—-]?\s*[А-ЯІЇЄҐA-Z0-9])')


def sentences(text):
    return [s.strip() for s in SENTENCE_END.sub("\\1\n", text).split("\n") if s.strip()]


# ---------------------------------------------------------------- words

def syllables(word):
    return sum(ch in VOWELS for ch in plain(word))


class Words:
    """What the dictionary says about each word of the stories: its lemmas and its stress."""

    def __init__(self, db):
        self.db = db
        self.index = form_index(db)
        self.rows = {}  # entry id -> (word, headword, freq_rank)
        self.rank = {}  # entry word -> its best rank among entries of that word
        for eid, word, headword, rank in db.execute("SELECT id, word, headword, freq_rank FROM entries"):
            self.rows[eid] = (word, headword, rank)
            if rank is not None and (word not in self.rank or rank < self.rank[word]):
                self.rank[word] = rank
        self._forms = {}

    def entries(self, token):
        return self.index.get(plain(token), set())

    def lemmas(self, token):
        """The entry words a word is, most frequent first: води -> ["вода", "водити"]."""
        words = {self.rows[e][0] for e in self.entries(token)}
        return sorted(words, key=lambda w: (self.rank.get(w) is None, self.rank.get(w) or 0, w))

    def stressed(self, token):
        """Every stressed spelling the dictionary gives for this word as written."""
        key = plain(token)
        ids = self.entries(token)
        if not ids:
            return set()
        if key not in self._forms:
            found = set()
            for eid in ids:
                if plain(self.rows[eid][1]) == key:
                    found.add(self.rows[eid][1])
            marks = ",".join("?" * len(ids))
            for (form,) in self.db.execute(
                    f"SELECT form FROM forms WHERE plain = ? AND entry_id IN ({marks})", (key, *ids)):
                found.add(form)
            self._forms[key] = {unicodedata.normalize("NFC", f).lower() for f in found if STRESS in f}
        return self._forms[key]

    def mark(self, token):
        """The word with its stress mark when exactly one is known, else as it is."""
        spellings = self.stressed(token)
        if len(spellings) != 1:
            return token
        (spelling,) = spellings
        if len(strip_stress(spelling)) != len(token):
            return token
        out, i = [], 0
        for ch in spelling:
            if ch == STRESS:
                out.append(STRESS)
            else:
                out.append(token[i])
                i += 1
        return "".join(out)


def stress_text(words, text):
    """The text with marks added; and how many words of 2+ syllables there are and are left bare."""
    long_words = bare = 0
    out, last = [], 0
    for m in TOKEN.finditer(text):
        token = m.group(0)
        marked = words.mark(token)
        if syllables(token) >= 2:
            long_words += 1
            bare += marked == token
        out.append(text[last:m.start()])
        out.append(marked)
        last = m.end()
    out.append(text[last:])
    return "".join(out), long_words, bare


def slug_of(title, taken):
    base = re.sub(r"[^a-z0-9]+", "-", national_translit(title)).strip("-") or "story"
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    taken.add(slug)
    return slug


# ---------------------------------------------------------------- import

def load(raw):
    listing = raw / "list.html"
    if not listing.exists():
        sys.exit(f"No {listing}: run with --fetch first.")
    stories = []
    # In number order, so that a story keeps its id from one run to the next
    for sid in sorted(story_ids(listing.read_text(encoding="utf-8"))):
        path = raw / sid / "index.html"
        if not path.exists():
            sys.exit(f"No {path}: run with --fetch first.")
        story = parse_story(sid, path.read_text(encoding="utf-8"))
        if story is None:
            sys.exit(f"{path} has no pages: has the site changed?")
        stories.append(story)
    return stories


def build(db, stories):
    words = Words(db)
    db.executescript("DROP TABLE IF EXISTS text_sentences; DROP TABLE IF EXISTS text_pages;"
                     "DROP TABLE IF EXISTS texts;" + TEXTS_SCHEMA)
    taken, kept, skipped = set(), [], []
    for story in stories:
        licence = licence_name(story["licence_url"])
        if licence is None:
            skipped.append((story["source_id"], story["licence_url"] or "no licence"))
            continue
        slug = slug_of(story["title"], taken)
        rows = []
        tokens = unknown = long_words = bare = 0
        for page in story["pages"]:
            for n, source in enumerate(sentences(page["uk"]), 1):
                uk, long_here, bare_here = stress_text(words, source)
                long_words += long_here
                bare += bare_here
                lemmas = []
                for m in TOKEN.finditer(source):
                    found = words.lemmas(m.group(0))
                    lemmas.append(found)
                    tokens += 1
                    if not found:
                        unknown += 1
                rows.append((page["page"], n, uk, source, json.dumps(lemmas, ensure_ascii=False)))
        title = stress_text(words, story["title"])[0]
        share = bare / long_words if long_words else 0.0
        cur = db.execute(
            "INSERT INTO texts (slug, source_id, title, title_en, level, tokens, unknown, bare, pages,"
            " url, licence, licence_url, credits, origin, cover_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (slug, story["source_id"], title, story["title_en"], story["level"], tokens, unknown,
             round(share, 3), len(story["pages"]), story["url"], licence, story["licence_url"],
             json.dumps(story["credits"], ensure_ascii=False),
             json.dumps(story["origin"], ensure_ascii=False) if story["origin"] else None, story["cover_url"]))
        text_id = cur.lastrowid
        for page in story["pages"]:
            db.execute("INSERT INTO text_pages VALUES (?,?,?,?,?)",
                       (text_id, page["page"], page["en"], AUDIO.format(slug=slug, page=page["page"]),
                        page["audio_url"] or ""))
        db.executemany("INSERT INTO text_sentences VALUES (?,?,?,?,?,?)", [(text_id, *r) for r in rows])
        kept.append((story["source_id"], slug, licence, story["level"], tokens, unknown, share))
    db.commit()
    return kept, skipped


def check(db):
    """Read the tables back; give the list of problems found."""
    words = Words(db)
    problems = []
    known = {w for (w,) in db.execute("SELECT DISTINCT word FROM entries")}
    for (sid, licence) in db.execute("SELECT source_id, licence FROM texts"):
        if not licence.startswith("CC BY ") or "NC" in licence:
            problems.append(f"{sid}: licence {licence}")
    for (sid, credits) in db.execute("SELECT source_id, credits FROM texts"):
        if not json.loads(credits):
            problems.append(f"{sid}: no credits")
    for text_id, page, n, uk, source, lemmas in db.execute(
            "SELECT text_id, page, n, uk, uk_source, lemmas FROM text_sentences"):
        lemmas = json.loads(lemmas)
        tokens = TOKEN.findall(source)
        if len(lemmas) != len(tokens):
            problems.append(f"text {text_id} page {page}.{n}: {len(tokens)} words but {len(lemmas)} lemma lists")
        for found in lemmas:
            for w in found:
                if w not in known:
                    problems.append(f"text {text_id} page {page}.{n}: lemma {w} has no entry")
        if strip_stress(uk) != unicodedata.normalize("NFC", source):
            problems.append(f"text {text_id} page {page}.{n}: uk differs from uk_source by more than stress")
        for m in re.finditer(r"[\w'’ʼ-]*" + STRESS + r"[\w'’ʼ" + STRESS + "-]*", uk):
            marked = m.group(0)
            if len(words.stressed(strip_stress(marked))) != 1:
                problems.append(f"text {text_id} page {page}.{n}: {marked} is not the only stressed spelling")
    for text_id, page, audio, url in db.execute("SELECT text_id, page, audio, audio_url FROM text_pages"):
        if not audio or not url:
            problems.append(f"text {text_id} page {page}: no audio")
    for (text_id,) in db.execute(
            "SELECT id FROM texts t WHERE pages != (SELECT COUNT(*) FROM text_pages p WHERE p.text_id = t.id)"):
        problems.append(f"text {text_id}: page count differs from its pages")
    files = [ROOT / "static" / a.lstrip("/") for (a,) in db.execute("SELECT audio FROM text_pages")]
    present = sum(f.exists() for f in files)
    print(f"{present} of {len(files)} recordings are in static/ (fetch_story_audio.py makes them)")
    return problems


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Add the Storybooks stories to a dictionary database.")
    ap.add_argument("database")
    ap.add_argument("--raw", type=Path, default=RAW, help="folder of the downloaded story pages")
    ap.add_argument("--fetch", action="store_true", help="download the story pages first")
    ap.add_argument("--check", action="store_true", help="only check the tables already built")
    args = ap.parse_args()

    db = sqlite3.connect(args.database)
    if args.check:
        problems = check(db)
        for p in problems[:50]:
            print(p)
        sys.exit(f"{len(problems)} problems" if problems else 0)

    if args.fetch:
        fetch(args.raw)
    kept, skipped = build(db, load(args.raw))
    print(f"{'id':>4} {'slug':<40} {'licence':<10} lvl {'words':>5} {'unkn':>4} bare")
    for sid, slug, licence, level, tokens, unknown, share in kept:
        print(f"{sid:>4} {slug:<40} {licence:<10} {level or '-':>3} {tokens:>5} {unknown:>4} {share:.0%}")
    print(f"kept {len(kept)}, skipped {len(skipped)}:")
    for sid, url in skipped:
        print(f"  {sid} {url}")
