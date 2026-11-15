// The options page: which key opens a card on hover, whether a double-click
// does, and the card's theme and font. A change is kept at once; open pages
// follow it.
import { browser } from 'wxt/browser';
import { SITE } from '../../lib/api.ts';
import { messagesFor } from '../../lib/messages.ts';
import { FONTS, HOVER_KEYS, readSettings, THEMES, writeSettings, type Settings } from '../../lib/settings.ts';

const m = messagesFor(browser.i18n.getUILanguage()).options;

for (const element of document.querySelectorAll<HTMLElement>('[data-text]')) {
	element.textContent = m[element.dataset.text as 'hoverKey' | 'doubleClick' | 'theme' | 'font' | 'sent'];
}

const privacy = document.getElementById('privacy') as HTMLAnchorElement;
privacy.textContent = m.privacy;
privacy.href = `${SITE}/privacy`;

const settings = await readSettings();

/** A dropdown for one setting, with its choices named in the reader's language. */
function choice<K extends 'hoverKey' | 'theme' | 'font'>(name: K, values: Settings[K][], names: Record<string, string>) {
	const select = document.getElementById(name) as HTMLSelectElement;
	for (const value of values) select.add(new Option(names[value], value));
	select.value = settings[name];
	select.addEventListener('change', () => void writeSettings({ [name]: select.value }));
}

choice('hoverKey', HOVER_KEYS, m.keys);
choice('theme', THEMES, m.themes);
choice('font', FONTS, m.fonts);

const doubleClick = document.getElementById('doubleClick') as HTMLInputElement;
doubleClick.checked = settings.doubleClick;
doubleClick.addEventListener('change', () => void writeSettings({ doubleClick: doubleClick.checked }));
