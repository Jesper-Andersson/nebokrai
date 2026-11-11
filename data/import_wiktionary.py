#!/usr/bin/env python3
"""Build the Nebokrai dictionary database from the kaikki.org Ukrainian extract.

Usage:
    python3 import_wiktionary.py raw/uk.jsonl nebokrai.db

Input:  kaikki.org-dictionary-Ukrainian.jsonl (English Wiktionary, CC BY-SA)
Output: a SQLite database with four tables:

    entries      one row per dictionary word (lemma) and part of speech
    senses       the English meanings of an entry
    forms        every inflected form of an entry (declension / conjugation)
    search_keys  normalised lookup keys pointing at entries

Only the Python standard library is used.
"""
import json
import re
import sqlite3
import sys
import unicodedata

STRESS = "́"

SCHEMA = """
CREATE TABLE entries (
    id          INTEGER PRIMARY KEY,
    word        TEXT NOT NULL,      -- plain spelling, no stress mark: калина
    headword    TEXT NOT NULL,      -- with stress mark: кали́на
    pos         TEXT NOT NULL,      -- noun, verb, adj, ...
    tags        TEXT NOT NULL,      -- JSON list: ["feminine","inanimate"]
    head_forms  TEXT NOT NULL,      -- JSON list of key forms shown next to the headword
    roman       TEXT,               -- Wiktionary romanisation: kalýna
    ipa         TEXT,
    audio_url   TEXT,
    etymology   TEXT
);
CREATE TABLE senses (
    id        INTEGER PRIMARY KEY,
    entry_id  INTEGER NOT NULL REFERENCES entries(id),
    n         INTEGER NOT NULL,     -- order within the entry, from 1
    gloss     TEXT NOT NULL,
    tags      TEXT NOT NULL,        -- JSON list: ["uncountable"]
    examples  TEXT NOT NULL         -- JSON list of {"text","english"}
);
CREATE TABLE forms (
    id        INTEGER PRIMARY KEY,
    entry_id  INTEGER NOT NULL REFERENCES entries(id),
    form      TEXT NOT NULL,        -- with stress: кали́ни
    plain     TEXT NOT NULL,        -- without stress, lowercase: калини
    tags      TEXT NOT NULL         -- JSON list: ["genitive","singular"]
);
CREATE TABLE search_keys (
    key       TEXT NOT NULL,
    entry_id  INTEGER NOT NULL REFERENCES entries(id),
    kind      TEXT NOT NULL         -- word | form | latin | english
);
"""

INDEXES = """
CREATE INDEX entries_word ON entries(word);
CREATE INDEX senses_entry ON senses(entry_id, n);
CREATE INDEX forms_entry ON forms(entry_id);
CREATE INDEX forms_plain ON forms(plain);
CREATE INDEX search_key ON search_keys(key, kind);
"""

# Ukrainian national transliteration (Cabinet of Ministers resolution 55, 2010).
# Each letter maps to (word-initial, elsewhere).
NATIONAL = {
    "а": ("a", "a"), "б": ("b", "b"), "в": ("v", "v"), "г": ("h", "h"),
    "ґ": ("g", "g"), "д": ("d", "d"), "е": ("e", "e"), "є": ("ye", "ie"),
    "ж": ("zh", "zh"), "з": ("z", "z"), "и": ("y", "y"), "і": ("i", "i"),
    "ї": ("yi", "i"), "й": ("y", "i"), "к": ("k", "k"), "л": ("l", "l"),
    "м": ("m", "m"), "н": ("n", "n"), "о": ("o", "o"), "п": ("p", "p"),
    "р": ("r", "r"), "с": ("s", "s"), "т": ("t", "t"), "у": ("u", "u"),
    "ф": ("f", "f"), "х": ("kh", "kh"), "ц": ("ts", "ts"), "ч": ("ch", "ch"),
    "ш": ("sh", "sh"), "щ": ("shch", "shch"), "ю": ("yu", "iu"),
    "я": ("ya", "ia"), "ь": ("", ""), "'": ("", ""), "’": ("", ""), "ʼ": ("", ""),
}


def strip_stress(text):
    """Remove the acute stress mark but keep й and ї intact."""
    return unicodedata.normalize("NFC", text).replace(STRESS, "")


def plain(text):
    """Lookup form of a Ukrainian word: no stress, lowercase, one apostrophe style."""
    text = strip_stress(text).lower()
    return text.replace("’", "'").replace("ʼ", "'")


def national_translit(word):
    """калина -> kalyna (official Ukrainian romanisation)."""
    out = []
    start = True
    for ch in plain(word):
        pair = NATIONAL.get(ch)
        if pair is None:
            out.append(ch)
            start = not ch.isalpha()
            continue
        out.append(pair[0] if start else pair[1])
        start = False
    return "".join(out)


def loose_latin(text):
    """Collapse Latin spelling variants so that different romanisation habits meet.

    kalyna, kalina and kalýna all become "kalina"; khata, chata, xata -> "hata".
    The same function is applied to the stored key and to what the user types.
    """
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z]", "", text)
    for old, new in (
        ("shch", "sc"), ("sch", "sc"), ("šč", "sc"),
        ("kh", "h"), ("ch", "c"), ("zh", "z"), ("sh", "s"), ("ts", "c"),
        ("x", "h"), ("g", "h"), ("w", "v"), ("j", "i"), ("y", "i"),
    ):
        text = text.replace(old, new)
    return re.sub(r"(.)\1+", r"\1", text)  # collapse doubled letters


def is_form_of(entry):
    """True for pages that only say 'genitive singular of X'."""
    senses = entry.get("senses") or []
    return bool(senses) and all("form_of" in s or "alt_of" in s for s in senses)


SKIP_FORM_TAGS = {"table-tags", "inflection-template", "class", "romanization"}


def build(src, dst):
    db = sqlite3.connect(dst)
    db.executescript("DROP TABLE IF EXISTS search_keys; DROP TABLE IF EXISTS forms;"
                     "DROP TABLE IF EXISTS senses; DROP TABLE IF EXISTS entries;")
    db.executescript(SCHEMA)
    stats = dict(lines=0, skipped_form_of=0, entries=0, senses=0, forms=0,
                 with_table=0, with_audio=0, with_examples=0)

    for line in open(src, encoding="utf-8"):
        stats["lines"] += 1
        e = json.loads(line)
        if is_form_of(e):
            stats["skipped_form_of"] += 1
            continue

        word = e["word"]
        forms = e.get("forms") or []
        canonical = next((f for f in forms if "canonical" in f.get("tags", [])), None)
        headword = unicodedata.normalize("NFC", canonical["form"]) if canonical else word
        tags = [t for t in (canonical or {}).get("tags", []) if t != "canonical"]
        roman = next((f["form"] for f in forms if "romanization" in f.get("tags", [])), None)

        # Key forms from the headword line (genitive, aspect partner, ...).
        head_forms = [
            {"form": unicodedata.normalize("NFC", f["form"]), "tags": f.get("tags", [])}
            for f in forms
            if f.get("source") != "declension" and f.get("source") != "conjugation"
            and f is not canonical
            and not (set(f.get("tags", [])) & SKIP_FORM_TAGS)
        ]

        sounds = e.get("sounds") or []
        ipa = next((s["ipa"] for s in sounds if "ipa" in s), None)
        audio = next((s.get("mp3_url") or s.get("ogg_url") for s in sounds
                      if s.get("mp3_url") or s.get("ogg_url")), None)

        cur = db.execute(
            "INSERT INTO entries(word, headword, pos, tags, head_forms, roman, ipa,"
            " audio_url, etymology) VALUES (?,?,?,?,?,?,?,?,?)",
            (word, headword, e["pos"], json.dumps(tags, ensure_ascii=False),
             json.dumps(head_forms, ensure_ascii=False), roman, ipa, audio,
             e.get("etymology_text")))
        eid = cur.lastrowid
        stats["entries"] += 1
        stats["with_audio"] += bool(audio)

        keys = {(plain(word), "word")}
        keys.add((loose_latin(national_translit(word)), "latin"))
        if roman:
            keys.add((loose_latin(roman), "latin"))

        n = 0
        had_example = False
        for s in e.get("senses") or []:
            if "form_of" in s or "alt_of" in s:
                continue
            gloss = "; ".join(s.get("glosses") or [])
            if not gloss:
                continue
            n += 1
            examples = [{"text": x.get("text"), "english": x.get("english") or x.get("translation")}
                        for x in s.get("examples") or [] if x.get("text")]
            had_example |= bool(examples)
            db.execute("INSERT INTO senses(entry_id, n, gloss, tags, examples) VALUES (?,?,?,?,?)",
                       (eid, n, gloss, json.dumps(s.get("tags") or [], ensure_ascii=False),
                        json.dumps(examples, ensure_ascii=False)))
            stats["senses"] += 1
            for w in set(re.findall(r"[a-z]+(?:[-'][a-z]+)*", gloss.lower())):
                if len(w) > 1:
                    keys.add((w, "english"))
        stats["with_examples"] += had_example

        table = [f for f in forms if f.get("source") in ("declension", "conjugation")
                 and not (set(f.get("tags", [])) & SKIP_FORM_TAGS)]
        stats["with_table"] += bool(table)
        for f in table:
            form = unicodedata.normalize("NFC", f["form"])
            if not form or form == "-":
                continue
            p = plain(form)
            db.execute("INSERT INTO forms(entry_id, form, plain, tags) VALUES (?,?,?,?)",
                       (eid, form, p, json.dumps(f.get("tags") or [], ensure_ascii=False)))
            stats["forms"] += 1
            if " " not in p:
                keys.add((p, "form"))

        db.executemany("INSERT INTO search_keys(key, entry_id, kind) VALUES (?,?,?)",
                       [(k, eid, kind) for k, kind in keys if k])

    db.executescript(INDEXES)
    db.execute("CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT)")
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("source", "English Wiktionary via kaikki.org (wiktextract)"),
        ("license", "CC BY-SA 4.0"),
        ("stats", json.dumps(stats)),
    ])
    db.commit()
    db.execute("VACUUM")
    db.close()
    return stats


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    for k, v in build(sys.argv[1], sys.argv[2]).items():
        print(f"{k:>16}: {v}")
