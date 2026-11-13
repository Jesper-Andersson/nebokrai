// Recordings come from Wikimedia Commons, each with an author and a licence of
// its own, which its page there shows. No imports: `npm test` could run this file.

/**
 * The Commons page of a recording, from the address it is played from. That
 * address is an mp3 transcoded from the file; the file's own page is named
 * after the original, the second-to-last part of a transcoded address.
 */
export function commonsPage(audioUrl: string): string {
	const parts = audioUrl.split('/');
	const file = parts.includes('transcoded') ? parts.at(-2) : parts.at(-1);
	return `https://commons.wikimedia.org/wiki/File:${file}`;
}
