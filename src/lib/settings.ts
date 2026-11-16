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

/** The face of titles, example sentences and pages of text: Zakon, or Fixel like the rest of the page. */
export type FontChoice = 'serif' | 'sans';
export const FONTS: FontChoice[] = ['serif', 'sans'];

/** A switch that is only on or off. */
export type OnOff = 'off' | 'on';

export interface Settings {
	lang: Lang;
	theme: Theme;
	layout: KeyboardLayout;
	background: Background;
	font: FontChoice;
	radio: RadioButton;
	/** The headword in Latin letters under it (vodá). On unless turned off. */
	roman: OnOff;
	/** The headword in the phonetic alphabet ([wɔˈda]). Off unless turned on: most learners do not read it. */
	ipa: OnOff;
	/** The English under an example sentence, and the word of the day's meanings, blurred until pressed (Translation.svelte). On unless turned off. */
	blur: OnOff;
	/**
	 * Not a choice of the visitor's: the id of the newest entry on /updates this
	 * browser has seen (src/lib/updates.ts), or '' on a first visit. It is a
	 * cookie like the rest so that the server can colour the footer's link on
	 * the first paint.
	 */
	seen: string;
	/**
	 * Not a choice either: the id of the appeal (src/lib/appeal.ts) whose banner
	 * this browser closed, or ''. A cookie, so a closed banner is left out of
	 * the page the server sends instead of flashing and then going.
	 */
	closed: string;
}

export function readSettings(cookie: (name: string) => string | undefined): Settings {
	const theme = cookie('theme');
	const background = cookie('bg');
	const seen = cookie('seen') ?? '';
	const closed = cookie('closed') ?? '';
	return {
		lang: cookie('lang') === 'uk' ? 'uk' : 'en',
		theme: theme === 'light' || theme === 'sepia' || theme === 'dark' ? theme : 'system',
		layout: cookie('kbd') === 'phonetic' ? 'phonetic' : 'standard',
		background: background === 'field' || background === 'hills' ? background : 'plain',
		font: cookie('font') === 'sans' ? 'sans' : 'serif',
		radio: cookie('radio') === 'on' ? 'on' : 'off',
		roman: cookie('roman') === 'off' ? 'off' : 'on',
		ipa: cookie('ipa') === 'on' ? 'on' : 'off',
		blur: cookie('blur') === 'off' ? 'off' : 'on',
		// Anything that is not shaped like an id counts as a first visit
		seen: /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(seen) ? seen : '',
		closed: /^[a-z0-9-]+$/.test(closed) ? closed : ''
	};
}

// The value a switch has when its cookie is not set; only the other value is written down
const SWITCH_DEFAULTS = { radio: 'off', roman: 'on', ipa: 'off', blur: 'on' } as const;

const YEAR = 60 * 60 * 24 * 365;
// A closed appeal comes back after a month: long enough not to nag, short
// enough that a reader who closed it on the first day sees it once more.
const MONTH = 60 * 60 * 24 * 30;

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
	} else if (name === 'font') {
		// <html data-font="sans"> sets the reading roles in Fixel (app.css).
		if (value === 'serif') {
			document.cookie = 'font=; path=/; max-age=0; samesite=lax';
			root.removeAttribute('data-font');
		} else {
			document.cookie = `font=${value}; path=/; max-age=${YEAR}; samesite=lax`;
			root.setAttribute('data-font', value);
		}
	} else if (name === 'radio' || name === 'roman' || name === 'ipa' || name === 'blur') {
		// Nothing on <html>: the page draws these from the settings object.
		if (value !== SWITCH_DEFAULTS[name as keyof typeof SWITCH_DEFAULTS]) document.cookie = `${name}=${value}; path=/; max-age=${YEAR}; samesite=lax`;
		else document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
	} else if (name === 'seen') {
		document.cookie = `seen=${value}; path=/; max-age=${YEAR}; samesite=lax`;
	} else if (name === 'closed') {
		document.cookie = `closed=${value}; path=/; max-age=${MONTH}; samesite=lax`;
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
