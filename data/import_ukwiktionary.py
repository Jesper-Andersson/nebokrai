#!/usr/bin/env python3
"""Entries from Ukrainian Wiktionary (uk.wiktionary.org) for words the
dictionary has no entry for, made from the English in their translation
tables.

Run by import_wiktionary.py with --ukwiktionary, after every other entry is
in. The dump is the Wikimedia one, read as it is:

    curl -L -o data/raw/ukwiktionary.xml.bz2 \\
        https://dumps.wikimedia.org/ukwiktionary/latest/ukwiktionary-latest-pages-articles.xml.bz2

Neither kaikki.org nor Wiktextract reads Ukrainian Wiktionary, so this script
reads the wikitext of each page itself. It keeps very little of it:

    the title                     хмарочос
    its stress, from {{склади}}   кни́|га
    the part of speech            {{імен uk ...}} is a noun, {{дієсл uk ...}} a verb
    the English translations      |en=[[book]] or |en={{t|en|basil}} in {{переклад}}

The Ukrainian definitions are left out. Many follow the 11-volume academic
dictionary (СУМ-11) word for word, with its citations, and whether they may
be copied under CC BY-SA is not clear. Pages without English are left out too.

A page is a candidate only when it is one lowercase word, in Ukrainian
letters, not in nonstandard.tsv, not labelled Russian or surzhyk, and has no
Russian section on the same page: огонь, война and чувство have both, and the
Ukrainian section of such a page is often a stray Russian word. Then
new_words.py decides. A word that is new gets an entry with `source`
FROM_UK_WIKTIONARY: thin like an entry from English translation tables, with
no table of forms and no frequency rank. A word the dictionary already has
(the same word, or another spelling of it that shares an English word) gets
the English as search keys instead.

Data: Ukrainian Wiktionary, CC BY-SA 4.0. Only the Python standard library is
used.
"""
import bz2
import collections
import re
import unicodedata
import xml.etree.ElementTree as ET

import new_words
from import_wiktionary import (COMMON_ENGLISH, ENGLISH_WORD, FROM_UK_WIKTIONARY, STRESS, plain, strip_stress,
                               word_keys)

# The template that opens a part of speech: {{імен uk 3*a f una|...}}
POS = {"імен": "noun", "дієсл": "verb", "прикм": "adj", "присл": "adv", "числ": "num", "займ": "pron",
       "прийм": "prep", "спол": "conj", "част": "particle", "виг": "intj", "вигук": "intj",
       "дієприкм": "adj"}
LANGUAGE = re.compile(r"\{\{=([a-z-]+)=\}\}")
ONE_WORD = re.compile(r"[а-щьюяєіїґ'’ʼ-]+")
RUSSIAN_LABEL = re.compile(r"русизм|суржик|\{\{рос\.?\}\}|\{\{ru\}\}|ненорм", re.I)


def sections(text):
    """{language code: the wikitext under its {{=xx=}} marker}"""
    parts = LANGUAGE.split(text)
    return {parts[i]: parts[i + 1] for i in range(1, len(parts) - 1, 2)}


def english(section):
    """The English of each translation block, in order:
    |en=[[book]], |en={{t|en|basil|}}, |en=small bag, {{t|en|sack}}.
    Empty templates and {{t-needed|en}} give nothing."""
    found = []
    for m in re.finditer(r"^\|\s*en\s*=(.*)$", section, re.M):
        value = m.group(1)
        value = re.sub(r"\{\{t[o+-]?\|en\|([^|{}]*)[^{}]*\}\}", r"\1", value)
        value = re.sub(r"\{\{[^{}]*\}\}", "", value)
        value = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", value)
        words = [p.strip() for p in re.split(r"[;,]", value)]
        # Not a usage note in Ukrainian ("~ до міста approaches to a town") or
        # a broken line of the template ("|en= scheming")
        words = [w for w in words if re.search(r"[A-Za-z]{2}", w) and not re.search(r"[Ѐ-ӿ~=|]", w)]
        if words:
            found.append(", ".join(dict.fromkeys(words)))
    return list(dict.fromkeys(found))


def headword(title, section):
    """The title with its stress from {{склади|кни́|га}}, where that spells
    the same word."""
    m = re.search(r"склади=\{\{склади\|([^}]*)\}\}", section)
    if m:
        joined = unicodedata.normalize("NFC", m.group(1).replace("|", "").replace("-", "").strip())
        if STRESS in unicodedata.normalize("NFD", joined) and strip_stress(joined) == title:
            return joined
    return title


def candidates(path, skip=frozenset()):
    """(title, headword, pos, [English]) for every page that may become an
    entry, and a Counter of what was left out and why."""
    stats = collections.Counter()
    found = []
    for _, el in ET.iterparse(bz2.open(path), events=("end",)):
        if not el.tag.endswith("}page"):
            continue
        ns, title = el.find("{*}ns").text, el.find("{*}title").text or ""
        text = el.find("{*}revision/{*}text").text or ""
        el.clear()
        if ns != "0":
            continue
        by_language = sections(text)
        section = by_language.get("uk")
        if not section:
            continue
        stats["ukwikt_pages"] += 1
        title = unicodedata.normalize("NFC", title)
        if not ONE_WORD.fullmatch(title) or title.startswith("-") or title.endswith("-"):
            stats["ukwikt_not_one_word"] += 1
            continue
        if plain(title) in skip or RUSSIAN_LABEL.search(section):
            stats["ukwikt_nonstandard"] += 1
            continue
        if "ru" in by_language:
            stats["ukwikt_russian_section_too"] += 1
            continue
        t = re.search(r"\{\{(\S+) uk\b", section)
        pos = POS.get(t.group(1)) if t else None
        if not pos:
            stats["ukwikt_no_part_of_speech"] += 1
            continue
        meanings = english(section)
        if not meanings:
            stats["ukwikt_no_english"] += 1
            continue
        found.append((title, headword(title, section), pos, meanings))
    return found, stats


def add_ukwiktionary(db, path, skip=frozenset(), review=None):
    """Put the candidates into nebokrai.db, after every other entry. Returns stats."""
    found, stats = candidates(path, skip)
    words = {}
    entry_rows = []
    for eid, word, pos in db.execute("SELECT id, word, pos FROM entries"):
        words[eid] = plain(word)
        entry_rows.append((plain(word), eid, pos))
    known = new_words.Known(entry_rows, db.execute(
        "SELECT k.key, k.entry_id, e.pos FROM search_keys k JOIN entries e ON e.id = k.entry_id"
        " WHERE k.kind = 'form'").fetchall())
    english_keys = set(db.execute("SELECT entry_id, key FROM search_keys WHERE kind='english'"))
    meanings_of = collections.defaultdict(set)
    for eid, w in english_keys:
        meanings_of[eid].add(w)

    keys_out = []
    stats.update(ukwikt_entries=0, ukwikt_senses=0, ukwikt_english_keys=0)
    for title, head, pos, glosses in sorted(found):
        key = plain(title)
        meanings = {w for g in glosses for w in ENGLISH_WORD.findall(g.lower())
                    if len(w) > 1 and w not in COMMON_ENGLISH}
        verdict, reason, ids = known.check(key, pos, meanings, meanings_of)
        if review is not None:
            review.append((FROM_UK_WIKTIONARY, key, pos, verdict, reason,
                           " ".join(sorted({words.get(eid, "") for eid in ids}))))
        if verdict == "known":
            stats[f"ukwikt_known_{reason.replace('-', '_')}"] += 1
            if reason in ("same-word", "spelling"):
                for eid in ids:
                    if reason == "spelling":
                        keys_out.append((key, eid, "head"))
                    for w in sorted(meanings):
                        if (eid, w) not in english_keys:
                            english_keys.add((eid, w))
                            keys_out.append((w, eid, "english"))
                            stats["ukwikt_english_keys"] += 1
            continue
        if reason:
            stats["ukwikt_spelling_differs"] += 1
        eid = db.execute(
            "INSERT INTO entries(word, headword, pos, tags, head_forms, source) VALUES (?,?,?,'[]','[]',?)",
            (title, head, pos, FROM_UK_WIKTIONARY)).lastrowid
        known.add_word(key, eid, pos)
        meanings_of[eid] |= meanings
        words[eid] = key
        stats["ukwikt_entries"] += 1
        for n, gloss in enumerate(glosses, 1):
            db.execute("INSERT INTO senses(entry_id, n, gloss, tags, examples) VALUES (?,?,?,'[]','[]')",
                       (eid, n, gloss))
            stats["ukwikt_senses"] += 1
        keys = word_keys(title)
        keys.update((w, "english") for g in glosses for w in ENGLISH_WORD.findall(g.lower()) if len(w) > 1)
        keys_out += [(k, eid, kind) for k, kind in keys if k]
    db.executemany("INSERT INTO search_keys(key, entry_id, kind) VALUES (?,?,?)", keys_out)
    return dict(stats)


if __name__ == "__main__":
    print(__doc__)
