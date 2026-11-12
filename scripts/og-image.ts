// Draw static/og.png, the picture a chat or a social network shows beside a
// link to the site (og:image in src/routes/+layout.svelte).
//   npm run og-image                       finds Edge or Chrome by itself
//   npm run og-image -- "C:\path\to\chrome.exe"
// The picture is a web page, set in the site's own fonts and colours and
// photographed by a browser without a window, so it needs no drawing program
// and no dependency. It is 1200 by 630, the size the networks ask for; they
// show it far smaller, which is why nothing on it is set under 26 pixels.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOGO_BOX, WORDMARK } from '../src/lib/logo-paths.ts';

const BROWSERS = [
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/chromium',
	'/usr/bin/google-chrome'
];

const browser = process.argv[2] ?? BROWSERS.find((path) => existsSync(path));
if (!browser || !existsSync(browser)) {
	console.error('No Edge, Chrome or Chromium found. Give the path to one: npm run og-image -- <path>');
	process.exit(1);
}

const asset = (path: string) => pathToFileURL(resolve('src/lib/assets', path)).href;
const icon = readFileSync('src/lib/assets/logo-icon.svg', 'utf8');
const mark = WORDMARK.en;

// The entry is the one the site is named after, as its own page shows it.
const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<style>
	@font-face { font-family: 'Serif'; font-weight: 700; src: url('${asset('serif/NebokraiSerif-Bold.woff2')}'); }
	@font-face { font-family: 'Text'; font-weight: 400; src: url('${asset('fixel/FixelText-Regular.woff2')}'); }
	@font-face { font-family: 'Text'; font-weight: 600; src: url('${asset('fixel/FixelText-SemiBold.woff2')}'); }
	@font-face { font-family: 'Display'; font-weight: 800; src: url('${asset('fixel/FixelDisplay-ExtraBold.woff2')}'); }

	* { box-sizing: border-box; margin: 0; }

	/* The page colour, with the sky above and the wheat below: a horizon */
	body {
		display: grid;
		grid-template-columns: 1fr 510px;
		align-items: center;
		gap: 48px;
		width: 1200px;
		height: 630px;
		padding: 0 64px;
		overflow: hidden;
		background:
			linear-gradient(rgb(91 143 214 / 0.22), rgb(91 143 214 / 0.06) 50%, rgb(228 203 129 / 0.12) 50%, rgb(228 203 129 / 0.4)),
			#f7f6f2;
		color: #16181d;
		font-family: 'Text', sans-serif;
	}

	.name { display: flex; align-items: center; gap: 10px; }
	.name .icon { width: 76px; height: 76px; }
	.name .icon svg { display: block; width: 100%; height: 100%; }
	.name .mark { height: 96px; fill: #16181d; stroke: #16181d; stroke-linejoin: round; }

	h1 { margin-top: 30px; font-family: 'Serif', serif; font-size: 58px; line-height: 1.1; }
	h1 span { white-space: nowrap; }
	.has { margin-top: 24px; color: #3d424d; font-size: 31px; line-height: 1.35; }
	.address { margin-top: 30px; color: #1f5fbf; font-size: 30px; font-weight: 600; }

	.card {
		padding: 38px 38px 36px;
		border: 1px solid #e3e0d6;
		border-radius: 24px;
		background: #ffffff;
		box-shadow: 0 2px 6px rgb(22 24 29 / 0.08), 0 16px 48px rgb(22 24 29 / 0.16);
	}
	.headword { font-family: 'Display', sans-serif; font-size: 80px; font-weight: 800; line-height: 1.1; }
	.headword span { color: #cf3d2e; }
	.grammar { margin-top: 8px; color: #646a76; font-size: 28px; font-style: italic; }
	.meaning { margin-top: 22px; padding-top: 22px; border-top: 1px solid #e3e0d6; font-size: 40px; font-weight: 600; }
	.example { margin-top: 20px; font-size: 26px; line-height: 1.35; }
	.example span { display: block; color: #646a76; }
</style>
<div>
	<div class="name">
		<div class="icon">${icon}</div>
		<svg class="mark" viewBox="0 ${LOGO_BOX.top} ${mark.width} ${LOGO_BOX.height}" stroke-width="${LOGO_BOX.stroke}"><path d="${mark.d}"/></svg>
	</div>
	<h1><span>Ukrainian–English</span> dictionary</h1>
	<p class="has">Stress, full tables, audio and examples. Search in Ukrainian, Latin letters or English.</p>
	<p class="address">nebokrai.app</p>
</div>
<div class="card" lang="uk">
	<p class="headword">небокр<span>а́</span>й</p>
	<p class="grammar" lang="en">noun, masculine</p>
	<p class="meaning" lang="en">horizon</p>
	<p class="example">Я побачив місяць над небокраєм.<span lang="en">I saw the moon above the horizon.</span></p>
</div>
</html>
`;

const dir = mkdtempSync(join(tmpdir(), 'og-image-'));
const page = join(dir, 'og.html');
const out = resolve('static/og.png');
writeFileSync(page, html);
try {
	execFileSync(
		browser,
		[
			'--headless=new',
			'--disable-gpu',
			'--hide-scrollbars',
			'--force-device-scale-factor=1',
			'--window-size=1200,630',
			// The fonts are files beside the page: wait for them before the photograph
			'--virtual-time-budget=3000',
			`--user-data-dir=${join(dir, 'profile')}`,
			`--screenshot=${out}`,
			pathToFileURL(page).href
		],
		{ stdio: 'ignore' }
	);
} finally {
	rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
}

// A PNG states its size in bytes 16 to 23. Some browser versions photograph
// the window less its frame; a picture of another size would be cropped.
const png = readFileSync(out);
const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
if (width !== 1200 || height !== 630) {
	console.error(`static/og.png came out ${width} by ${height}, not 1200 by 630.`);
	process.exit(1);
}
console.log(`static/og.png written, ${Math.round(png.length / 1024)} KB.`);
