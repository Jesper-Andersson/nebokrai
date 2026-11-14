// Photograph the site's pages before and after a change to its design, and
// lay the pairs side by side on one sheet.
//   npm run shots -- before                 with `npm run dev` running
//   (change the design)
//   npm run shots -- after
//   then open .output/shots/index.html: the pairs that differ come first
//
//   npm run shots -- after --base http://localhost:5191 --pages /learn,/saved
//
// Every page is taken at two widths (a laptop and a phone), in the three
// themes and in both languages: a change that is right in light English is
// often wrong in dark Ukrainian on a phone. The pictures are whole pages, not
// only what fits a window.
//
// It drives an installed Chrome or Edge without a window through its
// debugging port, so it needs no dependency: Node has the WebSocket. The
// theme and the language are the site's own cookies (src/lib/settings.ts).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BROWSERS = [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/chromium',
	'/usr/bin/google-chrome'
];

// One of each kind of page: the search, a search's results, a word, the
// dashboards, a list, a page of text, and the style guide.
const PAGES = [
	'/',
	'/?q=кава',
	'/word/kava',
	'/learn',
	'/saved',
	'/review',
	'/alphabet',
	'/grammar',
	'/common-words',
	'/about',
	'/dev/styleguide'
];
const WIDTHS = [1280, 390];
const THEMES = ['light', 'dark', 'sepia'];
const LANGS = ['en', 'uk'];
const OUT = '.output/shots';

const args = process.argv.slice(2);
const option = (name: string) => {
	const at = args.indexOf(`--${name}`);
	return at === -1 ? undefined : args[at + 1];
};
const label = args[0];
if (label !== 'before' && label !== 'after') {
	console.error('Say which set this is: npm run shots -- before   or   npm run shots -- after');
	process.exit(1);
}
const base = (option('base') ?? 'http://localhost:5173').replace(/\/$/, '');
const pages = option('pages')?.split(',') ?? PAGES;
const browser = option('browser') ?? BROWSERS.find((path) => existsSync(path));
if (!browser || !existsSync(browser)) {
	console.error('No Chrome, Edge or Chromium found. Give the path to one: --browser <path>');
	process.exit(1);
}

try {
	await fetch(base, { signal: AbortSignal.timeout(5000) });
} catch {
	console.error(`Nothing answers at ${base}. Start \`npm run dev\`, or name the address: --base http://localhost:<port>`);
	process.exit(1);
}

// /word/kava → word-kava; / → home; /?q=кава → q-кава
const fileName = (page: string) =>
	page
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-|-$/g, '') || 'home';

// ---- The browser, and a way to talk to it ----

const profile = mkdtempSync(join(tmpdir(), 'nebokrai-shots-'));
const chrome = spawn(browser, [
	'--headless=new',
	'--remote-debugging-port=0',
	`--user-data-dir=${profile}`,
	'--hide-scrollbars',
	'--no-first-run',
	'about:blank'
]);
// Whatever goes wrong below, no browser without a window is left running.
process.on('exit', () => chrome.kill());

// The browser prints the address of its debugging port when it is ready.
const endpoint = await new Promise<string>((resolve, reject) => {
	let printed = '';
	chrome.stderr.on('data', (chunk: Buffer) => {
		printed += chunk;
		const found = /DevTools listening on (ws:\/\/\S+)/.exec(printed);
		if (found) resolve(found[1]);
	});
	chrome.on('exit', () => reject(new Error(`The browser stopped before it was ready:\n${printed}`)));
	setTimeout(() => reject(new Error('The browser did not start within 20 seconds')), 20_000);
});

const socket = new WebSocket(endpoint);
await new Promise((resolve, reject) => {
	socket.onopen = resolve;
	socket.onerror = reject;
});

interface Message {
	id?: number;
	method?: string;
	params?: Record<string, any>;
	result?: Record<string, any>;
	error?: { message: string };
}
let lastId = 0;
const answers = new Map<number, { resolve: (result: Record<string, any>) => void; reject: (err: Error) => void }>();
let onEvent: (message: Message) => void = () => {};
socket.onmessage = (event) => {
	const message: Message = JSON.parse(String(event.data));
	if (message.id === undefined) return onEvent(message);
	const waiting = answers.get(message.id);
	answers.delete(message.id);
	if (message.error) waiting?.reject(new Error(message.error.message));
	else waiting?.resolve(message.result ?? {});
};

let sessionId: string | undefined;
function send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, any>> {
	const id = ++lastId;
	socket.send(JSON.stringify({ id, method, params, sessionId }));
	return new Promise((resolve, reject) => answers.set(id, { resolve, reject }));
}

/** Resolves when the page has loaded and has asked for nothing for half a second. */
function settled(): Promise<void> {
	return new Promise((resolve) => {
		const giveUp = setTimeout(resolve, 20_000);
		onEvent = (message) => {
			if (message.method === 'Page.lifecycleEvent' && message.params?.name === 'networkIdle') {
				clearTimeout(giveUp);
				resolve();
			}
		};
	});
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
await send('Page.enable');
await send('Page.setLifecycleEventsEnabled', { enabled: true });
// Nothing caught halfway through opening
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

// ---- The pictures ----

const folder = join(OUT, label);
rmSync(folder, { recursive: true, force: true });
mkdirSync(folder, { recursive: true });

let taken = 0;
const total = pages.length * WIDTHS.length * THEMES.length * LANGS.length;
for (const page of pages) {
	for (const width of WIDTHS) {
		await send('Emulation.setDeviceMetricsOverride', {
			width,
			height: 900,
			deviceScaleFactor: 1,
			mobile: width < 600
		});
		for (const theme of THEMES) {
			for (const lang of LANGS) {
				await send('Network.setCookie', { name: 'theme', value: theme, url: base });
				await send('Network.setCookie', { name: 'lang', value: lang, url: base });
				const idle = settled();
				await send('Page.navigate', { url: base + encodeURI(page) });
				await idle;
				// The fonts are in, and what a page draws once it runs (the saved
				// words, the style guide) has had its turn.
				await send('Runtime.evaluate', {
					expression: 'document.fonts.ready.then(() => new Promise((done) => setTimeout(done, 300)))',
					awaitPromise: true
				});
				const { cssContentSize } = await send('Page.getLayoutMetrics');
				const { data } = await send('Page.captureScreenshot', {
					format: 'png',
					captureBeyondViewport: true,
					clip: { x: 0, y: 0, width, height: Math.min(Math.ceil(cssContentSize.height), 12_000), scale: 1 }
				});
				writeFileSync(join(folder, `${fileName(page)}.${width}.${theme}.${lang}.png`), Buffer.from(data, 'base64'));
				process.stdout.write(`\r${++taken} of ${total}`);
			}
		}
	}
}
process.stdout.write('\n');

socket.close();
chrome.kill();
await new Promise((resolve) => chrome.on('exit', resolve));
// The browser may still hold a file of its profile for a moment on Windows.
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

// ---- The sheet ----

const list = (set: string) => (existsSync(join(OUT, set)) ? readdirSync(join(OUT, set)).filter((f) => f.endsWith('.png')) : []);
const before = new Set(list('before'));
const after = new Set(list('after'));
const names = [...new Set([...before, ...after])].sort();
const same = (name: string) =>
	before.has(name) &&
	after.has(name) &&
	readFileSync(join(OUT, 'before', name)).equals(readFileSync(join(OUT, 'after', name)));

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const picture = (set: string, name: string, has: boolean) =>
	has
		? `<a href="${set}/${escape(name)}"><img loading="lazy" src="${set}/${escape(name)}" alt="${set}"></a>`
		: `<p class="none">No picture in "${set}"</p>`;
const pair = (name: string) => `
<section>
	<h2>${escape(name.replace(/\.png$/, '').split('.').join(' · '))}</h2>
	<div class="pair">${picture('before', name, before.has(name))}${picture('after', name, after.has(name))}</div>
</section>`;

const compared = before.size > 0 && after.size > 0;
const changed = compared ? names.filter((name) => !same(name)) : [];
const unchanged = compared ? names.filter((name) => same(name)) : names;

writeFileSync(
	join(OUT, 'index.html'),
	`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Before and after</title>
<style>
	body { margin: 2rem; background: #e9e7e1; color: #16181d; font: 15px/1.4 system-ui, sans-serif; }
	h1 { margin: 2rem 0 0.25rem; font-size: 1.4rem; }
	h2 { margin: 2rem 0 0.5rem; font-size: 1rem; }
	.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
	img { display: block; max-width: 100%; border: 1px solid #b9b5a8; }
	.none, .count { color: #646a76; }
</style>
<p class="count">Left: before. Right: after. A picture opens at full size.</p>
${
	compared
		? `<h1>Changed (${changed.length})</h1>${changed.map(pair).join('') || '<p class="none">Nothing differs.</p>'}
<h1>The same (${unchanged.length})</h1>${unchanged.map(pair).join('')}`
		: `<h1>Only one set so far (${names.length})</h1>${names.map(pair).join('')}`
}
</html>
`
);

console.log(`${taken} pictures in ${folder}`);
if (compared) console.log(`${changed.length} differ, ${unchanged.length} are the same`);
console.log(`Sheet: ${join(OUT, 'index.html')}`);
