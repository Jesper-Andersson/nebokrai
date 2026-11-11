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
		speaker: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
		bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
		'chevron-right': '<path d="m9 6 6 6-6 6"/>',
		'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>'
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
