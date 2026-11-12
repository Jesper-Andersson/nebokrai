// Draw the icons an installed app is shown with (static/icons/, named in
// static/manifest.webmanifest) from the site's logo.
//   npm run app-icons                       finds Edge or Chrome by itself
//   npm run app-icons -- "C:\path\to\chrome.exe"
// Like og-image.ts, each icon is a web page photographed by a browser without
// a window, so it needs no drawing program and no dependency.
//
// Three files:
// - icon-192.png and icon-512.png: the logo by itself on nothing, for places
//   that show an icon as it is (a browser's install prompt, a splash screen).
// - maskable-512.png: the logo on the page's colour, for a phone's home
//   screen, which cuts every icon to its own shape (a circle, a squircle).
//   Only what lies inside a circle 80% of the width is sure to survive the
//   cut, so the logo is drawn 58% wide: its corners then reach 41% from the
//   centre at most.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BROWSERS = [
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/chromium',
	'/usr/bin/google-chrome'
];

const browser = process.argv[2] ?? BROWSERS.find((path) => existsSync(path));
if (!browser || !existsSync(browser)) {
	console.error('No Edge, Chrome or Chromium found. Give the path to one: npm run app-icons -- <path>');
	process.exit(1);
}

const logo = readFileSync('src/lib/assets/logo-icon.svg', 'utf8');

/** --bg of src/app.css, the manifest's background_color */
const PAGE = '#f7f6f2';

const ICONS: { file: string; size: number; logo: number; background: string }[] = [
	{ file: 'icon-192.png', size: 192, logo: 1, background: 'transparent' },
	{ file: 'icon-512.png', size: 512, logo: 1, background: 'transparent' },
	{ file: 'maskable-512.png', size: 512, logo: 0.58, background: PAGE }
];

const dir = mkdtempSync(join(tmpdir(), 'app-icons-'));
mkdirSync('static/icons', { recursive: true });
try {
	for (const icon of ICONS) {
		const page = join(dir, icon.file + '.html');
		const out = resolve('static/icons', icon.file);
		writeFileSync(
			page,
			`<!doctype html>
<meta charset="utf-8">
<style>
	html, body { margin: 0; width: ${icon.size}px; height: ${icon.size}px; overflow: hidden; background: ${icon.background}; }
	body { display: grid; place-items: center; }
	svg { display: block; width: ${icon.size * icon.logo}px; height: ${icon.size * icon.logo}px; }
</style>
${logo}
`
		);
		execFileSync(
			browser,
			[
				'--headless=new',
				'--disable-gpu',
				'--hide-scrollbars',
				'--force-device-scale-factor=1',
				`--window-size=${icon.size},${icon.size}`,
				// Nothing behind the page, so that "transparent" is
				'--default-background-color=00000000',
				`--user-data-dir=${join(dir, 'profile')}`,
				`--screenshot=${out}`,
				pathToFileURL(page).href
			],
			{ stdio: 'ignore' }
		);

		// A PNG states its size in bytes 16 to 23. A browser that will not make
		// a window this small would give a picture of another size.
		const png = readFileSync(out);
		const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
		if (width !== icon.size || height !== icon.size) {
			console.error(`static/icons/${icon.file} came out ${width} by ${height}, not ${icon.size} square.`);
			process.exit(1);
		}
		console.log(`static/icons/${icon.file} written, ${Math.round(png.length / 1024)} KB.`);
	}
} finally {
	rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
}
