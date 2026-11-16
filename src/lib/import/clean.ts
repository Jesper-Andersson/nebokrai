// From the text of a flashcard to the Ukrainian words it names. A card's
// front is often more than one word, with HTML, sound and notes around it:
//   дзвонити, задзвонити (1)<br>[sound:дзвонити.mp3]  →  дзвонити, задзвонити
//   автомобіль = авто = машина                         →  автомобіль, авто, машина
//   п&#x27;яний                                        →  п'яний
// Pictures and sound are dropped here: an import never carries them.
import { MAX_WORD_LENGTH } from '../saved.ts';
import { isCyrillic } from '../search/normalize.ts';
import { areInitialVariants } from '../search/variants.ts';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
		if (name[0] === '#') {
			const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
			return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
		}
		return ENTITIES[name.toLowerCase()] ?? whole;
	});
}

/**
 * The text of a field without markup: sound tags, pictures and HTML removed,
 * entities decoded. A line break (<br>, <div>) stays a line break, because it
 * separates two things as a comma does.
 */
export function fieldText(html: string): string {
	return decodeEntities(
		html
			.replace(/\[sound:[^\]]*\]/gi, ' ')
			.replace(/<(br|div|p|li)\b[^>]*>/gi, '\n')
			.replace(/<[^>]*>/g, ' ')
	)
		.replace(/[ \t ]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.trim();
}

// Latin letters drawn like Cyrillic ones, which turn up inside Ukrainian words
// typed on a mixed keyboard: тваринa with a Latin "a".
const TWINS: Record<string, string> = {
	a: 'а', c: 'с', e: 'е', i: 'і', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в',
	A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х'
};

/** A Ukrainian word with any Latin look-alike letters in it made Cyrillic. Words with no Cyrillic are left alone. */
export function cyrillicTwins(word: string): string {
	if (!isCyrillic(word) || !/[a-z]/i.test(word)) return word;
	return word.replace(/[a-z]/gi, (ch) => TWINS[ch] ?? ch);
}

/** At most this many words in one piece: a phrase (будь ласка) is a word to learn, a sentence is not. */
const MAX_TOKENS = 4;

/**
 * The Ukrainian words a field names, in order and without repeats. Notes in
 * brackets and quotes are dropped. "!" and "?" end a word wherever they
 * stand, so Ого! is ого and «Ого! Ура!» is two words. Two spellings side by
 * side («умі́ти вмі́ти», «уже вже») are two words, not a phrase. Pieces with no
 * Cyrillic, or as long as a sentence, are left out.
 */
export function wordsOf(html: string): string[] {
	const words: string[] = [];
	for (const piece of fieldText(html)
		.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
		.split(/[\n,;=/|!?¡¿]+/)) {
		const word = cyrillicTwins(
			piece
				// A hyphen stays: -ся and -а are entries of their own
				.replace(/^[\s–—«»"“”„!?.…:]+|[\s–—«»"“”„!?.…:]+$/g, '')
				.replace(/\s+/g, ' ')
		);
		if (!word || !isCyrillic(word) || word.length > MAX_WORD_LENGTH) continue;
		const tokens = word.split(' ');
		if (tokens.length > MAX_TOKENS) continue;
		const named = tokens.length === 2 && areInitialVariants(tokens[0], tokens[1]) ? tokens : [word];
		for (const w of named) if (!words.includes(w)) words.push(w);
	}
	return words;
}

/** The longest a card's meaning is kept: enough for a line under the word. */
export const MEANING_MAX = 120;

/**
 * What a card says the word means: the first of `fields` written in Latin
 * letters with no Cyrillic, as plain text on one line. The English side of a
 * card ("picture", "to call, ring"), shown beside a word the dictionary could
 * not find, so the right one can be picked by hand. Empty if no field is.
 */
export function meaningOf(fields: string[]): string {
	for (const field of fields) {
		const text = fieldText(field).replace(/\s+/g, ' ').trim();
		if (/[a-z]/i.test(text) && !isCyrillic(text)) {
			return text.length > MEANING_MAX ? text.slice(0, MEANING_MAX - 1).trimEnd() + '…' : text;
		}
	}
	return '';
}

/** How Ukrainian a field looks: 1 if it names a word or two, 0 if it names none. For choosing the field to read. */
export function looksUkrainian(html: string): number {
	return wordsOf(html).length ? 1 : 0;
}
