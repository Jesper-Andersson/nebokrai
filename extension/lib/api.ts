// The messages between a page and the background script, and where the site is.
import type { GlossAnswer } from '../../src/lib/gloss.ts';

/** `WXT_API_BASE=http://localhost:5173` in `.env.local` asks a dev server instead. */
export const SITE: string = import.meta.env.WXT_API_BASE || 'https://nebokrai.app';

export interface GlossRequest {
	type: 'gloss';
	/** As `plain()` writes them: no stress mark, lower case. */
	w: string;
	before?: string;
	after?: string;
}

export type GlossReply = { ok: true; answer: GlossAnswer } | { ok: false };

/** What the account has saved, as far as a card needs it. */
export interface SavedRequest {
	type: 'saved';
	/** The word the card is about: книга */
	word: string;
}

export interface ListChoice {
	id: string;
	name: string;
	/** Whether the word is in this list. */
	has: boolean;
}

export type SavedReply =
	| { ok: true; signedIn: true; saved: boolean; lists: ListChoice[] }
	| { ok: true; signedIn: false }
	| { ok: false };

/** Save a word, with the lists to put it in, or remove it (and take it out of every list). */
export interface SaveRequest {
	type: 'save' | 'unsave';
	word: string;
	lists?: string[];
}

/** `full`: 5,000 words are saved already. */
export type SaveReply = { ok: true } | { ok: false; why: 'signed_out' | 'full' | 'failed' };

export type Request = GlossRequest | SavedRequest | SaveRequest;
