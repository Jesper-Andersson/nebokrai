// Short messages in the corner of the page ("Saved", with Undo), built on
// Melt's Toaster. One toaster per page, shared through Svelte context like the
// settings: a module variable would be shared between visitors on the server.
import { getContext, setContext } from 'svelte';
import { Toaster } from 'melt/builders';

export interface ToastData {
	title: string;
	/** The word the message is about, with its stress mark. Absent when it is about no one word. */
	headword?: string;
	undo?: () => void;
}

const KEY = Symbol('toasts');

export function provideToasts(): Toaster<ToastData> {
	return setContext(KEY, new Toaster<ToastData>({ closeDelay: 4000 }));
}

export function useToasts(): Toaster<ToastData> {
	return getContext<Toaster<ToastData>>(KEY);
}
