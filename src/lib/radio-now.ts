// The song a radio station is playing right now, for the radio in the corner
// of the page (RadioPlayer.svelte) and GET /api/radio/now/<station>.
//
// A station says it in one of two places:
//
// - In the stream itself. A client that asks with the header `Icy-MetaData: 1`
//   gets, every `icy-metaint` bytes of sound, a short block of text:
//   one byte giving the block's length in 16s, then `StreamTitle='PRIANA -
//   Молода';` padded with zero bytes. The first block comes after one
//   stretch of sound (16,000 bytes on all eight stations, a second at
//   128 kbit/s), and then the connection is dropped.
// - In the list its own player shows (`playlist` in radio.ts), for the two
//   stations whose stream carries an empty title.
//
// It is asked from the server, not the browser: an <audio> element does not
// show the title, and most stations refuse a script from another site (the
// public broadcaster allows only ukr.radio).
//
// Nothing here imports from SvelteKit or Cloudflare, so `npm test` can run it.
import type { Station } from './radio.ts';

/** No station here sends a title less often than every 16,000 bytes; one that claims megabytes is not read. */
const MAX_INTERVAL = 64 * 1024;
const TIMEOUT_MS = 4_000;
/** Longer than any "artist - song"; what is over it is cut */
const MAX_TITLE = 150;
/** A playlist whose newest song began longer ago than this is showing the last song, not the current one (news, adverts) */
const STALE_SECONDS = 10 * 60;

/** The title in a block of stream text, as the station wrote it. `Don't Stop` keeps its apostrophe. */
export function parseStreamTitle(block: string): string | null {
	// The title ends at the `';` that closes the field: before the next field, or at the end of the block
	const match = /StreamTitle='([\s\S]*?)';(?:\s*Stream[A-Za-z]+=|\s*$)/.exec(block.replace(/\0+$/, ''));
	return match ? match[1] : null;
}

/**
 * Read a stream up to its first block of text and return the title in it.
 * The stream is let go of whatever happens: it has no end of its own.
 */
export async function icyTitle(response: Response): Promise<string | null> {
	const interval = Number(response.headers.get('icy-metaint'));
	if (!response.body) return null;
	const reader = response.body.getReader();
	try {
		if (!Number.isInteger(interval) || interval <= 0 || interval > MAX_INTERVAL) return null;
		// The sound, then the length byte; how long the text is shows once that byte has come
		let need = interval + 1;
		let have = 0;
		const bytes = new Uint8Array(interval + 1 + 255 * 16);
		while (have < need) {
			const { value, done } = await reader.read();
			if (done) return null;
			const part = value.subarray(0, bytes.length - have);
			bytes.set(part, have);
			have += part.length;
			if (have > interval) need = interval + 1 + bytes[interval] * 16;
		}
		// Not `fatal`: a station that sends another encoding gives odd letters, not an error
		return parseStreamTitle(new TextDecoder().decode(bytes.subarray(interval + 1, need)));
	} finally {
		await reader.cancel().catch(() => {});
	}
}

// The stations' clocks are Kyiv's. ("Europe/Kiev" is the name every runtime
// knows; "Europe/Kyiv" is newer than some of them.)
const KYIV_CLOCK = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Kiev',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23'
});

function kyivSeconds(now: Date): number {
	const part = (type: string) => Number(KYIV_CLOCK.formatToParts(now).find((p) => p.type === type)?.value ?? 0);
	return part('hour') * 3600 + part('minute') * 60 + part('second');
}

/**
 * The newest song in a station's own list (the first item), as "singer - song".
 * `[{ "stime": "18:07:03", "singer": "Антитіла", "song": "Ok", … }, …]`
 */
export function playlistTitle(list: unknown, now: Date): string | null {
	const newest: unknown = Array.isArray(list) ? list[0] : null;
	if (!newest || typeof newest !== 'object') return null;
	const { stime, singer, song } = newest as Record<string, unknown>;

	// When it began, by the station's clock; across midnight too
	const began = typeof stime === 'string' ? /^(\d\d):(\d\d):(\d\d)$/.exec(stime) : null;
	if (began) {
		const at = Number(began[1]) * 3600 + Number(began[2]) * 60 + Number(began[3]);
		if ((kyivSeconds(now) - at + 86_400) % 86_400 > STALE_SECONDS) return null;
	}

	const names = [singer, song].filter((name): name is string => typeof name === 'string' && name.trim() !== '');
	return names.length ? names.join(' - ') : null;
}

/** A name without its case and quotation marks: Радіо «Накипіло» is Радіо Накипіло. */
const bare = (name: string) => name.toLowerCase().replace(/[«»"“”„'’]/g, '').trim();

/** A title fit to show, or null: no control characters, one line, not just the station naming itself. */
export function tidyTitle(title: string | null, station: Station): string | null {
	if (!title) return null;
	let text = title
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	// Between songs a station puts itself where the artist goes: "Наше Радіо -
	// Знай наших!", "Радіо «Накипіло» - «Накипіло» з Тетяною Федорковою". The
	// player already shows the station's name, so only what follows is kept.
	const dash = text.indexOf(' - ');
	if (dash > 0 && bare(text.slice(0, dash)) === bare(station.name)) text = text.slice(dash + 3).trim();
	// Or it sends " - ", or its name alone
	if (!/[\p{L}\p{N}]/u.test(text)) return null;
	if (bare(text) === bare(station.name)) return null;
	return text.length > MAX_TITLE ? text.slice(0, MAX_TITLE - 1).trimEnd() + '…' : text;
}

/**
 * What the station is playing, or null when it does not say (speech, adverts,
 * a station that does not answer in time). Never throws.
 */
export async function nowPlaying(station: Station, fetcher: typeof fetch, now: Date = new Date()): Promise<string | null> {
	try {
		const signal = AbortSignal.timeout(TIMEOUT_MS);
		if (station.playlist) {
			const response = await fetcher(station.playlist, { signal });
			if (!response.ok) return null;
			return tidyTitle(playlistTitle(await response.json(), now), station);
		}
		const response = await fetcher(station.url, { headers: { 'Icy-MetaData': '1' }, signal });
		if (!response.ok) {
			await response.body?.cancel().catch(() => {});
			return null;
		}
		return tidyTitle(await icyTitle(response), station);
	} catch {
		return null;
	}
}
