#!/usr/bin/env python3
"""Build the Nebokrai dictionary database from the kaikki.org Ukrainian extract.

Usage:
    python3 import_wiktionary.py raw/uk.jsonl nebokrai.db [--freq FILE] [--tatoeba DIR]

    --freq FILE     word frequency list, one "word count" per line
                    (FrequencyWords uk_full.txt, built from film subtitles)
    --tatoeba DIR   folder holding ukr_sentences.tsv.bz2, ukr-eng_links.tsv.bz2
                    and eng_sentences.tsv.bz2 from downloads.tatoeba.org

Input:  kaikki.org-dictionary-Ukrainian.jsonl (English Wiktionary, CC BY-SA)
Output: a SQLite database with five tables:

    entries      one row per dictionary word (lemma) and part of speech
    senses       the English meanings of an entry
    forms        every inflected form of an entry (declension / conjugation)
    search_keys  normalised lookup keys pointing at entries
    examples     example sentences with translations (from Tatoeba)

Only the Python standard library is used.
"""
import bz2
import collections
import json
import os
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
    etymology   TEXT,
    freq        REAL NOT NULL DEFAULT 0,  -- occurrences per million words, all forms together
    freq_rank   INTEGER                   -- 1 = most common word; NULL = not seen in the corpus
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
CREATE TABLE examples (
    id          INTEGER PRIMARY KEY,
    entry_id    INTEGER NOT NULL REFERENCES entries(id),
    uk          TEXT NOT NULL,
    en          TEXT NOT NULL,
    tatoeba_id  INTEGER NOT NULL      -- https://tatoeba.org/sentences/show/<id>, for attribution
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
CREATE INDEX examples_entry ON examples(entry_id);
CREATE INDEX entries_rank ON entries(freq_rank);
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

    kalyna, kalina and kalýna all become "kalina"; khata, xata -> "hata".
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


SKIP_FORM_TAGS = {"table-tags", "inflection-template", "class", "romanization",
                  # Rows wiktextract could not parse: table notes such as
                  # "Future conjugation of бути + infinitive", not real forms.
                  "error-unrecognized-form"}
NOISE_TAGS = {"error-unknown-tag"}


TOKEN = re.compile(r"[\u0400-\u04FF]+(?:['’ʼ-][\u0400-\u04FF]+)*")


# Letters of the alphabet, affixes and symbols are dictionary entries too, but
# they are not vocabulary, so they get no frequency rank and no examples.
NOT_VOCABULARY = ("character", "symbol", "punct", "suffix", "prefix", "interfix", "combining_form")


def form_index(db):
    """Map every known spelling (dictionary word or inflected form) to its entries."""
    index = collections.defaultdict(set)
    marks = ",".join("?" * len(NOT_VOCABULARY))
    for key, eid in db.execute(
            "SELECT k.key, k.entry_id FROM search_keys k JOIN entries e ON e.id = k.entry_id"
            f" WHERE k.kind IN ('word','form') AND e.pos NOT IN ({marks})", NOT_VOCABULARY):
        index[key].add(eid)
    return index


def ukrainian_counts(folder):
    """How often each spelling occurs in Tatoeba's Ukrainian sentences."""
    counts = collections.Counter()
    with bz2.open(os.path.join(folder, "ukr_sentences.tsv.bz2"), "rt", encoding="utf-8") as f:
        for line in f:
            counts.update(plain(t) for t in TOKEN.findall(line.split("\t")[-1]))
    return counts


def add_frequency(db, index, path, reference=None, max_ratio=20, lemma_weight=4):
    """Rank entries by how often any of their forms occurs in the frequency list.

    The list counts spellings, not dictionary words, so each count is added to
    the entry the spelling belongs to. When several entries share a spelling,
    the entry whose dictionary form it is gets `lemma_weight` shares and the
    others one each: "зараз" counts mostly for the adverb зараз ("now"), not
    for the noun зараза ("infection"), which merely has it as a plural form.

    The subtitle list is about one third Russian. Most Russian words match no
    Ukrainian form and drop out, but some collide: Russian "мне" (to me) is
    also a form of Ukrainian м'яти (to crumple). `reference` holds counts from
    a clean Ukrainian corpus; a spelling may count for at most `max_ratio`
    times its relative frequency there, which deflates the collisions.
    """
    lines = []
    for line in open(path, encoding="utf-8"):
        parts = line.split()
        if len(parts) == 2 and parts[1].isdigit():
            lines.append((plain(parts[0]), int(parts[1])))
    corpus = sum(c for _, c in lines)
    ref_total = sum(reference.values()) if reference else 0
    lemmas = collections.defaultdict(set)
    for key, eid in db.execute("SELECT key, entry_id FROM search_keys WHERE kind='word'"):
        lemmas[key].add(eid)

    totals = collections.Counter()
    matched = capped = 0
    for key, count in lines:
        owners = index.get(key)
        if not owners:
            continue
        matched += count
        if reference:
            limit = max_ratio * (reference.get(key, 0) + 1) / ref_total * corpus
            if count > limit:
                count, capped = limit, capped + 1
        weights = {eid: lemma_weight if eid in lemmas.get(key, ()) else 1 for eid in owners}
        share = count / sum(weights.values())
        for eid, w in weights.items():
            totals[eid] += share * w
    ranked = sorted(totals.items(), key=lambda kv: -kv[1])
    db.executemany("UPDATE entries SET freq=?, freq_rank=? WHERE id=?",
                   [(round(c * 1e6 / corpus, 3), rank, eid)
                    for rank, (eid, c) in enumerate(ranked, 1)])
    return dict(freq_entries_ranked=len(ranked),
                freq_corpus_coverage=round(matched / corpus, 3),
                freq_spellings_capped=capped)


def add_tatoeba(db, index, folder, per_entry=3):
    """Attach up to `per_entry` short translated sentences to each entry."""
    def rows(name):
        with bz2.open(os.path.join(folder, name), "rt", encoding="utf-8") as f:
            for line in f:
                yield line.rstrip("\n").split("\t")

    uk = {int(r[0]): r[2] for r in rows("ukr_sentences.tsv.bz2") if len(r) == 3}
    link = {}
    for r in rows("ukr-eng_links.tsv.bz2"):
        link.setdefault(int(r[0]), int(r[1]))
    wanted = set(link.values())
    en = {int(r[0]): r[2] for r in rows("eng_sentences.tsv.bz2")
          if len(r) == 3 and int(r[0]) in wanted}

    # Sentences of about five words first: long enough to show the word in use,
    # short enough for a flashcard.
    tokenised = {sid: TOKEN.findall(text) for sid, text in uk.items()}
    candidates = collections.defaultdict(list)
    for sid in sorted(uk, key=lambda i: (abs(len(tokenised[i]) - 5), i)):
        text = uk[sid]
        english = en.get(link.get(sid))
        tokens = tokenised[sid]
        if not english or not 3 <= len(tokens) <= 12:
            continue
        for eid in {e for t in tokens for e in index.get(plain(t), ())}:
            if len(candidates[eid]) < per_entry:
                candidates[eid].append((eid, text, english, sid))
    db.executemany("INSERT INTO examples(entry_id, uk, en, tatoeba_id) VALUES (?,?,?,?)",
                   [row for rows_ in candidates.values() for row in rows_])
    return dict(tatoeba_pairs=sum(1 for i in uk if link.get(i) in en),
                entries_with_tatoeba=len(candidates),
                tatoeba_examples=sum(len(v) for v in candidates.values()))


def build(src, dst, freq=None, tatoeba=None):
    db = sqlite3.connect(dst)
    db.executescript("DROP TABLE IF EXISTS search_keys; DROP TABLE IF EXISTS forms;"
                     "DROP TABLE IF EXISTS senses; DROP TABLE IF EXISTS examples;"
                     "DROP TABLE IF EXISTS meta; DROP TABLE IF EXISTS entries;")
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
            {"form": unicodedata.normalize("NFC", f["form"]),
             "tags": [t for t in f.get("tags", []) if t not in NOISE_TAGS]}
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
            ftags = [t for t in f.get("tags") or [] if t not in NOISE_TAGS]
            if form.startswith("impersonal: "):  # "impersonal: чи́тано"
                form = form[len("impersonal: "):]
                ftags = sorted(ftags + ["impersonal"])
            p = plain(form)
            db.execute("INSERT INTO forms(entry_id, form, plain, tags) VALUES (?,?,?,?)",
                       (eid, form, p, json.dumps(ftags, ensure_ascii=False)))
            stats["forms"] += 1
            if " " not in p:
                keys.add((p, "form"))

        db.executemany("INSERT INTO search_keys(key, entry_id, kind) VALUES (?,?,?)",
                       [(k, eid, kind) for k, kind in keys if k])

    db.executescript(INDEXES)
    if freq or tatoeba:
        index = form_index(db)
        if freq:
            reference = ukrainian_counts(tatoeba) if tatoeba else None
            stats.update(add_frequency(db, index, freq, reference))
        if tatoeba:
            stats.update(add_tatoeba(db, index, tatoeba))
    db.execute("CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT)")
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("source", "English Wiktionary via kaikki.org (wiktextract)"),
        ("license", "CC BY-SA 4.0"),
        ("frequency_source", "FrequencyWords (OpenSubtitles 2018), CC BY-SA 4.0" if freq else ""),
        ("examples_source", "Tatoeba, CC BY 2.0 FR" if tatoeba else ""),
        ("stats", json.dumps(stats)),
    ])
    db.commit()
    db.execute("VACUUM")
    db.close()
    return stats


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Build the Nebokrai dictionary database.")
    ap.add_argument("source")
    ap.add_argument("database")
    ap.add_argument("--freq")
    ap.add_argument("--tatoeba")
    args = ap.parse_args()
    for k, v in build(args.source, args.database, args.freq, args.tatoeba).items():
        print(f"{k:>16}: {v}")
