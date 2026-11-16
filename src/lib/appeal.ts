// The one fundraiser the banner under the header asks for (Appeal.svelte).
// One at a time: a new campaign replaces this, with a new id, so a visitor
// who closed the old one sees the new one.
//
// Volt 4 Victory: Aurora Frontline Aid, a Swedish foundation, with Denys
// Davydov and Brandon Mitchell, buying power stations for Ukrainian units on
// the Kharkiv and Donetsk fronts (November 2026). Its text is under `appeal`
// in i18n.ts; its picture is theirs, credited on /sources.

export interface Appeal {
	/** Stored in the `closed` cookie when the visitor closes the banner; letters, digits and hyphens */
	id: string;
	/** Where the banner's links go */
	url: string;
	/** The last day the banner is shown, in UTC. The campaign names no end; this retires it by itself. */
	until: string;
}

export const APPEAL: Appeal = {
	id: 'volt4victory',
	url: 'https://auroraaid.eu/volt4victory/',
	until: '2027-01-31'
};

/** True while the appeal should be shown: not past its last day, and not closed in this browser. */
export function showAppeal(appeal: Appeal, closed: string, now: Date = new Date()): boolean {
	return closed !== appeal.id && now.toISOString().slice(0, 10) <= appeal.until;
}
