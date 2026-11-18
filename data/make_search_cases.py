#!/usr/bin/env python3
"""Record what the reference search returns, for the TypeScript tests to match.

Usage:
    python3 data/make_search_cases.py nebokrai.db vesum.db > tests/search-cases.json

Run it again whenever the database or search.py changes.
"""
import json
import sqlite3
import sys

from search import lookup

QUERIES = [
    # exact words and inflected forms
    "калина", "книги", "читаю", "КАЛИНА", "кали́на", "стан", "за", "читано", "м'яти", "м’яти", "мʼяти", "м`яти", "м´яти", "м‘яти", "п`ять", "об`єднання",
    # Latin input
    "kalyna", "kalina", "khata", "xata", "pryvit", "Kyiv", "shchastia", "dobryi", "čytáty",
    # English meanings
    "good", "dog", "to go", "mother", "to read", "the horizon", "viburnum", "guelder rose", "in", "water",
    # English plurals and possessives find the singular meaning; news is no plural of new
    "siblings", "children", "cities", "knives", "mother's", "news",
    # a capitalised meaning is still an exact match: English -> англійський
    "English",
    # old words (archaic, obsolete, dated) after modern ones: an obsolete exact meaning after the
    # mentions (свейський), an archaic homograph (світ "light"), a dated word with a Russian count (ум);
    # a historical word stays first (хрестоносець), and the old word typed itself is still found
    "swedish", "light", "intelligence", "crusader", "свейський", "sveiskyi",
    # search-as-you-type prefixes
    "кал", "неб", "чит", "kal", "neb", "pry",
    # only VESUM knows these
    "книжечку", "походити", "дорівнює",
    # ... and says what they are: a surname, a given name, a patronymic; сокирко is a surname beside the
    # plain noun сокирка
    "осташка", "фрідріха", "максимовичу", "сокирко",
    # a reflexive verb with no entry leads to the verb it is made from; вчитися has its own entry
    "утворюватися", "міститься", "вчитися",
    # words on another entry's head line: another spelling, an adverb, a relational adjective and one of
    # its forms (through VESUM), an aspect partner, a superlative, and one listed by two entries
    "уперше", "історично", "мінеральний", "мінеральних", "походити", "найширший", "дармо",
    # abbreviations, Nebokrai's own (ін., км) and Wiktionary's (ст.), with and without the full stop
    "ін.", "ін", "км", "ст", "англ",
    # "form of" pages kept as words: a diminutive and a participle (only VESUM knew these two before),
    # a comparative and one of its cases, a superlative, a verbal noun, alternative forms, a female
    # equivalent, another participle; and the label that must not be searchable
    "соловейком", "нездійсненними", "більший", "більшого", "найкращий", "утворення", "окрім", "немає", "авторку", "створена", "comparative",
    # entries made from English Wiktionary's translation tables: a noun, in Latin letters and by its
    # English word, a set phrase, a form only VESUM knows; an English word that also reaches an entry
    # of Wiktionary's own as a mention (комітет for "board"), and one only a translation table knows
    "шериф", "sheryf", "sheriff", "про всяк випадок", "гімназії", "board", "shrike",
    # translation-table spellings of words that have an entry, folded into it (блоґ for блог, указувати
    # for вказувати), and one that only looks like one and keeps its own entry (уступати "to yield",
    # not вступати "to enter")
    "блоґ", "указувати", "уступати",
    # entries made from Ukrainian Wiktionary's translation tables: a noun, by its English word, an adverb,
    # and a prefix that reaches one only when the other entries leave room (мура)
    "мурал", "mural", "набакир", "мура",
    # not standard Ukrainian: Russian words and surzhyk point to the Ukrainian ones. From VESUM's list
    # (таможня, приговор, шокуючий), from Nebokrai's own (криша, and бебісіттер, which VESUM lacks), a
    # form of one (криші), and таракан, which is also a surname
    "таможня", "приговор", "шокуючий", "криша", "криші", "бебісіттер", "таракан",
    # guesses: other spellings, sound-alikes, typos, wrong keyboard layout
    "dobra nich", "bud laska", "будьласка", "shastya", "kiev", "привит", "превіт", "дякуйу",
    "ghbdsn", "книгы", "привфт", "пирвіт", "привт", "приввіт", "kalnya", "молако", "спосибі",
    "небокрий", "на добранич", "good deed", "viburnam", "lf", "здравствуйте",
    # inflected forms in Latin letters, and by sound
    "knyhy", "knigi", "chytaiu", "chitayu", "dobroho", "male", "more", "son", "кнегу", "книгі",
    "читайу", "добрава", "nebokraiu",
    # nothing, or nearly
    "", "   ", "qqqqzz", "ъъъ", "123", "don't",
    # one spelling, several forms, stressed apart: руки́ (genitive singular), ру́ки (plural)
    "руки", "кави", "ruky",
]

if __name__ == "__main__":
    db = sqlite3.connect(sys.argv[1])
    vesum = sqlite3.connect(sys.argv[2])
    cases = []
    for q in QUERIES:
        for use_vesum in (False, True):
            got = lookup(db, q, limit=20, vesum=vesum if use_vesum else None)
            brief = lambda rows: [[r["id"], r["word"], r["pos"], r["match"]] for r in rows]
            case = {"query": q, "vesum": use_vesum, "expect": brief(got["results"]),
                    "suggest": brief(got["suggestions"])}
            # Which forms the query spells, for the results that say so. Only
            # where there are any, so the other cases stay as they were.
            forms = [[r["id"], [[f["form"], f["tags"]] for f in r["matched_forms"]]]
                     for r in got["results"] if r.get("matched_forms")]
            if forms:
                case["forms"] = forms
            # What a VESUM-only word is, and the reflexive verb that led to an
            # entry: [word, what], again only where there is something to say.
            notes = ([[r["word"], r["kind"]] for r in got["results"] if r.get("kind")]
                     + [[r["word"], r["through"]["word"]] for r in got["results"] if r.get("through")])
            if notes:
                case["notes"] = notes
            # What to say instead of a non-standard word: [word, [[Ukrainian word, has an entry], ...]]
            use = [[r["word"], [[u["word"], u["has_entry"]] for u in r["use"]]]
                   for r in got["results"] if "use" in r]
            if use:
                case["use"] = use
            # How old a result is, for the ones with a label: [id, label]
            old = [[r["id"], r["old"]] for r in got["results"] if r.get("old")]
            if old:
                case["old"] = old
            cases.append(case)
    sys.stdout.reconfigure(encoding="utf-8")  # Windows defaults to cp1252 when redirected
    json.dump(cases, sys.stdout, ensure_ascii=False, indent=1)
