// What the card shows now. The content script writes it, Card.svelte draws it.
import type { GlossAnswer } from '../../../src/lib/gloss.ts';
import type { SavedReply } from '../../lib/api.ts';
import type { Font, Theme } from '../../lib/settings.ts';

/** The reader's theme and font (the options page), which the card wears. */
export const look = $state({ theme: 'system' as Theme, font: 'serif' as Font });

export const card = $state({
	open: false,
	/** Goes up with every word asked about, so the card forgets what it showed for the last one. */
	asked: 0,
	/** The word as the page has it, for the search link when nothing is found. */
	text: '',
	/** Where the word stands in the window: the card goes under it, or over it at the bottom of the window. */
	left: 0,
	top: 0,
	bottom: 0,
	answer: null as GlossAnswer | null,
	failed: false,
	/** Whether the account has the word, and its lists; null until the site has said. */
	saved: null as SavedReply | null
});
