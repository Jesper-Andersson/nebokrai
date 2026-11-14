<!-- The line icons, drawn on a 24px grid. Decorative: the button or
     link around an icon carries the label. -->
<script lang="ts" module>
	const PATHS = {
		search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
		// Sliders, for the settings
		settings:
			'<path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
		keyboard:
			'<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12.5h.01M10 12.5h.01M14 12.5h.01M18 12.5h.01M8 16h8"/>',
		x: '<path d="M6 6l12 12M18 6 6 18"/>',
		// A question mark in a ring: how something works
		help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>',
		// Two cards, one behind the other: the flashcards
		cards: '<rect x="3" y="7" width="14" height="13" rx="2.5"/><path d="M7 4h11.5A2.5 2.5 0 0 1 21 6.5V16"/>',
		'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
		// Put away, not closed for good: the radio's panel
		minus: '<path d="M6 12h12"/>',
		speaker: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
		// The speaker with a cross where its sound would be: muted
		'speaker-off': '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6M22 9l-6 6"/>',
		bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
		// Three lines with a dot before each: the lists saved words are sorted into
		list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
		'chevron-right': '<path d="m9 6 6 6-6 6"/>',
		// A speech bubble: words as they are spoken (/common-words)
		message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
		// A table of four cells: the grammar words set out (/grammar)
		table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M12 3v18"/>',
		check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
		download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
		// An arrow leaving a tray: pass this on
		share: '<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
		'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
		// The four themes: as the system has it, light, sepia (an open book), dark
		monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
		sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
		book: '<path d="M12 7c-1.6-1.5-4.2-2-9-2v13c4.8 0 7.4.5 9 2 1.6-1.5 4.2-2 9-2V5c-4.8 0-7.4.5-9 2zM12 7v13"/>',
		moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
		// A radio set with its aerial up; and the two things to do with one
		radio:
			'<rect x="3" y="9" width="18" height="11" rx="2.5"/><path d="m7 9 9.5-5M14.5 13.5h3M14.5 16.5h3"/><circle cx="8.5" cy="14.5" r="2.3"/>',
		play: '<path d="M8 5.5v13l10.5-6.5z"/>',
		stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>'
	};

	export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
	let { name, size = 18, filled = false }: { name: IconName; size?: number; filled?: boolean } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill={filled ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{@html PATHS[name]}
</svg>

<style>
	svg {
		flex: none;
	}
</style>
