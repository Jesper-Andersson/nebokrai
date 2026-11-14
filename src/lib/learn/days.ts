// Names of days for the Learn page's rail (StreakCard, ActivityCard). A day
// is a number of days since 1970 (fsrs.ts `dayNumber`), read in UTC so that
// the name is the day's own wherever the browser is.
import { DAY } from '../review/fsrs.ts';

/** "Fri" or "F" under a bar or a flame. */
export const weekday = (locale: string, n: number, width: 'short' | 'narrow'): string =>
	new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(n * DAY);

/** "Friday 14 November", for a day's tooltip and for screen readers. */
export const dayName = (locale: string, n: number): string =>
	new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(n * DAY);
