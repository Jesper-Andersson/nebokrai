// What the alphabet trainer (/alphabet) remembers, in the browser: which box
// each letter is in, and the learner's choices for the drill. The rules are in
// src/lib/alphabet/drill.ts; this file only keeps their results.
//
// Kept in this browser's localStorage and nowhere else. An account holds the
// flashcards (review.svelte.ts) because a schedule of months is worth carrying
// from one device to another; the alphabet is learnt in a few sittings.
//
// Made by the page that uses it, not shared through context: nothing else
// reads it. (Never a module variable: on the server one module serves every
// visitor.)
import { DEFAULT_OPTIONS, parseOptions, parseProgress, type Options, type Progress } from './alphabet/drill.ts';

/** By letter: `{ "ж": { "box": 2, "seen": 5, "right": 4 } }`. */
const PROGRESS_KEY = 'alphabet';
const OPTIONS_KEY = 'alphabet-options';

function read(key: string): unknown {
	try {
		return JSON.parse(localStorage.getItem(key) ?? 'null');
	} catch {
		return null; // storage blocked, or not JSON
	}
}

function store(key: string, value: unknown): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage blocked or full: the trainer still works until the page is closed.
	}
}

export class Alphabet {
	/** Replaced, never changed in place. */
	progress = $state.raw<Progress>({});
	options = $state.raw<Options>(DEFAULT_OPTIONS);
	/** False until the browser's copy has been read. */
	ready = $state(false);

	/** Browser only: read what this browser holds. A second call does nothing. */
	load(): void {
		if (this.ready) return;
		this.progress = parseProgress(read(PROGRESS_KEY));
		this.options = parseOptions(read(OPTIONS_KEY));
		// Another tab practised, or changed the choices.
		addEventListener('storage', (event) => {
			if (event.key === PROGRESS_KEY) this.progress = parseProgress(read(PROGRESS_KEY));
			if (event.key === OPTIONS_KEY) this.options = parseOptions(read(OPTIONS_KEY));
		});
		this.ready = true;
	}

	/** The progress after an answer (drill.ts `grade`). */
	remember(progress: Progress): void {
		if (progress === this.progress) return;
		this.progress = progress;
		store(PROGRESS_KEY, progress);
	}

	change(part: Partial<Options>): void {
		// Through the same reading as storage, so nothing that cannot be is ever kept
		this.options = parseOptions({ ...this.options, ...part });
		store(OPTIONS_KEY, this.options);
	}

	/** Forget every letter, as if the page had never been opened. The choices stay. */
	forget(): void {
		this.progress = {};
		store(PROGRESS_KEY, null);
	}
}
