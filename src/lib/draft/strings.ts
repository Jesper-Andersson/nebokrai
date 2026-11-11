// Interface text that only the draft redesign uses. It follows i18n.ts
// (`uk` is typed as `typeof en`, so a missing key fails `npm run check`) and
// moves there if the draft is adopted.
import type { Lang } from '#lib/settings.ts';

const en = {
	draft: 'Draft',
	draftTitle: 'This is a draft design. Open the current design.',
	nav: 'Main',
	tagline: 'Type in Ukrainian, English or Latin letters. Inflected forms and near misses are recognised too.',
	tryLabel: 'Try',
	quick: {
		open: 'Search',
		title: 'Quick search',
		hint: 'Type a word in Ukrainian or English.',
		navigate: 'to move',
		select: 'to open',
		close: 'to close'
	},
	toast: {
		saved: 'Saved',
		removed: 'Removed from saved',
		undo: 'Undo',
		dismiss: 'Dismiss'
	},
	entries: 'Entries on this page'
};

const uk: typeof en = {
	draft: 'Чернетка',
	draftTitle: 'Це чернетка дизайну. Відкрити поточний дизайн.',
	nav: 'Головне меню',
	tagline: 'Пишіть українською, англійською чи латинкою. Словоформи й неточне написання теж розпізнаються.',
	tryLabel: 'Спробуйте',
	quick: {
		open: 'Пошук',
		title: 'Швидкий пошук',
		hint: 'Введіть слово українською чи англійською.',
		navigate: 'вибрати',
		select: 'відкрити',
		close: 'закрити'
	},
	toast: {
		saved: 'Збережено',
		removed: 'Прибрано зі збереженого',
		undo: 'Скасувати',
		dismiss: 'Закрити'
	},
	entries: 'Статті на цій сторінці'
};

const strings = { en, uk };

export function draftStrings(lang: Lang): typeof en {
	return strings[lang];
}
