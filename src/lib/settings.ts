// The visitor's settings. They live in cookies so the server can render the
// page in the right theme and language (hooks.server.ts).
import { getContext, setContext } from 'svelte';

export type Lang = 'en' | 'uk';
export type Theme = 'system' | 'light' | 'sepia' | 'dark';
/** On-screen keyboard layout: standard ЙЦУКЕН, or phonetic (xkb "homophonic"). */
export type KeyboardLayout = 'standard' | 'phonetic';

/** What is behind the page: the theme's plain colour, or one of the photos in src/lib/assets/backgrounds. */
export type Background = 'plain' | 'field' | 'hills';
export const BACKGROUNDS: Background[] = ['plain', 'field', 'hills'];

/** Whether the radio button is in the corner of the page (RadioPlayer.svelte). Off until the visitor asks for it. */
export type RadioButton = 'off' | 'on';

export interface Settings {
	lang: Lang;
	theme: Theme;
	layout: KeyboardLayout;
	background: Background;
	radio: RadioButton;
}

export function readSettings(cookie: (name: string) => string | undefined): Settings {
	const theme = cookie('theme');
	const background = cookie('bg');
	return {
		lang: cookie('lang') === 'uk' ? 'uk' : 'en',
		theme: theme === 'light' || theme === 'sepia' || theme === 'dark' ? theme : 'system',
		layout: cookie('kbd') === 'phonetic' ? 'phonetic' : 'standard',
		background: background === 'field' || background === 'hills' ? background : 'plain',
		radio: cookie('radio') === 'on' ? 'on' : 'off'
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
	} else if (name === 'background') {
		// <html data-bg="field"> puts the photo behind the page (app.css).
		if (value === 'plain') {
			document.cookie = 'bg=; path=/; max-age=0; samesite=lax';
			root.removeAttribute('data-bg');
		} else {
			document.cookie = `bg=${value}; path=/; max-age=${YEAR}; samesite=lax`;
			root.setAttribute('data-bg', value);
		}
	} else if (name === 'radio') {
		// Nothing on <html>: the layout draws the button from the settings object.
		if (value === 'on') document.cookie = `radio=on; path=/; max-age=${YEAR}; samesite=lax`;
		else document.cookie = 'radio=; path=/; max-age=0; samesite=lax';
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
