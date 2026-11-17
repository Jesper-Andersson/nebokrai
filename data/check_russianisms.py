#!/usr/bin/env python3
"""List the dictionary's words that may be Russianisms, with the evidence for each.

Usage, from the repo root:
    python3 data/check_russianisms.py nebokrai.db [--vesum] [--freq FILE --tatoeba DIR]
                                      [--russian FILE] [--out FILE]

    --vesum          ask VESUM about each word (needs pymorphy3 and
                     pymorphy3-dicts-uk, as import_vesum.py does; about 2 minutes)
    --freq FILE, --tatoeba DIR
                     the subtitle word list and the Tatoeba folder that
                     import_wiktionary.py takes, to spot words that are common
                     in the subtitles and absent from Ukrainian sentences
    --russian FILE   a list of Russian words, one at the start of each line
                     (for example FrequencyWords ru_50k.txt)
    --out FILE       where to write the report (default: stdout), tab-separated;
                     refused inside a folder git tracks

The script only reads. It changes neither database: what to turn down is for a
person to decide, and the report is the list to decide from. A word turned
down after reading goes into translations-skip.tsv by hand (for an entry made
from translation tables), and the next build leaves it out.

There is no test that tells a Russianism from a Ukrainian word, only evidence
of different weight. Each line of the report gives a verdict and what it rests
on:

    marked        a dictionary says so. Wiktionary labels every meaning
                  proscribed or nonstandard (кушати, сахар, ложити), or VESUM
                  marks every form of the word as distorted: its mark for
                  what stands outside the standard language, mostly surzhyk
                  (міроприємство, слідуючий, таракан), and also misspellings
                  (доречі for до речі).
    marked meaning
                  Wiktionary labels some meanings and not others: язик is
                  proscribed as "language" and an ordinary word as "tongue".
                  The meaning is the thing to mark, not the word.
    suspect       VESUM does not know the word, and it is common in the film
                  subtitles while Ukrainian sentences never use it, or it is
                  spelled like a Russian word. A third of the subtitle list is
                  Russian, so this mostly finds Russian words that got an
                  entry: пока, меньше.
    from Russian  Wiktionary's etymology says the word was borrowed from
                  Russian or is a calque of a Russian word. Most of these are
                  ordinary Ukrainian words (велосипед, телебачення); the list
                  is for reading, not for removal.
    unverified    a single lower-case word VESUM does not know, with nothing
                  else against it: new borrowings, rare words, and misspelled
                  translations. Worth a look where the word has no Wiktionary
                  page of its own (FROM_TRANSLATIONS in the "from" column).

LICENCE: the VESUM columns of the report come from VESUM (CC BY-NC-SA 4.0). The
report is a working file; do not commit or ship it. translations-skip.tsv is
written by a person who has read the words, not copied from the report.
"""
import argparse
import collections
import json
import os
import re
import sqlite3
import subprocess
import sys

from import_wiktionary import FROM_TRANSLATIONS, NOT_VOCABULARY, plain, ukrainian_counts

LABELS = {"proscribed", "nonstandard", "Surzhyk", "Russianism", "Russism"}
IN_GLOSS = re.compile(r"\b(russianism|russism|surzhyk|proscribed)\b", re.I)
ETYMOLOGY = (
    ("calque of a Russian word", re.compile(r"\bcalqued?\s+(?:of|from)\s+Russian|\bcalque\b[^.]{0,30}\bRussian", re.I)),
    ("borrowed from Russian", re.compile(r"\bborrow\w*\s+from\s+Russian|^\s*From\s+Russian\b", re.I)),
    ("came through Russian", re.compile(r"\b(?:via|through)\s+Russian\b", re.I)),
)
VERDICTS = ["marked", "marked meaning", "suspect", "from Russian", "unverified"]


def refuse_tracked(path):
    """Stop when `path` is inside the repository and git does not ignore it."""
    here = os.path.dirname(os.path.abspath(__file__))
    target = os.path.abspath(path)
    try:
        root = subprocess.run(["git", "-C", here, "rev-parse", "--show-toplevel"],
                              capture_output=True, text=True).stdout.strip()
        if not root or os.path.commonpath([os.path.abspath(root), target]) != os.path.abspath(root):
            return
        ignored = subprocess.run(["git", "-C", root, "check-ignore", "-q", target]).returncode == 0
    except (OSError, ValueError):
        return
    if not ignored:
        sys.exit(f"{path} would be tracked by git. The report draws on VESUM and must not be committed:"
                 " write it outside the repository or into an ignored folder such as data/raw/.")


def vesum_marks(words):
    """What VESUM says about each of `words` (plain spellings):
    {word: "distorted" | "slang" | "known"}; a word it does not have is absent.

    VESUM marks single forms as well as whole words (a wrong genitive of an
    ordinary noun), so a word counts as distorted only when every form listed
    under it is.
    """
    import pymorphy3
    morph = pymorphy3.MorphAnalyzer(lang="uk")
    seen = collections.defaultdict(lambda: [0, 0, 0])   # lemma -> forms, distorted, slang
    forms = set()
    for p in morph.iter_known_word_parses():
        form = plain(p.word)
        if form in words:
            forms.add(form)
        lemma = plain(p.normal_form)
        if lemma in words:
            count = seen[lemma]
            count[0] += 1
            count[1] += "Dist" in p.tag
            count[2] += "Slng" in p.tag
    marks = {form: "known" for form in forms}
    for lemma, (total, distorted, slang) in seen.items():
        marks[lemma] = "distorted" if distorted == total else "slang" if slang == total else "known"
    return marks


def first_words(path):
    """The first word of every line of a word list, in plain spelling."""
    with open(path, encoding="utf-8") as f:
        return {plain(line.split()[0]) for line in f if line.split()}


def check(db, vesum=False, freq=None, tatoeba=None, russian=None, max_ratio=20, min_count=20):
    entries = db.execute(
        "SELECT id, word, headword, pos, etymology, freq_rank, source FROM entries ORDER BY id").fetchall()
    senses = collections.defaultdict(list)
    for eid, gloss, tags in db.execute("SELECT entry_id, gloss, tags FROM senses ORDER BY entry_id, n"):
        senses[eid].append((gloss, json.loads(tags)))

    # Words VESUM and the corpus can be asked about: one lower-case word that
    # is vocabulary. A name or a phrase proves nothing by being absent.
    def askable(word, pos):
        return " " not in word and word == word.lower() and pos not in NOT_VOCABULARY and pos != "name"

    spellings = {plain(word) for _, word, _, pos, _, _, _ in entries if askable(word, pos)}
    marks = vesum_marks(spellings) if vesum else None
    russian_words = first_words(russian) if russian else None
    counts = reference = None
    corpus = ref_total = 0
    if freq and tatoeba:
        counts = {}
        for line in open(freq, encoding="utf-8"):
            parts = line.split()
            if len(parts) == 2 and parts[1].isdigit():
                counts[plain(parts[0])] = counts.get(plain(parts[0]), 0) + int(parts[1])
        reference = ukrainian_counts(tatoeba)
        corpus, ref_total = sum(counts.values()), sum(reference.values())

    rows = []
    for eid, word, headword, pos, etymology, freq_rank, source in entries:
        key = plain(word)
        own = senses[eid]
        strong, part, weak, origin = [], [], [], []

        # Which meanings Wiktionary labels: all of кушати, but of язик only the
        # second, "language", and the word itself is as Ukrainian as any
        labelled = {}
        for n, (gloss, tags) in enumerate(own, 1):
            found = {tag for tag in tags if tag in LABELS}
            found |= {m.group(1).lower() for m in [IN_GLOSS.search(gloss)] if m}
            if found:
                labelled[n] = found
        if labelled:
            names = ", ".join(sorted(set().union(*labelled.values())))
            if len(labelled) == len(own):
                strong.append(f"Wiktionary: {names}")
            else:
                part.append(f"Wiktionary: {names} (meaning {', '.join(map(str, labelled))} of {len(own)})")
        for name, pattern in ETYMOLOGY:
            if etymology and pattern.search(etymology):
                origin.append("etymology: " + name)
                break

        unknown = False
        if askable(word, pos):
            if marks is not None:
                mark = marks.get(key)
                if mark == "distorted":
                    strong.append("VESUM: distorted")
                elif mark == "slang":
                    weak.append("VESUM: slang")
                elif mark is None:
                    unknown = True
            if counts is not None and reference is not None:
                seen, clean = counts.get(key, 0), reference.get(key, 0)
                # The cap import_wiktionary.py puts on a spelling's count
                if seen >= min_count and seen > max_ratio * (clean + 1) / ref_total * corpus:
                    weak.append(f"subtitles {seen}, Ukrainian sentences {clean}")
            if russian_words is not None and key in russian_words:
                weak.append("spelled like a Russian word")

        if strong:
            verdict = "marked"
        elif part:
            verdict = "marked meaning"
        elif unknown and weak:
            verdict = "suspect"
        elif origin:
            verdict = "from Russian"
        elif unknown:
            verdict = "unverified"
        else:
            continue
        evidence = strong + part + (["VESUM: unknown"] if unknown else []) + weak + origin
        rows.append((verdict, headword, pos, source, freq_rank, "; ".join(evidence),
                     (own[0][0] if own else "")[:90]))
    rows.sort(key=lambda r: (VERDICTS.index(r[0]), r[3] != "wiktionary", r[4] is None, r[4] or 0, r[1]))
    return rows


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="List the words that may be Russianisms.")
    ap.add_argument("database")
    ap.add_argument("--vesum", action="store_true")
    ap.add_argument("--freq")
    ap.add_argument("--tatoeba")
    ap.add_argument("--russian")
    ap.add_argument("--out")
    args = ap.parse_args()
    if args.out:
        refuse_tracked(args.out)
    db = sqlite3.connect(f"file:{args.database}?mode=ro", uri=True)
    rows = check(db, args.vesum, args.freq, args.tatoeba, args.russian)

    if args.out:
        out = open(args.out, "w", encoding="utf-8", newline="\n")
    else:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows defaults to cp1252 when redirected
        out = sys.stdout
    out.write("verdict\tword\tpart of speech\tfrom\tfrequency rank\tevidence\tfirst meaning\n")
    for verdict, headword, pos, source, rank, evidence, gloss in rows:
        out.write("\t".join([verdict, headword, pos, source, str(rank or ""), evidence, gloss.replace("\t", " ")]) + "\n")
    if args.out:
        out.close()

    summary = collections.Counter((verdict, source == FROM_TRANSLATIONS) for verdict, _, _, source, _, _, _ in rows)
    for verdict in VERDICTS:
        print(f"{verdict:>14}: {summary[verdict, False]:6} entries, "
              f"{summary[verdict, True]:6} from translation tables", file=sys.stderr)
    if not args.vesum:
        print("VESUM was not asked (--vesum): no 'suspect' or 'unverified' words, fewer 'marked'.", file=sys.stderr)
