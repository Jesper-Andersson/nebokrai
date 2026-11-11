// The visitor's settings. They live in cookies so the server can render the
// page in the right theme and language (hooks.server.ts).
import { getContext, setContext } from 'svelte';

export type Lang = 'en' | 'uk';
export type Theme = 'system' | 'light' | 'dark';
/** On-screen keyboard layout: standard ЙЦУКЕН, or phonetic (xkb "homophonic"). */
export type KeyboardLayout = 'standard' | 'phonetic';

export interface Settings {
	lang: Lang;
	theme: Theme;
	layout: KeyboardLayout;
}

export function readSettings(cookie: (name: string) => string | undefined): Settings {
	const theme = cookie('theme');
	return {
		lang: cookie('lang') === 'uk' ? 'uk' : 'en',
		theme: theme === 'light' || theme === 'dark' ? theme : 'system',
		layout: cookie('kbd') === 'phonetic' ? 'phonetic' : 'standard'
	};
}

const YEAR = 60 * 60 * 24 * 365;

/** Browser only: remember a setting and apply it to the page at once. */
export function applySetting<K extends keyof Settings>(name: K, value: Settings[K]): void {
	const root = document.documentElement;
	if (name === 'theme') {
		if (value === 'system') {
			document.cookie = 'theme=; path=/; max-age=0; samesite=lax';
			root.removeAttribute('data-theme');
		} else {
			document.cookie = `theme=${value}; path=/; max-age=${YEAR}; samesite=lax`;
			root.setAttribute('data-theme', value);
		}
	} else if (name === 'lang') {
		document.cookie = `lang=${value}; path=/; max-age=${YEAR}; samesite=lax`;
		root.setAttribute('lang', value);
	} else {
		document.cookie = `kbd=${value}; path=/; max-age=${YEAR}; samesite=lax`;
	}
}

// One reactive settings object per page, shared through Svelte context (not a
// module variable, which the server would share between visitors).
const KEY = Symbol('settings');

export function provideSettings(settings: Settings): void {
	setContext(KEY, settings);
}

export function useSettings(): Settings {
	return getContext<Settings>(KEY);
}
