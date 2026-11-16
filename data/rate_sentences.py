#!/usr/bin/env python3
"""Rate Tatoeba's Ukrainian sentences for how natural and everyday they sound.

Usage (from the repo root):
    python3 data/rate_sentences.py check  data/raw [--db nebokrai.db] [--show N]
    python3 data/rate_sentences.py rate   data/raw [--db nebokrai.db] (--pilot N | --shown | --all) [--model M] [--jobs 3]
    python3 data/rate_sentences.py submit data/raw [--db nebokrai.db] (--pilot N | --all) [--model M]
    python3 data/rate_sentences.py collect data/raw
    python3 data/rate_sentences.py gold-sample data/raw gold.tsv [--n 300]
    python3 data/rate_sentences.py gold gold.tsv

    check        the free signals and text checks only; prints counts and examples, spends nothing
    rate         rates through the Claude Code CLI (`claude -p`): a subscription, no API key
    submit       sends the sentences not rated yet to the Message Batches API and remembers the batch
    collect      fetches every finished batch, merges it into data/sentence-ratings.tsv, prints the cost
    gold-sample  writes sentences for a native speaker to rate by hand (fill in natural, use, flags)
    gold         compares that hand-rated file with the judge's ratings

The scale, the flags and how the build uses them are in docs/sentence-rating.md.
data/sentence-ratings.tsv holds ids, a hash of each text and the ratings, never
the text itself. Ratings feed the build through import_wiktionary.load_ratings.

The Tatoeba files beyond the three the build reads are optional; each one that
is present in the folder adds its signal:
    ukr_sentences_detailed.tsv.bz2   who added each sentence
    ukr_sentences_base.tsv.bz2       whether it is an original or a translation
    user_languages.tar.bz2           each user's level in Ukrainian, 0 to 5
    users_sentences.csv              other users' reviews: -1, 0 or +1

`check`, `gold-sample` and `gold` use the standard library only. `submit` and
`collect` need `pip install anthropic` and an API key in ANTHROPIC_API_KEY or
in the root .env; the key is never printed. This is the one script in data/
that needs a package, and the build never imports it.
"""
import argparse
import bz2
import collections
import csv
import io
import json
import os
import random
import re
import sqlite3
import sys
import tarfile
import time

from import_wiktionary import (RATING_COLUMNS, RATINGS, TOKEN, form_index, load_ratings, plain,
                               short_first, tatoeba_pairs, text_hash)

HERE = os.path.dirname(os.path.abspath(__file__))
RUBRIC = "1"  # bump when the prompt or the scale changes: every sentence is then rated again
MODEL = "claude-opus-5-5"
PER_REQUEST = 50
STATE = "rating-batches.json"  # kept in the Tatoeba folder, beside the downloads
FLAGS = ["calque", "russianism", "error", "mistranslation", "offensive", "proverb", "names", "fragment"]
USES = ["common", "neutral", "rare"]
# Dollars per million tokens, standard rates; the Batches API charges half.
PRICES = {"claude-opus-5-5": (4.00, 20.00), "claude-sonnet-5-5": (2.00, 10.00),
          "claude-haiku-5-5": (0.10, 0.50)}
WORD_EDGE = r"(?<![\w'’ʼ])"
NOT_UKRAINIAN = re.compile("[ыэъёЫЭЪЁ]")


# --- Free signals from Tatoeba ------------------------------------------------

def tsv_rows(path):
    with bz2.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            yield line.rstrip("\n").split("\t")


def tatoeba_signals(folder):
    """tatoeba id -> {owner_level, translated, reviews, rejected} from whichever optional files are there."""
    def there(name):
        path = os.path.join(folder, name)
        return path if os.path.exists(path) else None

    owner, levels, base = {}, {}, {}
    if path := there("ukr_sentences_detailed.tsv.bz2"):
        for r in tsv_rows(path):  # id, lang, text, username, added, modified
            if len(r) >= 4 and r[3] not in ("", "\\N"):
                owner[int(r[0])] = r[3]
    if path := there("user_languages.tar.bz2"):
        with tarfile.open(path, "r:bz2") as tar:
            for member in tar:
                if not member.isfile():
                    continue
                for line in io.TextIOWrapper(tar.extractfile(member), encoding="utf-8"):
                    r = line.rstrip("\n").split("\t")  # lang, level, username, details
                    if len(r) >= 3 and r[0] == "ukr" and r[1].isdigit():
                        levels[r[2]] = int(r[1])
    if path := there("ukr_sentences_base.tsv.bz2"):
        for r in tsv_rows(path):  # id, base: 0 original, n translated from n, \N unknown
            if len(r) >= 2 and r[1].isdigit():
                base[int(r[0])] = int(r[1])
    reviews = collections.defaultdict(list)
    if path := there("users_sentences.csv"):
        with open(path, encoding="utf-8") as f:
            for line in f:
                r = line.rstrip("\n").split("\t")  # username, sentence id, review, added, modified
                if len(r) >= 3 and r[1].isdigit() and r[2].lstrip("-").isdigit():
                    reviews[int(r[1])].append((r[0], int(r[2])))

    def of(sid):
        user = owner.get(sid)
        marks = reviews.get(sid, [])
        return dict(
            owner_level="" if user is None or user not in levels else str(levels[user]),
            translated="" if sid not in base else str(int(base[sid] > 0)),
            reviews=" ".join(f"{v:+d}" for _, v in marks),
            rejected=any(v < 0 and levels.get(u) == 5 for u, v in marks),
        )
    return of


# --- Cheap text checks --------------------------------------------------------

def load_russianisms():
    with open(os.path.join(HERE, "russianisms.tsv"), encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    return [(re.compile(WORD_EDGE + "(?:" + r["pattern"] + r")(?![\w'’ʼ])", re.I), r["better"])
            for r in rows]


def text_hints(text, russianisms, known=None):
    """Short notes for the judge; they set no score on their own."""
    hints = []
    for rx, better in russianisms:
        if m := rx.search(text):
            hints.append(f"possible Russianism «{m.group()}» (usual: {better})")
    if NOT_UKRAINIAN.search(text):
        hints.append("contains a letter Ukrainian does not use")
    if known is not None:
        unknown = [w for w in (m.group() for m in TOKEN.finditer(text))
                   if plain(w) not in known and not w[:1].isupper()]
        if len(unknown) >= 3:  # comparatives and some short words are missing, so two is noise
            hints.append("words not in the dictionary: " + ", ".join(unknown))
    return hints


def candidates(folder):
    """Every sentence the build could show: (id, Ukrainian, English)."""
    return [(sid, text, en) for sid, text, en, *_ in short_first(tatoeba_pairs(folder))]


def known_words(db_path):
    if not db_path:
        return None
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        return set(form_index(db))
    finally:
        db.close()


# --- The judge ----------------------------------------------------------------

SYSTEM = """You rate Ukrainian sentences from Tatoeba for a dictionary that shows them to learners as examples.
For each sentence give two judgements and any flags. Judge the Ukrainian as a native speaker of standard modern
Ukrainian would, not as a translation exercise: a sentence can translate its English perfectly and still be
something no Ukrainian would say.

natural (1 to 5): would a native speaker say or write this, in these words?
  5  exactly what a native would say. «Поквапся, бо спізнишся на останній потяг.»
  4  natural, perhaps a little bookish or stiff. «Я не потребую вашого захисту.»
  3  correct, but a native would usually put it differently. «Чесно кажучи, ти дратівлива.»
  2  a calque, Russianism or surzhyk; understandable. «З поетів не виходять дуже добрі коректори.»
  1  ungrammatical, misspelt, or nonsense.

use: how likely a learner is to meet or need this sentence.
  common   everyday situations and words
  neutral  ordinary but not everyday
  rare     a proverb, technical or literary language, or an odd situation

flags (any number, or none):
  calque          built on English or Russian word order or idiom
  russianism      a Russian word or form (на протязі, приймати участь, являтися for "to be")
  error           a spelling, agreement, case or punctuation mistake
  mistranslation  the English says something else. «Ворог установив маріонетковий режим у ляльковому театрі.» /
                  "The enemy established a puppet state in Dogestan."
  offensive       slurs, crude sexual content, cruelty
  proverb         an idiom whose English is an equivalent, not a translation. «Хороший товар сам себе хвалить.» /
                  "Good wine needs no bush."
  names           about Tom, Mary or another of Tatoeba's stock characters (not a fault)
  fragment        not a whole sentence, or two run together

better: when natural is 3 or below, how a native would say it; otherwise an empty string.

Each sentence comes with hints: the Tatoeba owner's self-declared level in Ukrainian (5 is native), whether it
was translated from another language, other users' reviews, and automatic checks. Hints can be wrong; weigh
them, but your judgement of the text decides. Rate every sentence you are given, by its id."""

SCHEMA = {
    "type": "object",
    "properties": {"ratings": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "id": {"type": "integer"},
            "natural": {"type": "integer", "enum": [1, 2, 3, 4, 5]},
            "use": {"type": "string", "enum": USES},
            "flags": {"type": "array", "items": {"type": "string", "enum": FLAGS}},
            "better": {"type": "string"},
        },
        "required": ["id", "natural", "use", "flags", "better"],
        "additionalProperties": False,
    }}},
    "required": ["ratings"],
    "additionalProperties": False,
}

# Haiku, tuned against Opus's ratings (November 2026; docs/sentence-rating.md): an explicit checklist, the score
# written after the flags, and CAPPED below. On held-out sentences it then caught 85 % of what Opus would hide
# (70 % without), hiding 5 % of sentences Opus keeps. Opus keeps the plain prompt it was measured with.
CHECKLIST = """

How to check, one sentence at a time, before you score it:
1. Spelling. Read every word letter by letter. A missing, extra or swapped letter (сьогдні for сьогодні), a Russian
   letter (ы, э, ъ, ё) or a Russian spelling is an `error`. A typo is at most 2; one that leaves no real word is 1.
2. Grammar. Every adjective, pronoun and verb must agree with its noun in gender, number and case, and every
   preposition must take the right case (з Китаю, до Парижа, по вулиці). A wrong ending is an `error`, at most 2.
3. Russianisms and surzhyk. Ask whether a Ukrainian would use this word or phrase at all. Common traps: являтися
   for "to be" (є), приймати участь (брати участь), на протязі (протягом), слідуючий (наступний), співпадати
   (збігатися), рахувати for "to consider" (вважати), вірно for "correctly" (правильно), задавати питання
   (ставити запитання), вибачаюсь (перепрошую), любий for "any" (будь-який), відноситися до for "to concern"
   (стосуватися), по відношенню до (щодо), бувший (колишній), получати (отримувати). A Russianism is at most 2.
4. Calques. English or Russian structure in Ukrainian words: a passive where Ukrainian uses an active or impersonal
   form, possessive pronouns where Ukrainian leaves them out (Я помив свої руки), word-for-word idioms. At most 3,
   or 2 when it sounds foreign.
5. Translation. Read the English: the same people, numbers, tense, negation and meaning? If not, `mistranslation`.

Most of these sentences were written by learners or translated from English, and about one in seven has a real
problem; look for it. Give 5 only when you would not change a single word, and never give 4 or 5 to a sentence
you have flagged error, russianism, calque or mistranslation."""
CAPPED = {"error", "russianism"}  # Haiku flags these yet often scores 3; Opus scores them 1 or 2
_ITEM = SCHEMA["properties"]["ratings"]["items"]
SCORE_LAST = {**SCHEMA, "properties": {"ratings": {"type": "array", "items": {
    **_ITEM, "properties": {k: _ITEM["properties"][k] for k in ("id", "flags", "better", "natural", "use")}}}}}


def tuned(model):
    """Whether `model` gets the checklist, the score-last schema and the cap."""
    return "haiku" in (model or "")


def prompt_for(model):
    """(system prompt, schema) for a model."""
    return (SYSTEM + CHECKLIST, SCORE_LAST) if tuned(model) else (SYSTEM, SCHEMA)


def client():
    """An Anthropic client, the key taken from the environment or the root .env (never printed)."""
    import anthropic
    # A worktree under .claude/worktrees/ has no .env of its own, so look up the tree to the main checkout's.
    folder = os.path.dirname(HERE)
    while not os.environ.get("ANTHROPIC_API_KEY"):
        env = os.path.join(folder, ".env")
        if os.path.exists(env):
            with open(env, encoding="utf-8") as f:
                for line in f:
                    key, _, value = line.strip().partition("=")
                    if key == "ANTHROPIC_API_KEY" and value:
                        os.environ[key] = value.strip().strip("\"'")
        if os.path.dirname(folder) == folder:
            break
        folder = os.path.dirname(folder)
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("No ANTHROPIC_API_KEY in the environment or in any .env above data/.")
    return anthropic.Anthropic()


def request_params(model, items):
    lines = [json.dumps(item, ensure_ascii=False) for item in items]
    system, schema = prompt_for(model)
    return dict(
        model=model,
        max_tokens=16000,
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": schema}},
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": "Rate these sentences, one JSON object each:\n" + "\n".join(lines)}],
    )


def state_path(folder):
    return os.path.join(folder, STATE)


def read_state(folder):
    path = state_path(folder)
    if not os.path.exists(path):
        return {"batches": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_state(folder, state):
    with open(state_path(folder), "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False)


def pending(folder):
    """Sentences with no current rating: never rated, edited since, rated under an older rubric,
    or already sent in a batch that has not been collected."""
    ratings = load_ratings()
    sent = {sid for b in read_state(folder)["batches"] if not b.get("collected") for sid in b["items"]}
    out = []
    for sid, text, en in candidates(folder):
        row = ratings.get(sid)
        if sid in sent or (row and row["hash"] == text_hash(text) and row["rubric"] == RUBRIC):
            continue
        out.append((sid, text, en))
    return out


def shown_ids(db_path):
    """Tatoeba ids the site uses now: example sentences and grammar-practice (cloze) sentences."""
    if not db_path:
        sys.exit("--shown needs --db, the database whose sentences are shown")
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        return {sid for (sid,) in db.execute("SELECT tatoeba_id FROM examples UNION SELECT tatoeba_id FROM cloze")}
    finally:
        db.close()


def chunks(args):
    """The sentences to rate now, PER_REQUEST at a time: [(items, chunk)], where `items` keeps
    what the row will need (hash, signals, text for the review file) and `chunk` is what the judge sees."""
    todo = pending(args.folder)
    if args.pilot:
        todo = random.Random(2026).sample(todo, min(args.pilot, len(todo)))
    if getattr(args, "shown", False):
        shown = shown_ids(args.db)
        todo = [row for row in todo if row[0] in shown]
    signals, russianisms, known = tatoeba_signals(args.folder), load_russianisms(), known_words(args.db)
    out = []
    for start in range(0, len(todo), PER_REQUEST):
        items, chunk = {}, []
        for sid, text, en in todo[start:start + PER_REQUEST]:
            sig = signals(sid)
            items[str(sid)] = dict(hash=text_hash(text), uk=text, en=en, owner_level=sig["owner_level"],
                                   translated=sig["translated"], reviews=sig["reviews"],
                                   rejected=sig["rejected"])
            chunk.append(dict(id=sid, uk=text, en=en, owner_level=sig["owner_level"] or "unknown",
                              translated={"1": "yes", "0": "no"}.get(sig["translated"], "unknown"),
                              reviews=sig["reviews"] or "none", hints=text_hints(text, russianisms, known)))
        out.append((items, chunk))
    return out


def user_message(chunk):
    return "Rate these sentences, one JSON object each:\n" + "\n".join(
        json.dumps(item, ensure_ascii=False) for item in chunk)


def merge(rows, answers, items, model, review, problems):
    """Put the judge's answers for one request into `rows`; returns how many were rated.
    `review` collects (id, natural, use, flags, Ukrainian, English, better) for reading by hand."""
    got = 0
    for a in answers:
        item = items.get(str(a.get("id")))
        if not item or a.get("natural") not in range(1, 6):
            problems["unknown id or score"] += 1
            continue
        flags = [f for f in a.get("flags", []) if f in FLAGS]
        natural = min(a["natural"], 2) if tuned(model) and CAPPED & set(flags) else a["natural"]
        if item.get("rejected"):
            flags.append("rejected")
        flags = ",".join(sorted(set(flags)))
        rows[int(a["id"])] = dict(
            tatoeba_id=a["id"], hash=item["hash"], natural=natural,
            use=a.get("use") if a.get("use") in USES else "neutral", flags=flags,
            owner_level=item["owner_level"], translated=item["translated"],
            reviews=item["reviews"].replace(" ", ","), model=model, rubric=RUBRIC)
        review.append((a["id"], natural, a.get("use", ""), flags, item["uk"], item["en"], a.get("better", "")))
        got += 1
    problems["left out by the judge"] += len(items) - got
    return got


def write_review(folder, review):
    """rating-review.tsv beside the downloads (untracked: it holds Tatoeba's text), lowest scores first."""
    path = os.path.join(folder, "rating-review.tsv")
    old = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            old = [line.rstrip("\n").split("\t") for line in f][1:]
    seen = {str(r[0]) for r in review}
    rows = [r for r in old if r and r[0] not in seen] + [[str(c) for c in r] for r in review]
    rows.sort(key=lambda r: (int(r[1]), int(r[0])))
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write("tatoeba_id\tnatural\tuse\tflags\tuk\ten\tbetter\n")
        for r in rows:
            f.write("\t".join(c.replace("\t", " ").replace("\n", " ") for c in r) + "\n")
    return path


def ask_claude_code(chunk, model, system=None, effort="medium", schema=None, key="ratings"):
    """One request through the Claude Code CLI (`claude -p`), so a subscription can do the rating.
    It runs in an empty folder with no tools, settings, hooks or MCP servers: only this prompt counts.
    `system`, `schema` and `key` (the list in the answer) default to the rating prompt; the fix check passes its own.
    Returns (answers or None, API price equivalent in dollars, error or None)."""
    import subprocess
    import tempfile
    default_system, default_schema = prompt_for(model)
    schema = schema or default_schema
    cmd = ["claude", "-p", "--system-prompt", system or default_system, "--json-schema", json.dumps(schema),
           "--output-format", "json", "--tools", "", "--no-session-persistence", "--strict-mcp-config",
           "--setting-sources", "", "--effort", effort]
    if model:
        cmd += ["--model", model]
    with tempfile.TemporaryDirectory() as empty:
        try:
            done = subprocess.run(cmd, input=user_message(chunk), capture_output=True, text=True,
                                  encoding="utf-8", cwd=empty, timeout=900)
        except subprocess.TimeoutExpired:
            return None, 0.0, "timed out after 15 minutes"
    try:
        out = json.loads(done.stdout)
    except ValueError:
        return None, 0.0, (done.stderr or done.stdout).strip()[:300]
    dollars = out.get("total_cost_usd") or 0.0
    if out.get("is_error") or not out.get("structured_output"):
        return None, dollars, str(out.get("result") or out.get("subtype"))[:300]
    return out["structured_output"].get(key, []), dollars, None


def rate(args):
    """Rate through the Claude Code CLI a few requests at a time, saving after each one, so that a
    run stopped by a usage limit carries on where it left off when started again."""
    import concurrent.futures
    import shutil
    import threading
    if not shutil.which("claude"):
        sys.exit("The Claude Code CLI (claude) is not on PATH.")
    work = chunks(args)
    if not work:
        print("nothing to rate")
        return
    total = sum(len(items) for items, _ in work)
    print(f"{total} sentences in {len(work)} requests, {args.jobs} at a time, "
          f"model {args.model or 'the CLI default'}", flush=True)
    rows, review, problems = load_ratings(), [], collections.Counter()
    lock, started = threading.Lock(), time.time()
    tally = dict(rated=0, dollars=0.0, failed_in_a_row=0)

    def one(job):
        items, chunk = job
        if tally["failed_in_a_row"] >= 3:
            return
        answers, dollars, error = ask_claude_code(chunk, args.model)
        with lock:
            tally["dollars"] += dollars
            if error:
                tally["failed_in_a_row"] += 1
                problems["failed requests"] += 1
                print(f"  failed: {error}", flush=True)
                return
            tally["failed_in_a_row"] = 0
            tally["rated"] += merge(rows, answers, items, args.model or "claude-code", review, problems)
            write_ratings(rows)
            print(f"  {tally['rated']}/{total} rated, {time.time() - started:.0f} s", flush=True)

    with concurrent.futures.ThreadPoolExecutor(args.jobs) as pool:
        list(pool.map(one, work))
    if review:
        print("lowest scores first, with the judge's rephrasings:", write_review(args.folder, review))
    if tally["failed_in_a_row"] >= 3:
        print("stopped after three failures in a row (a usage limit?); run the same command again later")
    rated, spent = tally["rated"], time.time() - started
    print(f"{rated} rated in {spent / 60:.1f} min; API price equivalent ${tally['dollars']:.2f}"
          " (not billed on a subscription, but a measure of the usage it takes)")
    if any(problems.values()):
        print("problems:", {k: v for k, v in problems.items() if v})
    if rated:
        print("scores:", dict(sorted(collections.Counter(r[1] for r in review).items())))
        left = len(pending(args.folder))
        print(f"the {left} sentences still unrated: about {spent / rated * left / 3600:.0f} h at this pace,"
              f" ${tally['dollars'] / rated * left:.0f} at API prices")


def submit(args):
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request

    work = chunks(args)
    if not work:
        print("nothing to rate")
        return
    model = args.model or MODEL
    requests = [Request(custom_id=f"r{n}", params=MessageCreateParamsNonStreaming(**request_params(model, chunk)))
                for n, (_, chunk) in enumerate(work)]
    items = {sid: item for batch_items, _ in work for sid, item in batch_items.items()}
    batch = client().messages.batches.create(requests=requests)
    state = read_state(args.folder)
    state["batches"].append(dict(id=batch.id, model=model, rubric=RUBRIC, created=time.strftime("%Y-%m-%d %H:%M"),
                                 pilot=bool(args.pilot), items=items))
    write_state(args.folder, state)
    print(f"batch {batch.id}: {len(items)} sentences in {len(requests)} requests, model {model}")
    print(f"run `python3 data/rate_sentences.py collect {args.folder}` when it has ended (usually within an hour)")


def write_ratings(rows):
    ordered = sorted(rows.values(), key=lambda r: int(r["tatoeba_id"]))
    with open(RATINGS, "w", encoding="utf-8", newline="") as f:
        f.write("\t".join(RATING_COLUMNS) + "\n")
        for row in ordered:
            f.write("\t".join(str(row.get(c, "")) for c in RATING_COLUMNS) + "\n")


def cost(model, usage):
    """Dollars for one batch's usage at the Batches API's half price."""
    inp, out = PRICES.get(model, (0, 0))
    dollars = (usage["input"] * inp + usage["cache_write"] * inp * 1.25 + usage["cache_read"] * inp * 0.1
               + usage["output"] * out) / 1e6
    return dollars / 2


def collect(args):
    api, state = client(), read_state(args.folder)
    rows, review = load_ratings(), []
    for b in state["batches"]:
        if b.get("collected"):
            continue
        batch = api.messages.batches.retrieve(b["id"])
        if batch.processing_status != "ended":
            print(f"batch {b['id']}: still {batch.processing_status}")
            continue
        usage = collections.Counter()
        got, problems = 0, collections.Counter()
        for result in api.messages.batches.results(b["id"]):
            if result.result.type != "succeeded":
                problems[result.result.type] += 1
                continue
            msg = result.result.message
            u = msg.usage
            usage.update(input=u.input_tokens, output=u.output_tokens,
                         cache_write=u.cache_creation_input_tokens or 0, cache_read=u.cache_read_input_tokens or 0)
            if msg.stop_reason != "end_turn":
                problems[msg.stop_reason] += 1
                continue
            text = next((block.text for block in msg.content if block.type == "text"), "")
            try:
                answers = json.loads(text)["ratings"]
            except (ValueError, KeyError):
                problems["unreadable"] += 1
                continue
            got += merge(rows, answers, b["items"], b["model"], review, problems)
        b["collected"] = time.strftime("%Y-%m-%d %H:%M")
        dollars = cost(b["model"], usage)
        b["usage"], b["cost"] = dict(usage), round(dollars, 4)
        print(f"batch {b['id']}: {got} of {len(b['items'])} sentences rated, about ${dollars:.2f}"
              f" ({dict(usage)})")
        if problems:
            print("  not rated:", dict(problems))
        if got:
            left = len(pending(args.folder))
            print(f"  at this rate the {left} sentences still unrated would cost about ${dollars / got * left:.0f}")
    write_ratings(rows)
    write_state(args.folder, state)
    if review:
        print("lowest scores first, with the judge's rephrasings:", write_review(args.folder, review))


# --- Free checks and calibration ---------------------------------------------

def check(args):
    signals, russianisms, known = tatoeba_signals(args.folder), load_russianisms(), known_words(args.db)
    counts, examples = collections.Counter(), collections.defaultdict(list)
    levels = collections.Counter()
    todo = candidates(args.folder)
    for sid, text, en in todo:
        sig = signals(sid)
        levels[sig["owner_level"] or "unknown"] += 1
        counts["translated"] += sig["translated"] == "1"
        counts["reviewed"] += bool(sig["reviews"])
        counts["rejected by a native speaker"] += sig["rejected"]
        for hint in text_hints(text, russianisms, known):
            kind = hint.split(" «")[0].split(":")[0]
            counts[kind] += 1
            if len(examples[kind]) < args.show:
                examples[kind].append(f"{sid}: {text} | {hint}")
    print(f"{len(todo)} sentences could be shown")
    print("owner's level in Ukrainian:", dict(sorted(levels.items())))
    for kind, n in counts.most_common():
        print(f"{n:>8}  {kind}")
        for line in examples.get(kind, []):
            print("          " + line)


def gold_sample(args):
    """Draw sentences evenly across owner levels and lengths for a native speaker to rate."""
    signals = tatoeba_signals(args.folder)
    groups = collections.defaultdict(list)
    for sid, text, en in candidates(args.folder):
        n = len(TOKEN.findall(text))
        groups[signals(sid)["owner_level"] or "?", "short" if n <= 5 else "long"].append((sid, text, en))
    rng = random.Random(2026)
    per = max(1, args.n // len(groups))
    chosen = [row for key in sorted(groups) for row in rng.sample(groups[key], min(per, len(groups[key])))]
    with open(args.out, "w", encoding="utf-8", newline="") as f:
        f.write("tatoeba_id\tuk\ten\tnatural\tuse\tflags\n")
        for sid, text, en in chosen[:args.n]:
            f.write(f"{sid}\t{text}\t{en}\t\t\t\n")
    print(f"wrote {min(len(chosen), args.n)} sentences to {args.out}; fill in natural (1-5), use and flags")


def gold(args):
    ratings = load_ratings()
    with open(args.file, encoding="utf-8", newline="") as f:
        human = [r for r in csv.DictReader(f, delimiter="\t") if r.get("natural", "").strip()]
    both = [(h, ratings[int(h["tatoeba_id"])]) for h in human if int(h["tatoeba_id"]) in ratings]
    if not both:
        print("no sentence is rated by both the file and the judge")
        return
    near = sum(abs(int(h["natural"]) - int(j["natural"])) <= 1 for h, j in both)
    same = sum(int(h["natural"]) == int(j["natural"]) for h, j in both)
    print(f"{len(both)} sentences rated by both")
    print(f"  within one point: {near / len(both):.0%}   exact: {same / len(both):.0%}   (pass: 90 % within one)")
    for flag in ("offensive", "mistranslation"):
        hs = {h["tatoeba_id"] for h, _ in both if flag in h.get("flags", "")}
        js = {h["tatoeba_id"] for h, j in both if flag in j["flags"]}
        print(f"  {flag}: human {len(hs)}, judge {len(js)}, disagree on {len(hs ^ js)} (pass: 0)")
    worst = sorted(both, key=lambda p: -abs(int(p[0]["natural"]) - int(p[1]["natural"])))[:10]
    for h, j in worst:
        if abs(int(h["natural"]) - int(j["natural"])) > 1:
            print(f"  {h['tatoeba_id']}: human {h['natural']}, judge {j['natural']}  {h['uk']}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Rate Tatoeba's Ukrainian sentences for naturalness.")
    sub = ap.add_subparsers(dest="command", required=True)
    p = sub.add_parser("check")
    p.add_argument("folder")
    p.add_argument("--db")
    p.add_argument("--show", type=int, default=3)
    for name in ("rate", "submit"):
        p = sub.add_parser(name)
        p.add_argument("folder")
        p.add_argument("--db")
        p.add_argument("--model", default=MODEL if name == "submit" else None)
        how = p.add_mutually_exclusive_group(required=True)
        how.add_argument("--pilot", type=int)
        how.add_argument("--all", action="store_true")
        how.add_argument("--shown", action="store_true", help="only sentences the --db database shows now")
        if name == "rate":
            p.add_argument("--jobs", type=int, default=3, help="requests at a time")
    p = sub.add_parser("collect")
    p.add_argument("folder")
    p = sub.add_parser("gold-sample")
    p.add_argument("folder")
    p.add_argument("out")
    p.add_argument("--n", type=int, default=300)
    p = sub.add_parser("gold")
    p.add_argument("file")
    args = ap.parse_args()
    {"check": check, "rate": rate, "submit": submit, "collect": collect, "gold-sample": gold_sample, "gold": gold}[args.command](args)
