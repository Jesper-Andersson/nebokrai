// The ways to help with the site's costs, listed in the menu on /about
// (DonateMenu.svelte).
//
// A gift must never buy anything here: VESUM's licence keeps Nebokrai
// non-commercial, so no way to give may come with perks, and none is named
// anywhere but /about.
//
// The icons are served from static/donate/ so that the menu asks none of these
// sites for anything. Liberapay's and GitHub's are the marks their own sites
// serve, drawn in one colour, and are shown through a mask in the text colour
// so that they work in every theme. Ko-fi's is the heart cup from the sticker
// set Ko-fi gave creators (by Sammy Doo), shrunk to 64 px.

export interface Way {
	name: string;
	url: string;
	/** A file in static/donate/ */
	icon: string;
	/** A one-colour mark, shown as a mask in the text colour */
	mono?: boolean;
	en: string;
	uk: string;
	/**
	 * False until the account exists: the menu then shows it only in
	 * `npm run dev`, marked as not set up, so the link never reaches visitors
	 * before it works.
	 */
	ready: boolean;
}

export const WAYS: Way[] = [
	{
		name: 'Ko-fi',
		url: 'https://ko-fi.com/jesperandersson0',
		icon: 'kofi.webp',
		en: 'Once or monthly, by card or PayPal',
		uk: 'Разово чи щомісяця, карткою або PayPal',
		ready: true
	},
	{
		name: 'Liberapay',
		url: 'https://liberapay.com/JesperAndersson/',
		icon: 'liberapay.svg',
		mono: true,
		en: 'Monthly, takes no cut',
		uk: 'Щомісяця, без комісії',
		ready: true
	},
	{
		name: 'GitHub Sponsors',
		url: 'https://github.com/sponsors/Jesper-Andersson',
		icon: 'github.svg',
		mono: true,
		en: 'Once or monthly, takes no cut',
		uk: 'Разово чи щомісяця, без комісії',
		ready: false
	}
];
