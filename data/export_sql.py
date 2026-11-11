#!/usr/bin/env python3
"""Write a database as SQL text that Cloudflare D1 can load.

Usage:
    python3 data/export_sql.py nebokrai.db data/raw/nebokrai.sql
    python3 data/export_sql.py vesum.db data/raw/vesum.sql

D1 cannot take a .db file, only SQL statements (`wrangler d1 execute --file`).
The output differs from an ordinary dump where D1 requires it:

- no BEGIN TRANSACTION or COMMIT, which D1 refuses;
- every statement is on one line and under D1's limit of 100,000 bytes, with
  no expression nested deeper than D1 allows;
- tables come first, in the order they were created, so a row always follows
  the row it refers to (D1 checks REFERENCES, local SQLite does not), and
  indexes come last, which loads faster.

Each database gets a file of its own. vesum.db must also get a D1 database of
its own: see "VESUM form lookup" in data/README.md.

"Publishing to D1" in data/README.md has the commands that use the output.
"""
import re
import sqlite3
import sys

# D1 refuses a statement over 100,000 bytes. Rows are grouped into INSERTs of
# about half that, which keeps the file small and the load quick.
STATEMENT_LIMIT = 100_000
BATCH_BYTES = 50_000


def one_line(sql):
    """A CREATE statement without its comments, on one line.

    The schemas explain their columns in comments (`-- with stress: кали́на`).
    D1 has no use for them, and a comment that held a semicolon could be taken
    for the end of the statement.
    """
    lines = [re.sub(r"--.*", "", line).strip() for line in sql.splitlines()]
    if any("'" in line or '"' in line for line in lines):
        # A quoted string could itself contain "--", and then the line above
        # cut it in half. No schema here has quotes outside its comments, so
        # stop rather than guess where a comment starts.
        sys.exit(f"Cannot simplify a CREATE statement that has quotes outside its comments: {sql!r}")
    return " ".join(line for line in lines if line)


# Stand-ins for a line feed and a carriage return inside a value, see row_values().
LF, CR = "~LF~", "~CR~"


def row_values(db, table, columns):
    """Each row of `table` as the text between the brackets of VALUES (...)."""
    # quote() writes any value as SQL: NULL, 42, 'it''s', X'0A'.
    #
    # A value with line breaks (an etymology of several lines) would spread its
    # statement over several lines. It is written with stand-ins instead, and
    # with the replace() calls that put the line breaks back when it is run:
    #     replace(replace('From не́бо~LF~+ край','~LF~',char(10)),'~CR~',char(13))
    # Not as 'From не́бо'||char(10)||'+ край': D1 refuses an expression nested
    # more than 100 deep, and one etymology has 74 line breaks.
    def has(column, text):
        return f"instr(\"{column}\", {text})"

    clash = " OR ".join(
        f"(({has(c, 'char(10)')} OR {has(c, 'char(13)')}) AND ({has(c, repr(LF))} OR {has(c, repr(CR))}))"
        for c in columns)
    if db.execute(f'SELECT count(*) FROM "{table}" WHERE {clash}').fetchone()[0]:
        sys.exit(f"A value in {table} contains {LF} or {CR} itself; choose other stand-ins in export_sql.py.")

    quoted = " || ',' || ".join(
        f"CASE WHEN {has(c, 'char(10)')} OR {has(c, 'char(13)')}"
        f" THEN 'replace(replace('"
        f" || replace(replace(quote(\"{c}\"), char(10), '{LF}'), char(13), '{CR}')"
        f" || ',''{LF}'',char(10)),''{CR}'',char(13))'"
        f" ELSE quote(\"{c}\") END"
        for c in columns)
    for (values,) in db.execute(f'SELECT {quoted} FROM "{table}"'):
        yield values


def export(source, target):
    db = sqlite3.connect(f"file:{source}?mode=ro", uri=True)

    broken = db.execute("PRAGMA foreign_key_check").fetchmany(5)
    if broken:
        sys.exit(f"{source} has rows that refer to rows that do not exist; D1 would refuse them: {broken}")

    schema = db.execute(
        "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid"
    ).fetchall()
    other = [kind for kind, _, _ in schema if kind not in ("table", "index")]
    if other:
        sys.exit(f"{source} has a {other[0]}; this script only knows tables and indexes.")

    statements = rows = longest = 0

    with open(target, "w", encoding="utf-8", newline="\n") as out:
        def write(statement):
            nonlocal statements, longest
            size = len(statement.encode("utf-8"))
            if size > STATEMENT_LIMIT:
                sys.exit(f"A statement of {size:,} bytes is over D1's limit: {statement[:80]}...")
            out.write(statement + ";\n")
            statements += 1
            longest = max(longest, size)

        for kind, name, sql in schema:
            if kind != "table":
                continue
            write(one_line(sql))
            columns = [row[1] for row in db.execute(f'PRAGMA table_info("{name}")')]
            head = f'INSERT INTO "{name}" VALUES '
            batch, size, count = [], len(head), 0
            for values in row_values(db, name, columns):
                piece = len(values.encode("utf-8")) + 3  # the brackets and a comma
                if batch and size + piece > BATCH_BYTES:
                    write(head + ",".join(batch))
                    batch, size = [], len(head)
                batch.append(f"({values})")
                size += piece
                count += 1
            if batch:
                write(head + ",".join(batch))
            rows += count
            print(f"  {name}: {count:,} rows")

        for kind, name, sql in schema:
            if kind == "index":
                write(one_line(sql))

    print(f"{target}: {rows:,} rows in {statements:,} statements, longest {longest:,} bytes")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    export(sys.argv[1], sys.argv[2])
