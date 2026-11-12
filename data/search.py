#!/usr/bin/env python3
"""Reference search over nebokrai.db. The web app's search should behave the same.

Usage:
    python3 search.py nebokrai.db kalyna
    python3 search.py nebokrai.db книги
    python3 search.py nebokrai.db "to read"
    python3 search.py nebokrai.db --vesum vesum.db соловейком

How a query is matched, best first:
    1. exact dictionary word          калина  -> калина
    2. an inflected form              книги   -> книга
    3. Latin letters, spelled the standard way      kalyna -> калина
    4. English meaning that is exactly the query    good   -> добрий
    5. an inflected form in Latin letters           knyhy  -> книга
    6. Latin letters, loosely spelled               kalina -> калина
    7. English meaning that mentions the query      good   -> добро ("good deed")
    8. prefix of a word (Cyrillic or Latin), for search-as-you-type

Within each step, more common words come first.

A result found through an inflected form (steps 2 and 5) says which form in
`matched_forms`: "книги" is the genitive singular кни́ги and the nominative
plural кни́ги of книга.

VESUM fallback: if vesum.db is given (--vesum) and a Cyrillic query matches
nothing in steps 1 and 2, the form is looked up in VESUM to find its dictionary
word. When Wiktionary has that word, its entry is returned; when it does not,
a bare result is returned with `"vesum_only": True` and no meanings, so the
site can at least say "this is a form of X". VESUM is only ever read from its
own file (see import_vesum.py for the licence reason).
"""
import json
import re
import sqlite3
import sys

from import_wiktionary import (KEYBOARD, TYPO_MIN, deletes, edits_apart, from_russian_letters,
                               loose_latin, national_translit, plain, sound_key)

RANK = {"word": 0, "form": 1, "latin": 2, "english": 3, "latin_form": 4, "latin_loose": 5,
        "english_mention": 6, "prefix": 7}
KIND = {v: k for k, v in RANK.items()}


def matched_forms(db, eid, key, cyrillic):
    """The forms of entry `eid` that the query spells, in the order of its table.

    "руки" is руки́ (genitive singular) and also ру́ки (nominative, accusative
    and vocative plural), so there can be several, stressed differently. `key`
    is the query as search() looked it up: plain() of a Cyrillic query, or
    loose_latin() of a Latin one ("ruky"). The list is empty when the form came
    from VESUM, which knows the dictionary word but not which form it is.
    """
    found, seen = [], set()
    for form, spelling, tags in db.execute(
            "SELECT form, plain, tags FROM forms WHERE entry_id=? ORDER BY id", (eid,)):
        if (spelling if cyrillic else loose_latin(national_translit(spelling))) != key:
            continue
        if (form, tags) not in seen:
            seen.add((form, tags))
            found.append({"form": form, "tags": json.loads(tags)})
    return found


def search(db, query, limit=20, vesum=None):
    q = query.strip()
    if not q:
        return []
    cyrillic = bool(re.search(r"[Ѐ-ӿ]", q))
    hits = {}  # entry_id -> best rank

    def add(rows, rank=None):
        for eid, kind in rows:
            r = RANK[kind] if rank is None else rank
            if eid not in hits or r < hits[eid]:
                hits[eid] = r

    stubs = []  # words only VESUM knows
    if cyrillic:
        key = plain(q)
        add(db.execute("SELECT entry_id, kind FROM search_keys WHERE key=? AND kind IN ('word','form')", (key,)))
        if not hits and vesum is not None:
            for lemma, pos in vesum.execute(
                    "SELECT DISTINCT lemma, pos FROM vesum_forms WHERE form=? ORDER BY lemma, pos", (key,)):
                found = db.execute("SELECT entry_id, 'form' FROM search_keys WHERE key=? AND kind='word'",
                                   (lemma,)).fetchall()
                if found:
                    add(found)
                else:
                    stubs.append(dict(id=None, word=lemma, headword=lemma, pos=pos, tags=[],
                                      head_forms=[], glosses=[], freq_rank=None, match="form",
                                      vesum_only=True))
        if len(hits) < limit:
            add(db.execute("SELECT entry_id, kind FROM search_keys WHERE kind='word' AND key >= ? AND key < ? ORDER BY key LIMIT ?",
                           (key, key + "￿", limit * 3)), RANK["prefix"])
    else:
        words = re.findall(r"[a-z]+(?:[-'][a-z]+)*", q.lower())
        key = loose_latin(q)
        if key and " " not in q:
            add(db.execute("SELECT entry_id, kind FROM search_keys WHERE key=? AND kind IN ('latin','latin_form')",
                           (key,)))
        # English: every word of the query must appear in the entry's meanings.
        content = [w for w in words if w not in ("to", "a", "an", "the")] or words
        sets = [set(r[0] for r in db.execute(
            "SELECT entry_id FROM search_keys WHERE key=? AND kind='english'", (w,))) for w in content]
        if sets:
            add(((eid, "english") for eid in set.intersection(*sets)))
        if len(hits) < limit and key and " " not in q and len(key) >= 3:
            add(db.execute("SELECT entry_id, kind FROM search_keys WHERE kind='latin' AND key >= ? AND key < ? ORDER BY key LIMIT ?",
                           (key, key + "{", limit * 3)), RANK["prefix"])

    results = []
    for eid, rank in hits.items():
        word, headword, pos, tags, head_forms, freq_rank = db.execute(
            "SELECT word, headword, pos, tags, head_forms, freq_rank FROM entries WHERE id=?", (eid,)).fetchone()
        glosses = [g for (g,) in db.execute("SELECT gloss FROM senses WHERE entry_id=? ORDER BY n", (eid,))]
        # Within one kind of match, common words come first. For English queries,
        # a word whose meaning *is* the query ("mother") beats one that merely
        # mentions it ("mother-in-law").
        common = freq_rank if freq_rank is not None else 10**9
        if rank == RANK["english"]:
            exact = any(q.lower() in [p.strip() for p in re.split(r"[,;]", re.sub(r"\(.*?\)", "", g))]
                        for g in glosses)
            if not exact:
                rank = RANK["english_mention"]
        elif rank == RANK["latin"] and national_translit(word) != q.lower():
            # "good" loosely matches год ("hod"), but the user most likely means English.
            rank = RANK["latin_loose"]
        tie = common
        result = dict(id=eid, word=word, headword=headword, pos=pos,
                      tags=json.loads(tags), head_forms=json.loads(head_forms),
                      glosses=glosses, freq_rank=freq_rank, match=KIND[rank])
        if rank in (RANK["form"], RANK["latin_form"]):
            result["matched_forms"] = matched_forms(db, eid, key, cyrillic)
        results.append((rank, tie, result))
    results.sort(key=lambda r: (r[0], r[1], r[2]["word"], r[2]["id"]))
    exact = [r[2] for r in results if r[0] <= RANK["form"]]
    rest = [r[2] for r in results if r[0] > RANK["form"]]
    return (exact + stubs + rest)[:limit]


GUESS = ["layout", "respelled", "sound", "typo"]


def suggest(db, query, limit=5, exclude=(), typos=True):
    """Guesses for a query that found nothing: "did you mean ...?".

    Tried in this order, most certain first:
        layout     typed on the wrong keyboard layout   ghbdsn  -> привіт
        respelled  same word, another spelling habit    привит  -> привіт
                   (also spaces: "dobra nich", and Russian letters: книгы)
        sound      letters that sound alike             превіт  -> привіт
        typo       one letter wrong, missing or extra   привфт  -> привіт
    Within one kind, more common words come first. Typo guesses cover dictionary
    words only; the other kinds also recognise inflected forms (кнегу -> книга).
    """
    q = query.strip()
    if not q:
        return []
    found = {}  # entry_id -> index into GUESS

    def add(ids, kind):
        for eid in ids:
            if eid not in exclude and eid not in found:
                found[eid] = kind

    def keyed(key, kind):
        return [r[0] for r in db.execute("SELECT entry_id FROM search_keys WHERE key=? AND kind=?", (key, kind))]

    def exact(key):
        return [r[0] for r in db.execute(
            "SELECT entry_id FROM search_keys WHERE key=? AND kind IN ('word','form')", (key,))]

    if re.search(r"[Ѐ-ӿ]", q):
        key = plain(q)
        fixed = from_russian_letters(key)
        if fixed != key:
            add(exact(fixed), 1)
        latin = loose_latin(national_translit(fixed))
    else:
        add(exact(plain(q.lower().translate(KEYBOARD))), 0)
        latin = loose_latin(q)
    if latin:
        add(keyed(latin, "latin") + keyed(latin, "latin_form"), 1)
        sk = sound_key(latin)
        add(keyed(sk, "sound") + keyed(sk, "sound_form"), 2)
        if typos and len(sk) >= TYPO_MIN:
            variants = json.dumps(sorted(deletes(sk) | {sk}), ensure_ascii=False)
            near = {r[0] for r in db.execute(
                "SELECT entry_id FROM search_keys WHERE kind IN ('sound','typo')"
                " AND key IN (SELECT value FROM json_each(?))", (variants,))}
            near |= set(keyed(sk, "typo"))
            near -= set(found)
            if near:
                ids = json.dumps(sorted(near))
                close = {eid for eid, k in db.execute(
                    "SELECT entry_id, key FROM search_keys WHERE kind='sound'"
                    " AND entry_id IN (SELECT value FROM json_each(?))", (ids,)) if edits_apart(sk, k)}
                add(sorted(close), 3)

    results = []
    for eid, kind in found.items():
        word, headword, pos, tags, head_forms, freq_rank = db.execute(
            "SELECT word, headword, pos, tags, head_forms, freq_rank FROM entries WHERE id=?", (eid,)).fetchone()
        glosses = [g for (g,) in db.execute("SELECT gloss FROM senses WHERE entry_id=? ORDER BY n", (eid,))]
        results.append((kind, freq_rank if freq_rank is not None else 10**9, word, eid,
                        dict(id=eid, word=word, headword=headword, pos=pos, tags=json.loads(tags),
                             head_forms=json.loads(head_forms), glosses=glosses, freq_rank=freq_rank,
                             match=GUESS[kind])))
    results.sort(key=lambda r: r[:4])
    return [r[4] for r in results[:limit]]


def lookup(db, query, limit=20, vesum=None, suggestions=5):
    """What the site's search endpoint returns: results, plus guesses when no
    result is a sure match."""
    results = search(db, query, limit=limit, vesum=vesum)
    kinds = {r["match"] for r in results}
    if kinds & {"word", "form", "latin", "english", "latin_form", "latin_loose"}:
        guesses = []  # a sure match: no second-guessing
    else:
        # Nothing, or only loose matches ("kiev" is mentioned in a few meanings
        # but the user wants Київ). Typo guesses are the least certain, so they
        # are offered only when there is nothing better to show.
        # A typo guess for several Latin words would mostly be noise for English.
        typos = not (kinds - {"prefix"}) and (" " not in query.strip() or bool(re.search(r"[Ѐ-ӿ]", query)))
        guesses = suggest(db, query, limit=suggestions, exclude={r["id"] for r in results}, typos=typos)
    return {"query": query, "results": results, "suggestions": guesses}


if __name__ == "__main__":
    import argparse
    import signal
    if hasattr(signal, "SIGPIPE"):  # not on Windows
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # allow piping into head
    import sys
    sys.stdout.reconfigure(encoding="utf-8")  # Windows defaults to cp1252 when piped
    ap = argparse.ArgumentParser(description="Search the Nebokrai dictionary.")
    ap.add_argument("database")
    ap.add_argument("--vesum", help="path to vesum.db for the form-lookup fallback")
    ap.add_argument("query", nargs="+")
    args = ap.parse_args()
    db = sqlite3.connect(args.database)
    vesum = sqlite3.connect(args.vesum) if args.vesum else None
    answer = lookup(db, " ".join(args.query), limit=8, vesum=vesum)
    for r in answer["suggestions"]:
        print(f"did you mean {r['headword']}?  [{r['pos']}; {r['match']}]  {'; '.join(r['glosses'][:2])[:60]}")
    for r in answer["results"]:
        if r.get("vesum_only"):
            print(f"{r['headword']}  [{r['pos']}]  known to VESUM only, no definition yet")
            continue
        extra = ", ".join(f"{'/'.join(f['tags'])} {f['form']}" for f in r["head_forms"][:2])
        rank = f"#{r['freq_rank']}" if r["freq_rank"] else "unranked"
        print(f"{r['headword']}  [{r['pos']}; {' '.join(r['tags'])}]  {rank}  {extra}")
        for f in r.get("matched_forms", []):
            print(f"    = {f['form']}  ({' '.join(f['tags'])})")
        for g in r["glosses"][:3]:
            print(f"    - {g}")
        for uk, en in db.execute("SELECT uk, en FROM examples WHERE entry_id=? LIMIT 1", (r["id"],)):
            print(f"    e.g. {uk} / {en}")
