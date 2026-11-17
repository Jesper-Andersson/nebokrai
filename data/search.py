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
       a word on another entry's head line      історично -> історичний
    3. Latin letters, spelled the standard way      kalyna -> калина
    4. English meaning that is exactly the query    good   -> добрий
    5. an inflected form in Latin letters           knyhy  -> книга
    6. Latin letters, loosely spelled               kalina -> калина
    7. English meaning that mentions the query      good   -> добро ("good deed")
    8. prefix of a word (Cyrillic or Latin), for search-as-you-type; entries
       made from translation tables only when the others leave room

Within each step, more common words come first.

An old word, one whose matched meanings are all archaic, obsolete or dated,
comes after the modern words of its step, and an old exact English meaning
after the English mentions: "swedish" gives шве́дський and шведомо́вний before
the obsolete све́йський. Steps 1 to 3 are left alone, since whoever types
свейський or sveiskyi means that word.

A result found through an inflected form (steps 2 and 5) says which form in
`matched_forms`: "книги" is the genitive singular кни́ги and the nominative
plural кни́ги of книга.

A word with no entry of its own that another entry names on its head line is
found as that entry, and `through` says how: історично is the adverb that
істори́чний lists, упе́рше another spelling of впе́рше. Only when the query is
neither a dictionary word nor an inflected form.

VESUM fallback: if vesum.db is given (--vesum) and a Cyrillic query matches
nothing in steps 1 and 2, the form is looked up in VESUM to find its dictionary
word. When Wiktionary has that word, its entry is returned; when it does not,
a bare result is returned with `"vesum_only": True` and no meanings, so the
site can at least say "this is a form of X". VESUM is only ever read from its
own file (see import_vesum.py for the licence reason).

A bare result whose word is not standard Ukrainian (таможня, криша) has
`"kind": "distorted"` and `"use"`: the Ukrainian words to say instead, from
Nebokrai's own data/nonstandard.tsv first and VESUM's suggestions after. A word
in nonstandard.tsv gets such a result even without vesum.db.
"""
import json
import re
import sqlite3
import sys

from import_wiktionary import (KEYBOARD, TYPO_MIN, deletes, edits_apart, from_russian_letters,
                               loose_latin, national_translit, plain, sound_key)

RANK = {"word": 0, "form": 1, "head": 2, "latin": 3, "english": 4, "latin_form": 5, "latin_loose": 6,
        "english_mention": 7, "prefix": 8}
KIND = {v: k for k, v in RANK.items()}

# Sense tags that make a meaning old, mildest first. Not "historical":
# хрестоно́сець (crusader) is the modern word for a thing of the past, and the
# right answer.
OLD = ["dated", "archaic", "obsolete"]


def old_label(senses):
    """How old a word is by the meanings that matched: each meaning's strongest
    tag, and of those the mildest, so the label never overstates. None when a
    meaning has no such tag. све́йський (archaic, obsolete) is "obsolete"."""
    strongest = [max((OLD.index(t) for t in tags if t in OLD), default=-1) for _, tags in senses]
    if not strongest or min(strongest) < 0:
        return None
    return OLD[min(strongest)]

# What a head-line word is to the entry that lists it, from Wiktionary's tags,
# the first that applies. A word tagged with none of these (a genitive the
# table lacks) is simply one of its forms.
HEAD_KINDS = ["alternative", "adverb", "adjective", "abstract-noun", "perfective", "imperfective",
              "feminine", "diminutive", "augmentative", "comparative", "superlative"]


def head_through(head_forms, key):
    """`through` for an entry found by a head-line word: the word as the head
    line writes it (with stress) and what it is to the entry."""
    for f in head_forms:
        if plain(f["form"]) == key:
            kind = next((k for k in HEAD_KINDS if k in f["tags"]), "form")
            return dict(word=f["form"], kind=kind)
    return None


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


# What VESUM says a word is, the likeliest first: Іванович is a patronymic far
# more often than the surname it also is, and таракан, typed in lower case, is
# the Russian word for тарган before it is anybody's surname.
KINDS = ["distorted", "given-name", "patronymic", "surname", "abbreviation"]
REFLEXIVE = ("ся", "сь")
USE_MAX = 3  # Ukrainian words offered instead of a non-standard one


def rows_or_none(db, sql, args):
    """The rows of a query on a table an older database may not have yet."""
    try:
        return db.execute(sql, args).fetchall()
    except sqlite3.OperationalError as err:
        if "no such table" not in str(err):
            raise
        return []


def vesum_kind(vesum, lemma):
    """'surname' for шевченко, or None. A vesum.db built before kinds were
    stored has no such table, and then no word has a kind."""
    found = {kind for (kind,) in rows_or_none(vesum, "SELECT kind FROM vesum_kinds WHERE lemma=?", (lemma,))}
    return next((kind for kind in KINDS if kind in found), None)


def nonstandard(db, word):
    """Nebokrai's own note on a spelling that is not standard Ukrainian
    (data/nonstandard.tsv): its suggestions in order, [] when it lists none,
    or None when the spelling is not listed."""
    rows = rows_or_none(db, "SELECT n, use FROM nonstandard WHERE word=? ORDER BY n", (word,))
    return [use for n, use in rows if n > 0] if rows else None


def offered(db, word):
    """A Ukrainian word to offer, as {'word', 'has_entry'}: the stressed
    headword where one entry has the spelling, else the plain spelling."""
    heads = {h for (h,) in db.execute(
        "SELECT e.headword FROM search_keys k JOIN entries e ON e.id = k.entry_id"
        " WHERE k.key=? AND k.kind='word'", (word,))}
    return dict(word=next(iter(heads)) if len(heads) == 1 else word, has_entry=bool(heads))


def use_instead(db, vesum, lemma, ours):
    """What to say instead of a non-standard word: Nebokrai's own suggestions
    in their order, then VESUM's, those with an entry to link to before those
    without; USE_MAX at most. криша -> дах, приговор -> присуд, вирок, осуд.
    VESUM's order is kept otherwise: it is chosen, and the commonest word is
    not always the right one (суд, "court", is commoner than вирок)."""
    theirs = [u for (u,) in rows_or_none(
        vesum, "SELECT use FROM vesum_suggest WHERE lemma=? ORDER BY n", (lemma,))] if vesum is not None else []
    mine = [offered(db, w) for w in ours]
    others = [offered(db, w) for w in theirs if w not in ours]
    others.sort(key=lambda o: not o["has_entry"])  # stable: VESUM's order within each half
    found, seen = [], {lemma}
    for o in mine + others:
        if o["word"] not in seen:
            seen.add(o["word"])
            found.append(o)
    return found[:USE_MAX]


def instead(db, vesum, lemma, pos, ours):
    """What to answer a word with no entry: (entry id, use) when it is not
    standard Ukrainian and one of the words to say instead has an entry, so
    криша is answered with дах's own card (its most common entry, when the
    spelling has several); else (stub, None)."""
    stub = stub_for(db, vesum, lemma, pos, ours)
    first = next((u for u in stub.get("use", []) if u["has_entry"]), None)
    if first is None:
        return stub, None
    row = db.execute(
        "SELECT k.entry_id FROM search_keys k JOIN entries e ON e.id = k.entry_id WHERE k.key=? AND k.kind='word'"
        " ORDER BY e.freq_rank IS NULL, e.freq_rank, e.id LIMIT 1", (plain(first["word"]),)).fetchone()
    return row[0], stub["use"]


def stub_for(db, vesum, lemma, pos, ours):
    """A result for a word that has no entry: only VESUM knows it, or it is in
    Nebokrai's list of non-standard words (`ours` is not None)."""
    stub = dict(id=None, word=lemma, headword=lemma, pos=pos, tags=[], head_forms=[], glosses=[],
                freq_rank=None, match="form", vesum_only=True)
    kind = "distorted" if ours is not None else vesum_kind(vesum, lemma) if vesum is not None else None
    if kind:
        stub["kind"] = kind
    if kind == "distorted":
        stub["use"] = use_instead(db, vesum, lemma, ours or [])
    return stub


# Meanings are written in the singular ("sibling"), so an English query in the
# plural ("siblings") also looks for the words it may be the plural of.
IRREGULAR_PLURALS = {"men": "man", "women": "woman", "children": "child", "people": "person", "feet": "foot",
                     "teeth": "tooth", "mice": "mouse", "geese": "goose"}
# Words that end in -s but are no plural of a word without it: news is not
# more than one new
NOT_PLURALS = frozenset("news series species means thanks always perhaps sometimes besides towards afterwards "
                        "politics physics mathematics economics ethics athletics clothes scissors trousers "
                        "glasses jeans pyjamas measles diabetes".split())


def singulars(word):
    """The English words `word` may be the plural or the possessive of, in
    order: siblings -> sibling; boxes -> boxe, box; cities -> citie, city;
    knives -> knive, knif, knife; children -> child; mother's -> mother. Empty
    for a word that is no plural. A candidate that is no word finds nothing."""
    if word.endswith("'s"):
        return [word[:-2]]
    if word in IRREGULAR_PLURALS:
        return [IRREGULAR_PLURALS[word]]
    if len(word) < 4 or not word.endswith("s") or word in NOT_PLURALS or word.endswith(("ss", "us", "is")):
        return []
    found = [word[:-1]]
    if word.endswith("es"):
        found.append(word[:-2])
    if word.endswith("ies"):
        found.append(word[:-3] + "y")
    if word.endswith("ves"):
        found += [word[:-3] + "f", word[:-3] + "fe"]
    return found


# The `source` of the entries made from translation tables and from Ukrainian
# Wiktionary (THIN_SOURCES in import_wiktionary.py): no forms, no frequency rank.
THIN = ("wiktionary-translations", "ukwiktionary")


def prefixed(db, kind, low, high, limit, hits):
    """The entries a word starting with the query may be, for search-as-you-type.

    The window is the first limit * 3 keys in alphabetical order; the common
    words among them are sorted first afterwards. The thin entries (from
    translation tables or Ukrainian Wiktionary) would crowd it (кал has more
    than a hundred words), and they sort last anyway, so the window is filled
    from the others, and from those only while the results are still short:
    шер finds шериф."""
    sql = ("SELECT k.entry_id, k.kind FROM search_keys k JOIN entries e ON e.id = k.entry_id"
           f" WHERE k.kind=? AND k.key >= ? AND k.key < ? AND e.source {{}} (?, ?) ORDER BY k.key LIMIT ?")
    rows = db.execute(sql.format("NOT IN"), (kind, low, high, *THIN, limit * 3)).fetchall()
    if len({eid for eid, _ in rows} | set(hits)) < limit:
        rows += db.execute(sql.format("IN"), (kind, low, high, *THIN, limit * 3)).fetchall()
    return rows


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
    through = {}  # entry id -> the word that led to it, which is not one of its forms
    use_of = {}  # entry id -> the Ukrainian words offered, when it answers a non-standard word

    def answer(lemma, pos, ours):
        """A word with no entry: the Ukrainian word's entry, or a bare result."""
        found, use = instead(db, vesum, lemma, pos, ours)
        if use is None:
            stubs.append(found)
            return
        add([(found, "form")])
        through.setdefault(found, dict(word=lemma, kind="nonstandard"))
        use_of.setdefault(found, use)
    if cyrillic:
        key = plain(q)
        # A head-line word has a key only where no entry or form of Wiktionary's
        # own has the spelling, so it adds to the others only beside an entry
        # made from translation tables: походити is one, and ходити names it.
        add(db.execute("SELECT entry_id, kind FROM search_keys WHERE key=? AND kind IN ('word','form','head')",
                       (key,)))
        if not hits and vesum is not None:
            for lemma, pos in vesum.execute(
                    "SELECT DISTINCT lemma, pos FROM vesum_forms WHERE form=? ORDER BY lemma, pos", (key,)):
                found = db.execute("SELECT entry_id, 'form' FROM search_keys WHERE key=? AND kind='word'",
                                   (lemma,)).fetchall()
                if found:
                    add(found)
                    continue
                # мінеральних is a form of мінеральний, which мінера́л lists on its head line
                found = db.execute("SELECT entry_id, 'form' FROM search_keys WHERE key=? AND kind='head'",
                                   (lemma,)).fetchall()
                if found:
                    add(found)
                    for eid, _ in found:
                        through.setdefault(eid, dict(word=lemma, kind="head"))
                    continue
                # утворюватися has no entry, утворювати has: the reflexive verb
                # leads to the verb it is made from, and the result says so.
                if pos == "verb" and lemma.endswith(REFLEXIVE):
                    found = db.execute(
                        "SELECT k.entry_id, 'form' FROM search_keys k JOIN entries e ON e.id = k.entry_id"
                        " WHERE k.key=? AND k.kind='word' AND e.pos='verb'", (lemma[:-2],)).fetchall()
                    if found:
                        add(found)
                        for eid, _ in found:
                            through.setdefault(eid, dict(word=lemma, kind="reflexive"))
                        continue
                answer(lemma, pos, nonstandard(db, lemma))
        # криша without vesum.db, or бебісіттер, which VESUM does not know:
        # Nebokrai's own list still says what to write instead.
        if not hits and not stubs:
            ours = nonstandard(db, key)
            if ours is not None:
                answer(key, "", ours)
        if len(hits) < limit:
            add(prefixed(db, "word", key, key + "￿", limit, hits), RANK["prefix"])
    else:
        words = re.findall(r"[a-z]+(?:[-'][a-z]+)*", q.lower())
        key = loose_latin(q)
        if key and " " not in q:
            add(db.execute("SELECT entry_id, kind FROM search_keys WHERE key=? AND kind IN ('latin','latin_form')",
                           (key,)))
        # English: every word of the query must appear in the entry's meanings,
        # as typed or, for a plural, in the singular (siblings, sibling).
        content = [w for w in words if w not in ("to", "a", "an", "the")] or words
        sets = [set(r[0] for k in [w, *singulars(w)] for r in db.execute(
            "SELECT entry_id FROM search_keys WHERE key=? AND kind='english'", (k,))) for w in content]
        if sets:
            add(((eid, "english") for eid in set.intersection(*sets)))
        if len(hits) < limit and key and " " not in q and len(key) >= 3:
            add(prefixed(db, "latin", key, key + "{", limit, hits), RANK["prefix"])

    # A meaning that is exactly the query, or the query with its last word in
    # the singular: "sibling" is exactly what "siblings" asks for
    *before, last = q.lower().split(" ")
    wanted = {q.lower()} | {" ".join([*before, s]) for s in singulars(last)}

    results = []
    for eid, rank in hits.items():
        word, headword, pos, tags, head_forms, freq_rank = db.execute(
            "SELECT word, headword, pos, tags, head_forms, freq_rank FROM entries WHERE id=?", (eid,)).fetchone()
        senses = [(g, json.loads(t)) for g, t in db.execute(
            "SELECT gloss, tags FROM senses WHERE entry_id=? ORDER BY n", (eid,))]
        glosses = [g for g, _ in senses]
        # Within one kind of match, common words come first. For English queries,
        # a word whose meaning *is* the query ("mother") beats one that merely
        # mentions it ("mother-in-law"). Case is ignored: "English" is the
        # meaning of англійський, and the query arrives lowercased.
        common = freq_rank if freq_rank is not None else 10**9
        matched = senses
        if rank == RANK["english"]:
            matched = [(g, t) for g, t in senses
                       if wanted & {p.strip().lower() for p in re.split(r"[,;]", re.sub(r"\(.*?\)", "", g))}]
            if not matched:
                matched = senses
                rank = RANK["english_mention"]
        elif rank == RANK["latin"] and national_translit(word) != q.lower():
            # "good" loosely matches год ("hod"), but the user most likely means English.
            rank = RANK["latin_loose"]
        # An old word goes after the modern ones. The commonness count is of
        # spellings, so an old homograph borrows its rank: світ "light" (archaic)
        # has the count of світ "world", ум (dated) that of the Russian word.
        # Steps 1 to 3 keep their place: whoever types свейський means that word.
        label = old_label(matched)
        old = label is not None and rank > RANK["latin"]
        place = RANK["english_mention"] if old and rank == RANK["english"] else rank
        tie = (old, common)
        result = dict(id=eid, word=word, headword=headword, pos=pos,
                      tags=json.loads(tags), head_forms=json.loads(head_forms),
                      glosses=glosses, freq_rank=freq_rank, match=KIND[rank])
        if label:
            result["old"] = label
        if rank in (RANK["form"], RANK["latin_form"]):
            result["matched_forms"] = matched_forms(db, eid, key, cyrillic)
        if eid in through and rank == RANK["form"]:
            result["through"] = through[eid]
            if through[eid]["kind"] == "head":
                result["through"] = head_through(result["head_forms"], through[eid]["word"])
            if eid in use_of:
                result["use"] = use_of[eid]
        if rank == RANK["head"]:
            result["through"] = head_through(result["head_forms"], key)
        results.append((place, tie, result))
    results.sort(key=lambda r: (r[0], r[1], r[2]["word"], r[2]["id"]))
    exact = [r[2] for r in results if r[0] <= RANK["head"]]
    rest = [r[2] for r in results if r[0] > RANK["head"]]
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
    if kinds & {"word", "form", "head", "latin", "english", "latin_form", "latin_loose"}:
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
            if r.get("kind") == "distorted":
                use = ", ".join(u["word"] + ("" if u["has_entry"] else " (no entry)") for u in r["use"])
                print(f"{r['headword']}  [{r['pos']}]  not standard Ukrainian; in Ukrainian: {use or '-'}")
                continue
            what = f"a {r['kind'].replace('-', ' ')}" if r.get("kind") else "known to VESUM only"
            print(f"{r['headword']}  [{r['pos']}]  {what}, no definition yet")
            continue
        extra = ", ".join(f"{'/'.join(f['tags'])} {f['form']}" for f in r["head_forms"][:2])
        rank = f"#{r['freq_rank']}" if r["freq_rank"] else "unranked"
        print(f"{r['headword']}  [{r['pos']}; {' '.join(r['tags'])}]  {rank}  {extra}")
        for f in r.get("matched_forms", []):
            print(f"    = {f['form']}  ({' '.join(f['tags'])})")
        if r.get("through"):
            kind = r["through"]["kind"]
            if kind == "nonstandard":
                also = [u["word"] for u in r.get("use", []) if plain(u["word"]) != r["word"]]
                print(f"    instead of {r['through']['word']}, not standard Ukrainian"
                      + (f"; also {', '.join(also)}" if also else ""))
            else:
                what = "another spelling" if kind == "alternative" else f"its {kind}"
                print(f"    = {r['through']['word']}  ({what})")
        for g in r["glosses"][:3]:
            print(f"    - {g}")
        for uk, en in db.execute("SELECT uk, en FROM examples WHERE entry_id=? LIMIT 1", (r["id"],)):
            print(f"    e.g. {uk} / {en}")
