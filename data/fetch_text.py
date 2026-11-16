#!/usr/bin/env python3
"""Fetch Ukrainian text into plain .txt files, one per article, for missing_words.py.
Standard library only.

    python3 data/fetch_text.py wiki-search OUTDIR "query" [--limit 20]   Ukrainian Wikipedia articles matching a search
    python3 data/fetch_text.py wiki-titles OUTDIR "Title one" "Title two" ...
    python3 data/fetch_text.py wiki-category OUTDIR "Категорія:Назва" [--limit 50]
    python3 data/fetch_text.py rss OUTDIR FEED_URL [--limit 30]          every article linked from an RSS or Atom feed
    python3 data/fetch_text.py web OUTDIR URL [URL ...]                  the paragraph text of each page
    python3 data/fetch_text.py links URL [--match TEXT]                  print the links on a page (to find articles)

Each file starts with a "# source: <url>" line. One request a second. Files that already exist are skipped.
Prints one line per article: OK/SKIP/FAIL, the number of Cyrillic words, and the file or the error.
"""
import hashlib
import html.parser
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AGENT = "Mozilla/5.0 (compatible; wordlist-research/0.1)"
API = "https://uk.wikipedia.org/w/api.php"
PAUSE = 1.0
CYRILLIC_WORD = re.compile(r"[а-щьюяєіїґА-ЩЬЮЯЄІЇҐ'ʼ’]{2,}")


def get(url, tries=2):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept-Language": "uk"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read(5_000_000)
                charset = resp.headers.get_content_charset() or "utf-8"
            time.sleep(PAUSE)
            try:
                return raw.decode(charset)
            except (UnicodeDecodeError, LookupError):
                return raw.decode("utf-8", errors="replace")
        except Exception as err:  # report and retry once; the caller prints FAIL
            last = err
            if getattr(err, "code", None) == 429 and attempt == 0:
                # Rate limited: wait as long as the server asks (a minute at most), then try once more.
                asked = err.headers.get("Retry-After", "") if getattr(err, "headers", None) else ""
                time.sleep(min(int(asked), 60) if asked.isdigit() else 30)
            else:
                time.sleep(PAUSE * 3)
    raise last


def api(**params):
    params.update(format="json", formatversion="2", maxlag="5")
    time.sleep(2.0)  # Wikipedia answers 429 at one request a second from two runs at once
    return json.loads(get(API + "?" + urllib.parse.urlencode(params)))


def file_for(outdir, name):
    safe = re.sub(r"[^\w\-]+", "_", name, flags=re.UNICODE).strip("_")[:60]
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
    return os.path.join(outdir, f"{safe}-{digest}.txt")


def save(outdir, name, source, text):
    words = len(CYRILLIC_WORD.findall(text))
    if words < 80:
        print(f"FAIL {words:6d} too little Ukrainian text: {source}")
        return
    path = file_for(outdir, name)
    with open(path, "w", encoding="utf-8", newline="\n") as out:
        out.write(f"# source: {source}\n{text}\n")
    print(f"OK   {words:6d} {os.path.basename(path)}")


def wiki_article(outdir, title):
    if os.path.exists(file_for(outdir, title)):
        print(f"SKIP        {title}")
        return
    try:
        data = api(action="query", prop="extracts", explaintext="1", redirects="1", titles=title)
        page = data["query"]["pages"][0]
        text = page.get("extract") or ""
        # The reference and link sections are lists of titles and names, not running text.
        text = re.split(r"\n==+\s*(Примітки|Посилання|Джерела|Література|Див\. також)\s*==+", text)[0]
        url = "https://uk.wikipedia.org/wiki/" + urllib.parse.quote(page["title"].replace(" ", "_"))
        save(outdir, title, url, text)
    except Exception as err:
        print(f"FAIL        {title}: {err}")


class Paragraphs(html.parser.HTMLParser):
    """Collects the text of <p>, headings and list items, skipping scripts, styles and page furniture."""

    KEEP = {"p", "h1", "h2", "h3", "li", "blockquote"}
    SKIP = {"script", "style", "nav", "footer", "header", "aside", "form", "noscript", "figure", "button"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks, self.buf, self.depth, self.skip, self.hrefs = [], [], 0, 0, []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in self.KEEP:
            self.depth += 1
        elif tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.hrefs.append(href)

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
        elif tag in self.KEEP:
            self.depth = max(0, self.depth - 1)
            if self.depth == 0:
                block = re.sub(r"\s+", " ", "".join(self.buf)).strip()
                self.buf = []
                if block:
                    self.blocks.append(block)

    def handle_data(self, data):
        if self.depth and not self.skip:
            self.buf.append(data)


def web_page(outdir, url):
    if os.path.exists(file_for(outdir, url)):
        print(f"SKIP        {url}")
        return
    try:
        parser = Paragraphs()
        parser.feed(get(url))
        # Short blocks are menus, bylines and captions; running prose is what carries inflected words.
        blocks = [b for b in parser.blocks if len(CYRILLIC_WORD.findall(b)) >= 8]
        save(outdir, url, url, "\n".join(dict.fromkeys(blocks)))
    except Exception as err:
        print(f"FAIL        {url}: {err}")


def feed_links(url):
    root = ET.fromstring(get(url).lstrip("﻿").encode("utf-8"))
    links = []
    for node in root.iter():
        tag = node.tag.rsplit("}", 1)[-1]
        if tag == "link":
            href = (node.text or "").strip() or node.attrib.get("href", "")
            if href.startswith("http"):
                links.append(href)
    return list(dict.fromkeys(links))[1:]  # the first link is the site itself


def option(args, name, default):
    if name in args:
        at = args.index(name)
        value = args[at + 1]
        del args[at:at + 2]
        return value
    return default


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    mode = args.pop(0)
    limit = int(option(args, "--limit", "20"))
    match = option(args, "--match", "")
    if mode == "links":
        parser = Paragraphs()
        parser.feed(get(args[0]))
        seen = dict.fromkeys(urllib.parse.urljoin(args[0], h) for h in parser.hrefs)
        for href in seen:
            if match in href:
                print(href)
        return
    outdir = args.pop(0)
    os.makedirs(outdir, exist_ok=True)
    if mode == "wiki-titles":
        for title in args:
            wiki_article(outdir, title)
    elif mode == "wiki-search":
        hits = api(action="query", list="search", srsearch=args[0], srnamespace="0", srlimit=str(min(limit, 50)))
        for hit in hits["query"]["search"]:
            wiki_article(outdir, hit["title"])
    elif mode == "wiki-category":
        members = api(action="query", list="categorymembers", cmtitle=args[0], cmnamespace="0",
                      cmlimit=str(min(limit, 200)))
        for member in members["query"]["categorymembers"]:
            wiki_article(outdir, member["title"])
    elif mode == "rss":
        for link in feed_links(args[0])[:limit]:
            web_page(outdir, link)
    elif mode == "web":
        for url in args:
            web_page(outdir, url)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
