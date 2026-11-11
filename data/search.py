#!/usr/bin/env python3
"""Reference search over nebokrai.db. The web app's search should behave the same.

Usage:
    python3 search.py nebokrai.db kalyna
    python3 search.py nebokrai.db книги
    python3 search.py nebokrai.db "to read"

How a query is matched, best first:
    1. exact dictionary word          калина  -> калина
    2. an inflected form              книги   -> книга
    3. Latin letters, spelled the standard way      kalyna -> калина
    4. English meaning that is exactly the query    good   -> добрий
    5. Latin letters, loosely spelled               kalina -> калина
    6. English meaning that mentions the query      good   -> добро ("good deed")
    7. prefix of a word (Cyrillic or Latin), for search-as-you-type

Within each step, more common words come first.
"""
import json
import re
import sqlite3
import sys

from import_wiktionary import loose_latin, national_translit, plain

RANK = {"word": 0, "form": 1, "latin": 2, "english": 3, "latin_loose": 4, "english_mention": 5, "prefix": 6}


def search(db, query, limit=20):
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

    if cyrillic:
        key = plain(q)
        add(db.execute("SELECT entry_id, kind FROM search_keys WHERE key=? AND kind IN ('word','form')", (key,)))
        if len(hits) < limit:
            add(db.execute("SELECT entry_id, kind FROM search_keys WHERE kind='word' AND key >= ? AND key < ? LIMIT ?",
                           (key, key + "￿", limit * 3)), RANK["prefix"])
    else:
        words = re.findall(r"[a-z]+(?:[-'][a-z]+)*", q.lower())
        key = loose_latin(q)
        if key and " " not in q:
            add(db.execute("SELECT entry_id, kind FROM search_keys WHERE key=? AND kind='latin'", (key,)))
        # English: every word of the query must appear in the entry's meanings.
        content = [w for w in words if w not in ("to", "a", "an", "the")] or words
        sets = [set(r[0] for r in db.execute(
            "SELECT entry_id FROM search_keys WHERE key=? AND kind='english'", (w,))) for w in content]
        if sets:
            add(((eid, "english") for eid in set.intersection(*sets)))
        if len(hits) < limit and key and " " not in q and len(key) >= 3:
            add(db.execute("SELECT entry_id, kind FROM search_keys WHERE kind='latin' AND key >= ? AND key < ? LIMIT ?",
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
        results.append((rank, tie, dict(id=eid, word=word, headword=headword, pos=pos,
                                        tags=json.loads(tags), head_forms=json.loads(head_forms),
                                        glosses=glosses, freq_rank=freq_rank)))
    results.sort(key=lambda r: (r[0], r[1], r[2]["word"]))
    return [r[2] for r in results[:limit]]


if __name__ == "__main__":
    db = sqlite3.connect(sys.argv[1])
    import signal
    signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # allow piping into head
    for r in search(db, " ".join(sys.argv[2:]), limit=8):
        extra = ", ".join(f"{'/'.join(f['tags'])} {f['form']}" for f in r["head_forms"][:2])
        rank = f"#{r['freq_rank']}" if r["freq_rank"] else "unranked"
        print(f"{r['headword']}  [{r['pos']}; {' '.join(r['tags'])}]  {rank}  {extra}")
        for g in r["glosses"][:3]:
            print(f"    - {g}")
        for uk, en in db.execute("SELECT uk, en FROM examples WHERE entry_id=? LIMIT 1", (r["id"],)):
            print(f"    e.g. {uk} / {en}")
