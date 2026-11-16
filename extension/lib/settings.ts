// What the reader chose on the options page, kept by the browser and carried
// to their other devices where the browser syncs.
import { browser } from 'wxt/browser';

/** The key that, held down, makes the word under the pointer open its card. */
export type HoverKey = 'ctrl' | 'alt' | 'shift' | 'off';
/** The site's three themes; `system` follows the device, as the site does until one is chosen. */
export type Theme = 'system' | 'light' | 'sepia' | 'dark';
/** The face of Ukrainian words on the card. Serif is the default, as on the site. */
export type Font = 'serif' | 'sans';
/** How large the card is drawn, text and all. */
export type Size = 'small' | 'medium' | 'large' | 'larger';

export interface Settings {
	hoverKey: HoverKey;
	doubleClick: boolean;
	theme: Theme;
	font: Font;
	size: Size;
}

export const HOVER_KEYS: HoverKey[] = ['ctrl', 'alt', 'shift', 'off'];
export const THEMES: Theme[] = ['system', 'light', 'sepia', 'dark'];
export const FONTS: Font[] = ['serif', 'sans'];
export const SIZES: Size[] = ['small', 'medium', 'large', 'larger'];

export const DEFAULTS: Settings = { hoverKey: 'ctrl', doubleClick: true, theme: 'system', font: 'serif', size: 'medium' };

const one = <T extends string>(all: T[], value: unknown, otherwise: T): T =>
	all.includes(value as T) ? (value as T) : otherwise;

function clean(stored: Record<string, unknown>): Settings {
	return {
		hoverKey: one(HOVER_KEYS, stored.hoverKey, DEFAULTS.hoverKey),
		doubleClick: typeof stored.doubleClick === 'boolean' ? stored.doubleClick : DEFAULTS.doubleClick,
		theme: one(THEMES, stored.theme, DEFAULTS.theme),
		font: one(FONTS, stored.font, DEFAULTS.font),
		size: one(SIZES, stored.size, DEFAULTS.size)
	};
}

export async function readSettings(): Promise<Settings> {
	try {
		return clean(await browser.storage.sync.get(Object.keys(DEFAULTS)));
	} catch {
		return DEFAULTS;
	}
}

export async function writeSettings(change: Partial<Settings>): Promise<void> {
	await browser.storage.sync.set(change);
}

/** Calls `use` now and again whenever a setting changes, in this tab or another. */
export function watchSettings(use: (settings: Settings) => void): void {
	void readSettings().then(use);
	browser.storage.onChanged.addListener((_changes, area) => {
		if (area === 'sync') void readSettings().then(use);
	});
}
