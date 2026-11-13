// The text editor of `npm run dev`, server side: a Vite plugin that answers
// the page's questions (src/lib/dev/TextEditor.svelte) under /__edit-text.
//
//   POST /__edit-text/locate   where is this text written?
//   POST /__edit-text/save     write this in its place
//   GET  /__edit-text/pending  how much English is waiting for its Ukrainian?
//
// It exists only while the dev server runs (`apply: 'serve'`): the built site
// has no such address and none of this code.
//
// A change to English text is also written to src/lib/i18n-todo.json, the
// list of what the Ukrainian has fallen behind on. Whoever translates works
// from that list and takes each entry off it.
//
// The page never names a file. It sends the text that was clicked, and the
// server looks for it in src/lib/i18n.ts and the .svelte files under src/,
// so nothing outside those can be written. Requests from another site are
// refused: a page open in the same browser must not be able to rewrite the
// source through the dev server.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { applyEdit, EditError, markupSpots, messageSpots, notePending, quotedSpots, squash } from './source.ts';
import type { Lang, Pending, Spot } from './source.ts';

const MESSAGES = 'src/lib/i18n.ts';
const TODO = 'src/lib/i18n-todo.json';
const ABOUT =
	'English text changed with the text editor of `npm run dev`. The Ukrainian of each entry still says ' +
	'what `was` said: bring it into line with `now`, then take the entry off the list.';

/** The most places one click is offered; a text found in more is too common to pick from. */
const MOST = 8;
/** No request is longer than a page's longest paragraph and its change */
const MAX_BODY = 100_000;

interface Question {
	text: string;
	/** The page's route (/word/[word]), to look in its own file first */
	route: string | null;
	lang: Lang;
}

class Refused extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Only a page of this dev server, opened on this computer, may ask. */
function fromThisSite(req: IncomingMessage): boolean {
	const host = req.headers.host ?? '';
	if (!LOCAL.has(host.replace(/:\d+$/, ''))) return false;
	if (req.method === 'GET') return req.headers['sec-fetch-site'] === 'same-origin';
	// A form on another site can post, but not as JSON
	if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return false;
	const origin = req.headers.origin;
	return typeof origin === 'string' && URL.canParse(origin) && new URL(origin).host === host;
}

async function bodyOf(req: IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > MAX_BODY) throw new Refused(413, 'Too long.');
		chunks.push(chunk);
	}
	try {
		const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
		if (body && typeof body === 'object') return body as Record<string, unknown>;
	} catch {}
	throw new Refused(400, 'Not JSON.');
}

function question(body: Record<string, unknown>): Question {
	if (typeof body.text !== 'string' || !body.text.trim()) throw new Refused(400, 'No text.');
	return {
		text: body.text,
		route: typeof body.route === 'string' ? body.route : null,
		lang: body.lang === 'uk' ? 'uk' : 'en'
	};
}

/**
 * The .svelte files a text on this page can come from: the page's own file
 * first, then every layout and component. Another page's file is left out:
 * "Support Ukraine" clicked in the header is not the link of that name on
 * the About page.
 */
function markupFiles(root: string, pageFile: string | null): string[] {
	const shared = readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' })
		.filter((name) => name.endsWith('.svelte') && !name.endsWith('+page.svelte'))
		.map((name) => 'src/' + name.replaceAll('\\', '/'))
		.sort();
	return pageFile ? [pageFile, ...shared] : shared;
}

function pageFileOf(root: string, route: string | null): string | null {
	// A route's id is its folder under src/routes: /word/[word]
	if (!route || route.includes('..')) return null;
	const file = `src/routes${route === '/' ? '' : route}/+page.svelte`;
	return existsSync(join(root, file)) ? file : null;
}

/**
 * Where the text is written. The page's own file comes first, then messages
 * in the language the page is shown in, then the layouts and components.
 * A template is a guess from what it may have printed ("Word of the day"
 * fits `${shown} of ${total}`), so templates are offered only when the text
 * is written nowhere word for word; and a message in the other language
 * only when nothing else is found.
 */
function locate(root: string, asked: Question): { spots: Spot[]; page: string | null } {
	const page = pageFileOf(root, asked.route);
	const messages = messageSpots(readFileSync(join(root, MESSAGES), 'utf8'), MESSAGES, asked.text);
	const markup = markupFiles(root, page).flatMap((file) => {
		const source = readFileSync(join(root, file), 'utf8');
		return [...markupSpots(source, file, asked.text), ...quotedSpots(source, file, asked.text)];
	});
	const own = messages.filter((spot) => spot.lang === asked.lang);
	const written = [
		...markup.filter((spot) => spot.file === page),
		...own.filter((spot) => spot.kind === 'string'),
		...markup.filter((spot) => spot.file !== page)
	];
	const guessed = own.filter((spot) => spot.kind === 'template');
	const spots = written.length ? written : guessed.length ? guessed : messages;
	return { spots: spots.slice(0, MOST), page };
}

function readPending(root: string): Pending[] {
	try {
		const data: unknown = JSON.parse(readFileSync(join(root, TODO), 'utf8'));
		const list = (data as { todo?: unknown }).todo;
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

function save(root: string, asked: Question, id: unknown, value: unknown) {
	if (typeof id !== 'string' || typeof value !== 'string') throw new Refused(400, 'Nothing to save.');
	// Found again, not trusted from the first answer: the file may have changed since
	const spot = locate(root, asked).spots.find((found) => found.id === id);
	if (!spot) throw new Refused(409, 'The file has changed since you clicked. Click the text again.');

	const path = join(root, spot.file);
	const source = readFileSync(path, 'utf8');
	writeFileSync(path, applyEdit(source, spot, value));

	let pending = readPending(root);
	const marked = spot.lang === 'en';
	if (marked) {
		const edit = {
			file: spot.file,
			key: spot.key,
			was: spot.text,
			now: spot.kind === 'markup' ? squash(value) : value,
			changed: new Date().toISOString().slice(0, 10)
		};
		pending = notePending(pending, edit);
		writeFileSync(join(root, TODO), JSON.stringify({ about: ABOUT, todo: pending }, null, '\t') + '\n');
	}
	return { file: spot.file, line: spot.line, marked, pending: pending.length };
}

async function answer(root: string, req: IncomingMessage) {
	if (!fromThisSite(req)) throw new Refused(403, 'Only a page of this dev server may ask.');
	if (req.method === 'GET' && req.url === '/pending') return { pending: readPending(root).length };
	if (req.method !== 'POST') throw new Refused(405, 'POST only.');
	const body = await bodyOf(req);
	if (req.url === '/locate') return locate(root, question(body));
	if (req.url === '/save') return save(root, question(body), body.id, body.value);
	throw new Refused(404, 'No such question.');
}

export function editText(): Plugin {
	return {
		name: 'nebokrai-edit-text',
		apply: 'serve',
		configureServer(server) {
			const root = server.config.root;
			server.middlewares.use('/__edit-text', (req: IncomingMessage, res: ServerResponse) => {
				const send = (status: number, body: unknown) => {
					res.statusCode = status;
					res.setHeader('content-type', 'application/json; charset=utf-8');
					res.setHeader('cache-control', 'no-store');
					res.end(JSON.stringify(body));
				};
				answer(root, req).then(
					(body) => send(200, body),
					(error: unknown) => {
						if (error instanceof Refused) send(error.status, { error: error.message });
						else if (error instanceof EditError) send(422, { error: error.message });
						else send(500, { error: error instanceof Error ? error.message : String(error) });
					}
				);
			});
		}
	};
}
