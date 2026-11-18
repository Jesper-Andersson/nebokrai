// Runs in every page. A double-click on a Ukrainian word, or the pointer on
// one while a chosen key is held (Ctrl unless the options page says
// otherwise), opens a card that says what the word is (Card.svelte). Nothing
// is drawn, and nothing leaves the page, until then; a Latin word, a number
// or a text field does nothing at all.
import { mount, unmount } from 'svelte';
import { SITE, type GlossReply, type GlossRequest, type SavedReply, type SavedRequest } from '../../lib/api.ts';
import { DEFAULTS, watchSettings, type Settings } from '../../lib/settings.ts';
import { placeIn, textRun } from '../../lib/text-run.ts';
import { wordAt } from '../../lib/word-at.ts';
import { plain } from '../../../src/lib/search/normalize.ts';
import Card from './Card.svelte';
import { card, look } from './state.svelte.ts';

// A pointer crossing a line of text opens nothing; one that stops on a word does not wait long
const HOVER_WAIT_MS = 80;

/** The text and the place in it under a point of the window. */
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
	if (document.caretPositionFromPoint) {
		const caret = document.caretPositionFromPoint(x, y);
		return caret && { node: caret.offsetNode, offset: caret.offset };
	}
	// Chrome before 128
	const range = document.caretRangeFromPoint?.(x, y);
	return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/** A span, a link, a bold word: an element that does not part the text around it. */
const inline = (element: Element) => {
	const display = getComputedStyle(element).display;
	return display === 'inline' || display === 'contents';
};

const editable = (target: EventTarget | null) =>
	target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select') !== null);

/** The site answers; an extension updated or switched off under an open page does not. */
async function ask<Reply>(request: GlossRequest | SavedRequest): Promise<Reply | undefined> {
	try {
		return await browser.runtime.sendMessage(request);
	} catch {
		return undefined;
	}
}

export default defineContentScript({
	matches: ['http://*/*', 'https://*/*'],
	cssInjectionMode: 'ui',

	main(ctx) {
		// On the site itself: say the extension is here, so the site does not
		// offer it to someone who has it (INSTALLED_ATTRIBUTE in src/lib/extension.ts)
		if (location.origin === SITE) document.documentElement.setAttribute('data-nebokrai-extension', '');

		let settings: Settings = DEFAULTS;
		watchSettings((now) => {
			settings = now;
			look.theme = now.theme;
			look.font = now.font;
			look.size = now.size;
		});

		let host: HTMLElement | undefined;
		// The word the card is about, so the pointer resting on it does not ask again
		let shown: { node: Text; start: number } | undefined;
		let pointer: { x: number; y: number; target: EventTarget | null; onCard: boolean } | undefined;
		let hoverTimer: number | undefined;

		/** Draws the card's home in the page, on the first word asked about. */
		async function ready() {
			if (host) return;
			const ui = await createShadowRootUi(ctx, {
				name: 'nebokrai-card',
				position: 'inline',
				anchor: 'body',
				onMount: (container) => mount(Card, { target: container }),
				onRemove: (app) => {
					if (app) void unmount(app);
				}
			});
			ui.mount();
			host = ui.shadowHost;
		}

		const inCard = (event: Event) => host !== undefined && event.composedPath().includes(host);

		function close() {
			card.open = false;
			shown = undefined;
		}

		/** Opens the card for the Ukrainian word at a point of the window, if one is there. */
		async function lookUp(x: number, y: number, target: EventTarget | null) {
			if (editable(target)) return;
			const caret = caretAt(x, y);
			if (!caret || !(caret.node instanceof Text)) return;
			// The word may go on in the next piece of text: кн<span>и́</span>га
			const run = textRun(caret.node, inline);
			const at = wordAt(run.text, run.origin + caret.offset);
			if (!at) return;
			const from = placeIn(run, at.start);
			const to = placeIn(run, at.end, true);
			if (card.open && shown?.node === from.node && shown.start === from.offset) return;

			const range = document.createRange();
			range.setStart(from.node, from.offset);
			range.setEnd(to.node, to.offset);
			// The nearest text to a point in a margin is not a word under the pointer
			const rects = [...range.getClientRects()];
			const hit = rects.find((r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2);
			if (!hit) return;
			// A word in several pieces has a box for each; the card stands by the
			// whole of it, as far as it is on the line the pointer is on
			const line = rects.filter((r) => r.top < hit.bottom && r.bottom > hit.top);
			const on = {
				left: Math.min(...line.map((r) => r.left)),
				top: Math.min(...line.map((r) => r.top)),
				bottom: Math.max(...line.map((r) => r.bottom))
			};

			shown = { node: from.node, start: from.offset };
			await ready();
			const mine = ++card.asked;
			Object.assign(card, {
				open: true,
				text: at.word,
				left: on.left,
				top: on.top,
				bottom: on.bottom,
				answer: null,
				failed: false,
				saved: null
			});

			const request: GlossRequest = { type: 'gloss', w: plain(at.word) };
			if (at.before) request.before = plain(at.before);
			if (at.after) request.after = plain(at.after);
			const reply = await ask<GlossReply>(request);
			// A later word was asked about while this answer was on its way
			if (mine !== card.asked) return;
			if (!reply?.ok) {
				card.failed = true;
				return;
			}
			card.answer = reply.answer;

			// Whether the reader has saved it: only a word with an entry can be saved
			const main = reply.answer.phrase ?? reply.answer.readings[0];
			if (!main || main.vesum_only) return;
			const saved = await ask<SavedReply>({ type: 'saved', word: main.word });
			if (mine === card.asked) card.saved = saved ?? { ok: false };
		}

		const held = (event: MouseEvent | KeyboardEvent) =>
			settings.hoverKey === 'ctrl'
				? event.ctrlKey
				: settings.hoverKey === 'alt'
					? event.altKey
					: settings.hoverKey === 'shift'
						? event.shiftKey
						: false;

		function hoverSoon() {
			clearTimeout(hoverTimer);
			hoverTimer = ctx.setTimeout(() => {
				if (pointer && !pointer.onCard) void lookUp(pointer.x, pointer.y, pointer.target);
			}, HOVER_WAIT_MS);
		}

		ctx.addEventListener(document, 'dblclick', (event) => {
			if (settings.doubleClick && !inCard(event)) void lookUp(event.clientX, event.clientY, event.target);
		});
		ctx.addEventListener(
			document,
			'mousemove',
			(event) => {
				pointer = { x: event.clientX, y: event.clientY, target: event.target, onCard: inCard(event) };
				if (held(event)) hoverSoon();
			},
			{ passive: true }
		);
		ctx.addEventListener(document, 'pointerdown', (event) => {
			if (card.open && !inCard(event)) close();
		});
		ctx.addEventListener(document, 'keydown', (event) => {
			if (card.open && event.key === 'Escape') close();
			// The key pressed with the pointer already resting on a word
			else if (!event.repeat && held(event)) hoverSoon();
		});
		// The card stands at a place in the window, and the word has just left it
		ctx.addEventListener(window, 'scroll', () => card.open && close(), { capture: true, passive: true });
	}
});
