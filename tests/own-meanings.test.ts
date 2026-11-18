// data/own-meanings.tsv holds Nebokrai's own English for words Wiktionary has
// no page for. add_own_meanings() in data/import_wiktionary.py turns its rows
// into entries; these tests run it through Python on an in-memory database.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

// Builds the schema, gives калина a Wiktionary entry, runs add_own_meanings
// on `tsv` and prints what is in the database afterwards.
function run(tsv: string) {
	const script = `
import json, sqlite3, sys
sys.stdout.reconfigure(encoding="utf-8")
import import_wiktionary as iw
db = sqlite3.connect(":memory:")
db.executescript(iw.SCHEMA)
eid = db.execute("INSERT INTO entries(word, headword, pos, tags, head_forms, source)"
                 " VALUES ('калина','кали́на','noun','[]','[]','wiktionary')").lastrowid
db.execute("INSERT INTO search_keys VALUES ('калина', ?, 'word')", (eid,))
added, senses = iw.add_own_meanings(db, sys.argv[1])
entries = [dict(word=w, headword=h, pos=p, tags=json.loads(t), source=s,
                senses=[g for (g,) in db.execute("SELECT gloss FROM senses WHERE entry_id=? ORDER BY n", (i,))],
                keys=sorted(k for (k,) in db.execute("SELECT key FROM search_keys WHERE entry_id=? AND kind='english'", (i,))))
           for i, w, h, p, t, s in db.execute("SELECT id, word, headword, pos, tags, source FROM entries ORDER BY id")]
print(json.dumps(dict(added=added, senses=senses, entries=entries), ensure_ascii=False))
`;
	const folder = mkdtempSync(join(tmpdir(), 'own-meanings-'));
	try {
		const file = join(folder, 'own.tsv');
		writeFileSync(file, tsv);
		// The error thrown on a failure carries Python's message
		const out = execFileSync(PYTHON, ['-c', script, file], { cwd: 'data', encoding: 'utf8', stdio: 'pipe' });
		return JSON.parse(out);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

test('a word Wiktionary has is skipped, one it lacks gets an entry of ours', () => {
	const result = run(
		'# a comment\n' +
			'калина\tкали́на\tnoun\tguelder rose\t\n' +
			'облишити\tобли́шити\tverb\tto leave (alone), to stop; to give up\tperfective\n'
	);
	assert.equal(result.added, 1);
	assert.equal(result.senses, 2);
	const [kalyna, ours] = result.entries;
	assert.equal(kalyna.source, 'wiktionary');
	assert.deepEqual(kalyna.senses, []);
	assert.equal(ours.word, 'облишити');
	assert.equal(ours.headword, 'обли́шити');
	assert.equal(ours.source, 'nebokrai');
	assert.deepEqual(ours.tags, ['perfective']);
	assert.deepEqual(ours.senses, ['to leave (alone), to stop', 'to give up']);
	// What stands in brackets is not a meaning of its own
	assert.ok(ours.keys.includes('stop') && ours.keys.includes('give'));
	assert.ok(!ours.keys.includes('alone'));
});

test('a headword that is not the word with stress marks is refused', () => {
	assert.throws(() => run('облишити\tзали́шити\tverb\tto leave\t\n'), /headword/);
});

test('every row of own-meanings.tsv is read and becomes an entry', () => {
	const tsv = readFileSync('data/own-meanings.tsv', 'utf8');
	const rows = tsv.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
	const result = run(tsv);
	assert.equal(result.added, rows.length);
});
