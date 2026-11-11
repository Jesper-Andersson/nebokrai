// Addresses inside the draft redesign. Everything under /draft is a second
// copy of a page, so links between draft pages must keep the prefix.
import { wordPath } from '#lib/search/slug.ts';

export const DRAFT = '/draft';

/** The draft details page of a word: /draft/word/knyha */
export function draftWordPath(word: string): string {
	return DRAFT + wordPath(word);
}
