// Sending saved words to Anki through AnkiConnect, against a stand-in that
// keeps notes in memory. Needs no database, no Anki and no browser.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	AnkiError, DECK, DEFAULT_SETTINGS, NOTE_TYPE, ankiChoices, defaultFields, fieldsProblem, parseTags, readSettings,
	sendToAnki, type AnkiSettings, type Invoke
} from '../src/lib/anki-connect.ts';
import type { WordCard } from '../src/lib/search/word.ts';

const kalyna: WordCard = {
	word: 'калина', headword: 'кали́на', pos: 'noun', tags: ['feminine', 'inanimate'], ipa: '[kɐˈɫɪnɐ]', audio_url: null,
	glosses: ['viburnum, guelder rose'],
	example: { uk: 'Калина цвіте.', en: 'The viburnum is in bloom.', tatoeba_id: 123 }
};
const kyiv: WordCard = {
	word: 'Київ', headword: '"Ки́їв"', pos: 'name', tags: [], ipa: null, audio_url: null,
	glosses: ['a <b>city</b> & "capital"', 'Kyiv'], example: null
};
const posName = (pos: string) => pos.toUpperCase();

type Note = { noteId: number; deckName: string; modelName: string; fields: Record<string, string>; tags: string[] };

/** As much of AnkiConnect as `sendToAnki` uses. `calls` lists the actions it was asked for. */
function fakeAnki(permission: Record<string, unknown> = { permission: 'granted', requireApiKey: false, version: 6 }) {
	const notes: Note[] = [];
	const noteTypes = ['Basic'];
	const fieldsOf: Record<string, string[]> = { Basic: ['Front', 'Back'] };
	const decks = ['Default'];
	const calls: string[] = [];
	const invoke: Invoke = async (action, params = {}) => {
		calls.push(action);
		const p = params as any;
		switch (action) {
			case 'requestPermission': return permission;
			case 'modelNames': return [...noteTypes];
			case 'createModel':
				assert.deepEqual(p.inOrderFields, ['Word', 'Meaning', 'Details']);
				noteTypes.push(p.modelName);
				fieldsOf[p.modelName] = p.inOrderFields;
				return {};
			case 'createDeck':
				if (!decks.includes(p.deck)) decks.push(p.deck);
				return 1;
			case 'deckNames': return [...decks];
			case 'modelFieldNames': return fieldsOf[p.modelName];
			case 'findNotes': {
				// "note:Name", and for a note type that is not ours, the tag as well
				const [, name, tag] = /^"note:([^"]+)"(?: "tag:([^"]+)")?$/.exec(p.query)!;
				assert.equal(tag === undefined, name === NOTE_TYPE);
				return notes
					.filter((n) => n.modelName === name.replace(/\\/g, '') && (!tag || n.tags.includes(tag.replace(/\\/g, ''))))
					.map((n) => n.noteId);
			}
			case 'notesInfo':
				return notes.filter((n) => p.notes.includes(n.noteId)).map((n) => ({
					noteId: n.noteId,
					// Anki hands a field back in its own spelling: a bare quote for &quot;
					fields: Object.fromEntries(
						Object.entries(n.fields).map(([name, value], order) => [name, { value: value.replace(/&quot;/g, '"'), order }])
					)
				}));
			case 'addNotes':
				return p.notes.map((n: Omit<Note, 'noteId'>) => {
					assert.ok(noteTypes.includes(n.modelName) && decks.includes(n.deckName));
					notes.push({ ...n, noteId: 1000 + notes.length });
					return notes.at(-1)!.noteId;
				});
			case 'multi':
				return p.actions.map((a: any) => {
					assert.equal(a.action, 'updateNoteFields');
					const note = notes.find((n) => n.noteId === a.params.note.id);
					if (!note) return { result: null, error: 'note not found' };
					Object.assign(note.fields, a.params.note.fields);
					return { result: null, error: null };
				});
		}
		throw new AnkiError('failed', 'unsupported action');
	};
	return { invoke, notes, noteTypes, decks, calls, fieldsOf };
}

test('the first send makes the note type, the deck and the notes', async () => {
	const anki = fakeAnki();
	assert.deepEqual(await sendToAnki([kalyna, kyiv], posName, anki.invoke), { added: 2, updated: 0, unchanged: 0 });
	assert.ok(anki.noteTypes.includes(NOTE_TYPE));
	assert.ok(anki.decks.includes(DECK));
	assert.deepEqual(anki.notes[0], {
		noteId: 1000, deckName: 'Nebokrai', modelName: 'Nebokrai',
		fields: {
			Word: 'кали́на',
			Meaning: 'viburnum, guelder rose',
			Details:
				'<div>NOUN · feminine, inanimate</div><div>[kɐˈɫɪnɐ]</div>' +
				'<div><i lang="uk">Калина цвіте.</i><br>The viburnum is in bloom.</div>' +
				'<div><a href="https://nebokrai.app/word/kalyna">Nebokrai</a></div>'
		},
		tags: ['nebokrai', 'noun'],
		options: { allowDuplicate: true }
	});
	assert.equal(anki.notes[1].fields.Word, '&quot;Ки́їв&quot;');
});

test('a second send doubles nothing and updates only what changed', async () => {
	const anki = fakeAnki();
	await sendToAnki([kalyna, kyiv], posName, anki.invoke);
	anki.calls.length = 0;

	// The same words: nothing to write, though Anki spells Київ's fields differently
	assert.deepEqual(await sendToAnki([kalyna, kyiv], posName, anki.invoke), { added: 0, updated: 0, unchanged: 2 });
	assert.deepEqual(anki.calls, ['requestPermission', 'modelNames', 'createDeck', 'findNotes', 'notesInfo']);

	// The dictionary has a new meaning for one, and there is one new word
	const better = { ...kalyna, glosses: ['viburnum', 'guelder rose'] };
	const kit: WordCard = { word: 'кіт', headword: 'кіт', pos: 'noun', tags: [], ipa: null, audio_url: null, glosses: ['cat'], example: null };
	assert.deepEqual(await sendToAnki([kit, better, kyiv], posName, anki.invoke), { added: 1, updated: 1, unchanged: 1 });
	assert.equal(anki.notes.length, 3);
	assert.equal(anki.notes[0].noteId, 1000); // the same note, so its review history stays
	assert.equal(anki.notes[0].fields.Meaning, '<ol><li>viburnum</li><li>guelder rose</li></ol>');
});

test('two saved words written alike make one note', async () => {
	const anki = fakeAnki();
	const twin = { ...kalyna, word: 'Калина', glosses: ['a surname'] };
	assert.deepEqual(await sendToAnki([kalyna, twin], posName, anki.invoke), { added: 1, updated: 0, unchanged: 0 });
	assert.equal(anki.notes[0].fields.Meaning, 'viburnum, guelder rose');
});

test('refusals stop before anything is written', async () => {
	const reason = (error: unknown) => error instanceof AnkiError && error.reason;

	const denied = fakeAnki({ permission: 'denied' });
	await assert.rejects(sendToAnki([kalyna], posName, denied.invoke), (e) => reason(e) === 'denied');
	assert.deepEqual(denied.calls, ['requestPermission']);

	const keyed = fakeAnki({ permission: 'granted', requireApiKey: true, version: 6 });
	await assert.rejects(sendToAnki([kalyna], posName, keyed.invoke), (e) => reason(e) === 'key');
	assert.deepEqual(keyed.calls, ['requestPermission']);

	// Anki closed: the first call already fails, and the reason passes through
	const closed: Invoke = async () => { throw new AnkiError('unreachable'); };
	await assert.rejects(sendToAnki([kalyna], posName, closed), (e) => reason(e) === 'unreachable');
});

test('an update Anki refuses is reported, with its words', async () => {
	const anki = fakeAnki();
	await sendToAnki([kalyna], posName, anki.invoke);
	const invoke: Invoke = async (action, params) =>
		action === 'multi' ? [{ result: null, error: 'collection is not available' }] : anki.invoke(action, params);
	await assert.rejects(
		sendToAnki([{ ...kalyna, glosses: ['viburnum'] }], posName, invoke),
		(e) => e instanceof AnkiError && e.reason === 'failed' && e.message === 'collection is not available'
	);
});

const basic: AnkiSettings = {
	deck: 'Languages::Ukrainian', noteType: 'Basic', fields: { Front: 'word', Back: 'both' }, tags: ['from_nebokrai', '2026'], update: true
};

test('a deck and a note type of the visitor’s own', async () => {
	const anki = fakeAnki();
	// Their own card for the same word, written by hand: never touched
	anki.notes.push({ noteId: 1, deckName: 'Default', modelName: 'Basic', fields: { Front: 'кали́на', Back: 'mine' }, tags: [] });

	assert.deepEqual(await sendToAnki([kalyna], posName, anki.invoke, basic), { added: 1, updated: 0, unchanged: 0 });
	assert.ok(anki.decks.includes('Languages::Ukrainian'));
	assert.ok(!anki.noteTypes.includes(NOTE_TYPE)); // ours is not made when it is not used
	const sent = anki.notes[1];
	assert.equal(sent.deckName, 'Languages::Ukrainian');
	assert.equal(sent.modelName, 'Basic');
	assert.equal(sent.fields.Front, 'кали́на');
	assert.ok(sent.fields.Back.startsWith('<div>viburnum, guelder rose</div><div>NOUN · feminine, inanimate</div>'));
	assert.deepEqual(sent.tags, ['from_nebokrai', '2026', 'noun']); // the first is how it is found again

	// Again, with a new meaning: the sent note is updated, the hand-written one is as it was
	const better = { ...kalyna, glosses: ['viburnum'] };
	assert.deepEqual(await sendToAnki([better], posName, anki.invoke, basic), { added: 0, updated: 1, unchanged: 0 });
	assert.equal(anki.notes.length, 2);
	assert.equal(anki.notes[0].fields.Back, 'mine');
	assert.ok(anki.notes[1].fields.Back.startsWith('<div>viburnum</div>'));
});

test('with updating off, notes in Anki stay as they are', async () => {
	const anki = fakeAnki();
	await sendToAnki([kalyna], posName, anki.invoke);
	const kept = { ...DEFAULT_SETTINGS, update: false };
	const result = await sendToAnki([{ ...kalyna, glosses: ['viburnum'] }, kyiv], posName, anki.invoke, kept);
	assert.deepEqual(result, { added: 1, updated: 0, unchanged: 1 });
	assert.equal(anki.notes[0].fields.Meaning, 'viburnum, guelder rose');
});

test('settings that no longer fit Anki stop the send', async () => {
	const setup = (error: unknown) => error instanceof AnkiError && error.reason === 'setup';
	const anki = fakeAnki();
	// The note type was removed
	await assert.rejects(sendToAnki([kalyna], posName, anki.invoke, { ...basic, noteType: 'Gone' }), setup);
	// Its field was renamed, so nothing holds the word any more
	anki.fieldsOf.Basic = ['Question', 'Back'];
	await assert.rejects(sendToAnki([kalyna], posName, anki.invoke, basic), setup);
	assert.equal(anki.notes.length, 0);
	assert.ok(!anki.decks.includes(basic.deck)); // not even the deck was made
});

test('choices for the settings', async () => {
	const anki = fakeAnki();
	await sendToAnki([kalyna], posName, anki.invoke);
	// Our own note type is offered by the form itself, not listed with the visitor's
	assert.deepEqual(await ankiChoices(anki.invoke), { decks: ['Default', 'Nebokrai'], noteTypes: ['Basic'] });

	assert.deepEqual(defaultFields(['Front', 'Back']), { Front: 'word', Back: 'both' });
	assert.deepEqual(defaultFields(['A', 'B', 'C', 'D']), { A: 'word', B: 'meaning', C: 'details' });
	assert.equal(fieldsProblem(['Front', 'Back'], { Front: 'word', Back: 'both' }), null);
	assert.equal(fieldsProblem(['Front', 'Back'], { Back: 'word' }), 'first');
	assert.equal(fieldsProblem(['Front', 'Back'], { Front: 'meaning' }), 'word');
	assert.equal(fieldsProblem(['Front', 'Back'], { Front: 'word', Back: 'word' }), 'word');
});

test('settings out of storage are read defensively', () => {
	assert.deepEqual(readSettings(null), DEFAULT_SETTINGS);
	assert.deepEqual(readSettings('x'), DEFAULT_SETTINGS);
	assert.deepEqual(readSettings({ deck: '  ', noteType: 7, fields: { Front: 'word', Back: 'script' }, tags: 'a', update: 0 }), {
		deck: DECK, noteType: NOTE_TYPE, fields: { Front: 'word' }, tags: ['nebokrai'], update: true // never without a tag
	});
	assert.deepEqual(readSettings(JSON.parse(JSON.stringify(basic))), basic);
	assert.deepEqual(parseTags(' verbs, 2026  verbs '), ['verbs', '2026']);
});
