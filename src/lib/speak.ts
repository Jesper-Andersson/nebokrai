// Saying a word aloud: the Wiktionary recording when there is one, otherwise
// the browser's own Ukrainian voice. Browser only.

/**
 * Read the word with the browser's speech voice. Does nothing where the browser has none.
 * `done` runs once the voice has finished or failed, or at once when there is no voice:
 * the radio (radio.svelte.ts) passes the end of its ducking here.
 */
export function speak(word: string, done: () => void = () => {}): void {
	if (typeof speechSynthesis === 'undefined') return done();
	const utterance = new SpeechSynthesisUtterance(word);
	utterance.lang = 'uk-UA';
	utterance.onend = utterance.onerror = () => done();
	speechSynthesis.speak(utterance);
}

/**
 * Play the recording; if it cannot be loaded or played (a dead link, a blocked
 * file), read the word instead. `done` runs once, when whichever of the two
 * sounded has finished.
 */
export function play(word: string, audioUrl: string | null | undefined, done: () => void = () => {}): void {
	if (!audioUrl) return speak(word, done);
	// A failed file both fires `error` and rejects play(): fall back only once.
	let fellBack = false;
	const fallBack = () => {
		if (fellBack) return;
		fellBack = true;
		speak(word, done);
	};
	const audio = new Audio(audioUrl);
	audio.addEventListener('ended', () => done());
	audio.addEventListener('error', fallBack);
	audio.play().catch(fallBack);
}
