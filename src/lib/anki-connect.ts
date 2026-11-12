// Sends saved words straight into Anki on the visitor's own computer, through
// the AnkiConnect add-on (ankiweb.net/shared/info/2055492159), which answers
// JSON requests on 127.0.0.1:8765 while Anki is open. Nothing passes through
// this site's server: the browser talks to Anki directly.
//
// `sendToAnki` takes the function that reaches AnkiConnect as an argument, so
// `npm test` runs it against a stand-in with no Anki and no browser.

import { ankiFields } from './export.ts';
import type { WordCard } from './search/word.ts';

export const ANKI_CONNECT = 'http://127.0.0.1:8765';
/** Where the add-on is installed from. */
export const ANKI_CONNECT_PAGE = 'https://ankiweb.net/shared/info/2055492159';

/** The deck and the note type a send uses until the visitor chooses others; made on the first send. */
export const DECK = 'Nebokrai';
export const NOTE_TYPE = 'Nebokrai';
const FIELDS = ['Word', 'Meaning', 'Details'] as const;
/** The tag notes carry unless the visitor chooses others (and the one the text file gives them). */
const TAG = 'nebokrai';

/** What a field of a note can be given: one of the three parts of a card, or the last two together. */
export type AnkiValue = 'word' | 'meaning' | 'details' | 'both';
export const ANKI_VALUES: AnkiValue[] = ['word', 'meaning', 'details', 'both'];

/** The visitor's choices (the Saved page keeps them in this browser). */
export interface AnkiSettings {
	deck: string;
	/** `NOTE_TYPE` for the one made here, or the name of one of the visitor's own. */
	noteType: string;
	/** For a note type of the visitor's own: what goes in which field. A field not named stays empty. */
	fields: Record<string, AnkiValue>;
	/**
	 * The tags new notes get, before the part of speech. Never empty: the
	 * first is how the notes are found again in a note type that is not ours.
	 */
	tags: string[];
	/** Whether a note already in Anki is rewritten when the dictionary's text has changed. */
	update: boolean;
}

export const DEFAULT_SETTINGS: AnkiSettings = { deck: DECK, noteType: NOTE_TYPE, fields: {}, tags: [TAG], update: true };

const OWN_FIELDS: Record<string, AnkiValue> = { Word: 'word', Meaning: 'meaning', Details: 'details' };

/** A tag ends at a space; a comma is how people separate them when typing. */
export const parseTags = (text: string) => [...new Set(text.split(/[\s,]+/).filter(Boolean))].slice(0, 20);

/** Settings as they come out of storage, where anything may have been put: every part checked, or its default. */
export function readSettings(raw: unknown): AnkiSettings {
	const from = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const name = (value: unknown, fallback: string) =>
		typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback;
	const fields: Record<string, AnkiValue> = {};
	if (from.fields && typeof from.fields === 'object') {
		for (const [field, value] of Object.entries(from.fields).slice(0, 50)) {
			if (ANKI_VALUES.includes(value as AnkiValue)) fields[field] = value as AnkiValue;
		}
	}
	const tags = Array.isArray(from.tags) ? parseTags(from.tags.filter((t) => typeof t === 'string').join(' ')) : [];
	return {
		deck: name(from.deck, DECK),
		noteType: name(from.noteType, NOTE_TYPE),
		fields,
		tags: tags.length ? tags : [TAG],
		update: from.update !== false
	};
}

/**
 * A first guess for a note type of the visitor's own: the word in the first
 * field, and the rest after it. Two fields (Anki's Basic) get the meaning and
 * the details together on the back.
 */
export function defaultFields(names: string[]): Record<string, AnkiValue> {
	const [first, second, third] = names;
	if (!first) return {};
	if (!second) return { [first]: 'word' };
	if (!third) return { [first]: 'word', [second]: 'both' };
	return { [first]: 'word', [second]: 'meaning', [third]: 'details' };
}

/**
 * What is wrong with a choice of fields for a note type with these field
 * names, if anything. Exactly one field holds the word, since that is how a
 * note is found again; and Anki refuses a note whose first field is empty.
 */
export function fieldsProblem(names: string[], fields: Record<string, AnkiValue>): 'word' | 'first' | null {
	if (names.filter((name) => fields[name] === 'word').length !== 1) return 'word';
	if (!fields[names[0]]) return 'first';
	return null;
}

// No colours: Anki's own, so the card is right in its day and night modes.
const CSS = `.card { font-family: arial; font-size: 22px; text-align: center; }
.word { font-size: 1.6em; }
.meaning ol { display: inline-block; margin: 0; text-align: left; }
.details { margin-top: 1em; font-size: 0.75em; opacity: 0.75; }
`;

/**
 * Why a send did not happen:
 * - `unreachable`: nothing answered (Anki is closed, the add-on is missing, or the browser blocked the request)
 * - `denied`: the visitor said no when Anki asked whether this site may connect
 * - `key`: AnkiConnect is set to want an API key, which this site does not ask for
 * - `setup`: the chosen note type is gone from Anki, or its fields no longer fit the choices
 * - `failed`: Anki answered with an error; `message` is Anki's own text
 */
export type AnkiFailure = 'unreachable' | 'denied' | 'key' | 'setup' | 'failed';

export class AnkiError extends Error {
	reason: AnkiFailure;

	constructor(reason: AnkiFailure, detail = '') {
		super(detail || reason);
		this.reason = reason;
	}
}

/** Calls one AnkiConnect action and gives its result, or throws an `AnkiError`. */
export type Invoke = (action: string, params?: Record<string, unknown>) => Promise<unknown>;

/**
 * The real thing. No content-type header on purpose: a JSON one makes the
 * browser ask AnkiConnect's leave first (a preflight), and AnkiConnect reads
 * the body as JSON whatever it is called.
 */
export const browserInvoke: Invoke = async (action, params = {}) => {
	let answer: { result: unknown; error: string | null };
	try {
		const res = await fetch(ANKI_CONNECT, {
			method: 'POST',
			body: JSON.stringify({ action, version: 6, params }),
			// Anki has no use for where the visitor is on this site
			referrerPolicy: 'no-referrer',
			credentials: 'omit'
		});
		answer = await res.json();
	} catch {
		throw new AnkiError('unreachable');
	}
	if (answer.error) throw new AnkiError('failed', String(answer.error));
	return answer.result;
};

export interface SendResult {
	added: number;
	updated: number;
	/** Already in Anki, and left as they were. */
	unchanged: number;
}

/**
 * Anki may hand a field back written differently from how it was sent (`"`
 * for `&quot;`, composed letters). Compared in one spelling, so that a note is
 * only called changed when its text is.
 */
const canon = (html: string) =>
	html.normalize('NFC').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

/** AnkiConnect takes one note per update; `multi` carries this many in one request. */
const UPDATE_BATCH = 100;

/** Asks leave to connect; the first time, Anki asks the visitor. Every conversation starts here. */
async function connect(invoke: Invoke): Promise<void> {
	const permission = (await invoke('requestPermission')) as { permission: string; requireApiKey?: boolean };
	if (permission.permission !== 'granted') throw new AnkiError('denied');
	if (permission.requireApiKey) throw new AnkiError('key');
}

/** The decks and note types Anki has, for the settings to choose from. */
export async function ankiChoices(invoke: Invoke): Promise<{ decks: string[]; noteTypes: string[] }> {
	await connect(invoke);
	const decks = (await invoke('deckNames')) as string[];
	const noteTypes = (await invoke('modelNames')) as string[];
	return { decks: [...decks].sort(), noteTypes: noteTypes.filter((name) => name !== NOTE_TYPE).sort() };
}

/** The fields of one note type, in Anki's order. */
export const ankiFieldNames = async (invoke: Invoke, noteType: string) =>
	(await invoke('modelFieldNames', { modelName: noteType })) as string[];

/**
 * Puts the cards in the chosen deck as notes of the chosen note type. With
 * the settings left alone that is the Nebokrai deck and the Nebokrai note
 * type, both made here if they are not there. A word that is already in Anki
 * is updated when its text has changed (unless the settings say not to) and
 * left alone when not, so sending the same list twice doubles nothing and
 * loses no review history.
 *
 * In a note type of the visitor's own, only notes with the first of the
 * chosen tags count as already there: a card they wrote themselves for the
 * same word is never rewritten.
 *
 * AnkiConnect cannot set a note's id, so these notes do not match the ones a
 * text-file import made: someone who uses both ways gets each word twice.
 */
export async function sendToAnki(
	cards: WordCard[], posName: (pos: string) => string, invoke: Invoke, settings: AnkiSettings = DEFAULT_SETTINGS
): Promise<SendResult> {
	await connect(invoke);

	const { deck, noteType } = settings;
	const own = noteType === NOTE_TYPE;
	const noteTypes = (await invoke('modelNames')) as string[];
	let mapping = OWN_FIELDS;
	if (own && !noteTypes.includes(NOTE_TYPE)) {
		await invoke('createModel', {
			modelName: NOTE_TYPE,
			inOrderFields: [...FIELDS],
			css: CSS,
			cardTemplates: [{
				Name: 'Word → meaning',
				Front: '<div class="word" lang="uk">{{Word}}</div>',
				Back: '{{FrontSide}}<hr id="answer"><div class="meaning">{{Meaning}}</div><div class="details">{{Details}}</div>'
			}]
		});
	} else if (!own) {
		// The visitor may have renamed or removed things in Anki since choosing
		if (!noteTypes.includes(noteType)) throw new AnkiError('setup');
		const names = await ankiFieldNames(invoke, noteType);
		mapping = Object.fromEntries(names.flatMap((name) => (settings.fields[name] ? [[name, settings.fields[name]]] : [])));
		if (fieldsProblem(names, mapping)) throw new AnkiError('setup');
	}
	const wordField = Object.keys(mapping).find((name) => mapping[name] === 'word')!;
	// Gives the deck that is there if there is one
	await invoke('createDeck', { deck });

	// The notes sent before, by their word, wherever the visitor has moved them
	// In a search, * and _ stand for any text and any letter unless escaped
	const quoted = (text: string) => text.replace(/["*_]/g, '\\$&');
	const marker = settings.tags[0] ?? TAG;
	const query = `"note:${quoted(noteType)}"` + (own ? '' : ` "tag:${quoted(marker)}"`);
	const ids = (await invoke('findNotes', { query })) as number[];
	const infos = (ids.length ? await invoke('notesInfo', { notes: ids }) : []) as {
		noteId: number;
		fields: Record<string, { value: string } | undefined>;
	}[];
	const inAnki = new Map(infos.map((info) => [canon(info.fields[wordField]?.value ?? ''), info] as const));

	const fresh: Record<string, unknown>[] = [];
	const changed: Record<string, unknown>[] = [];
	let unchanged = 0;
	const seen = new Set<string>();
	for (const card of cards) {
		const { word, meaning, details, tags } = ankiFields(card, posName);
		// Two saved words written alike would be one note to Anki: the first stands
		if (seen.has(canon(word))) continue;
		seen.add(canon(word));
		const values: Record<AnkiValue, string> = { word, meaning, details, both: `<div>${meaning}</div>${details}` };
		const fields = Object.fromEntries(Object.entries(mapping).map(([name, value]) => [name, values[value]]));
		const note = inAnki.get(canon(word));
		if (!note) {
			// Duplicates were looked for just above; Anki's own check would refuse the whole batch for one
			fresh.push({
				deckName: deck, modelName: noteType, fields,
				// The visitor's tags, then the part of speech
				tags: [...new Set([...settings.tags, ...tags.filter((tag) => tag !== TAG)])],
				options: { allowDuplicate: true }
			});
			continue;
		}
		// The word's field is the same already. The note stays in its deck, and the visitor's own tags stay.
		const stale = Object.entries(fields).filter(
			([name, value]) => name !== wordField && canon(note.fields[name]?.value ?? '') !== canon(value)
		);
		if (settings.update && stale.length) {
			changed.push({
				action: 'updateNoteFields',
				version: 6,
				params: { note: { id: note.noteId, fields: Object.fromEntries(stale) } }
			});
		} else unchanged++;
	}

	let added = 0;
	if (fresh.length) {
		const made = (await invoke('addNotes', { notes: fresh })) as (number | null)[];
		added = made.filter((id) => id !== null).length;
		if (added < fresh.length) throw new AnkiError('failed', `${fresh.length - added} of ${fresh.length} notes were not added`);
	}
	for (let i = 0; i < changed.length; i += UPDATE_BATCH) {
		const answers = (await invoke('multi', { actions: changed.slice(i, i + UPDATE_BATCH) })) as unknown[];
		for (const answer of answers) {
			const error = answer && typeof answer === 'object' && 'error' in answer ? answer.error : null;
			if (error) throw new AnkiError('failed', String(error));
		}
	}
	return { added, updated: changed.length, unchanged };
}
