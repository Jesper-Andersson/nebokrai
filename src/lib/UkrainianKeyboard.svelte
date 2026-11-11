<!-- An on-screen Ukrainian keyboard inside the search box (see +page.svelte).
     Keys never take focus, so the search box keeps its cursor.

     Two layouts, chosen in the settings menu. The grid is 24 columns, half a
     key each, and every row fills it, so all rows end at the same edges.

     Standard (ЙЦУКЕН), as on phone keyboards:
       й ц у к е н г ш щ з х ї
        ф і в а п р о л д ж є          (half a key in on each side)
       ⇧  я ч с м и т ь б ю  ⌫
       '  ⌨  [     space    ]  ´

     Phonetic: xkb "Ukrainian (homophonic)", based on the national
     romanisation. Each key shows the Latin key it sits on.
       я ш е р т и у і о п ю щ         q w e r t y u i o p [ ]
       а с д ф ґ г й к л ч ж ь         a s d f g h j k l ; ' \
       ⇧  з х ц в б н м є ї  ⌫         z x c v b n m - =
       '  ⌨  [     space    ]  ´

     ґ (standard layout): computer layouts put it on a key outside the letter
     rows (backslash on Linux and macOS, the extra key left of Z on Windows
     "Ukrainian (Enhanced)"), and Windows also types it with AltGr + г. Phone
     keyboards type it by holding г. There is no outer key here, so holding г
     types ґ, and the г key shows a small ґ in its corner, as keycaps do.
     The apostrophe's real key is top left (left of 1); without a number row,
     the nearest free place is bottom left. Source: xkeyboard-config symbols/ua.

     Physical keyboard: while the search box has focus, keys are read by their
     position (KeyboardEvent.code), so a US keyboard types Ukrainian in the
     chosen layout, and the matching on-screen key moves as if clicked. The ⌨
     key turns this on and off; the choice is kept in this browser.

     ´ (draft): the stress mark. It adds U+0301 after the vowel before the
     cursor, or removes it if it's already there. Search ignores stress, so a
     stressed query finds the same words. On a physical keyboard: AltGr + the
     key left of 1, as on Linux. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let {
		id,
		input,
		oninsert,
		onbackspace,
		onstress
	}: {
		id: string;
		/** The search box. Physical keys are only read while it has focus. */
		input: HTMLInputElement | undefined;
		oninsert: (text: string) => void;
		onbackspace: () => void;
		onstress: () => void;
	} = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	type Letter = { kind: 'letter'; id: string; letter: string; code: string; hint?: string; alt?: string };
	type Special = { kind: 'shift' | 'backspace' | 'space' | 'stress' | 'physical'; id: string };
	type Key = (Letter | Special) & { col: number; span: number };

	const U = 2; // one key = 2 grid columns

	// [letter, physical key code, Latin hint shown on the key]
	type Spec = [string, string, string?];

	function row(specs: Spec[], startCol: number, alts: Record<string, string> = {}): Key[] {
		return specs.map(([letter, code, hint], i) => ({
			kind: 'letter',
			id: code,
			letter,
			code,
			hint,
			alt: alts[letter],
			col: startCol + i * U,
			span: U
		}));
	}

	const shiftKey: Key = { kind: 'shift', id: 'shift', col: 1, span: 3 };
	const backspaceKey: Key = { kind: 'backspace', id: 'backspace', col: 22, span: 3 };
	const bottomRow: Key[] = [
		{ kind: 'letter', id: 'Backquote', letter: "'", code: 'Backquote', col: 1, span: 3 },
		{ kind: 'physical', id: 'physical', col: 4, span: 3 },
		{ kind: 'space', id: 'space', col: 7, span: 15 },
		{ kind: 'stress', id: 'stress', col: 22, span: 3 }
	];

	const STANDARD: Key[][] = [
		row(
			[
				['й', 'KeyQ'], ['ц', 'KeyW'], ['у', 'KeyE'], ['к', 'KeyR'], ['е', 'KeyT'], ['н', 'KeyY'],
				['г', 'KeyU'], ['ш', 'KeyI'], ['щ', 'KeyO'], ['з', 'KeyP'], ['х', 'BracketLeft'], ['ї', 'BracketRight']
			],
			1,
			{ г: 'ґ' }
		),
		row(
			[
				['ф', 'KeyA'], ['і', 'KeyS'], ['в', 'KeyD'], ['а', 'KeyF'], ['п', 'KeyG'], ['р', 'KeyH'],
				['о', 'KeyJ'], ['л', 'KeyK'], ['д', 'KeyL'], ['ж', 'Semicolon'], ['є', 'Quote']
			],
			2
		),
		[
			shiftKey,
			...row(
				[
					['я', 'KeyZ'], ['ч', 'KeyX'], ['с', 'KeyC'], ['м', 'KeyV'], ['и', 'KeyB'],
					['т', 'KeyN'], ['ь', 'KeyM'], ['б', 'Comma'], ['ю', 'Period']
				],
				4
			),
			backspaceKey
		],
		bottomRow
	];

	const PHONETIC: Key[][] = [
		row(
			[
				['я', 'KeyQ', 'q'], ['ш', 'KeyW', 'w'], ['е', 'KeyE', 'e'], ['р', 'KeyR', 'r'], ['т', 'KeyT', 't'],
				['и', 'KeyY', 'y'], ['у', 'KeyU', 'u'], ['і', 'KeyI', 'i'], ['о', 'KeyO', 'o'], ['п', 'KeyP', 'p'],
				['ю', 'BracketLeft', '['], ['щ', 'BracketRight', ']']
			],
			1
		),
		row(
			[
				['а', 'KeyA', 'a'], ['с', 'KeyS', 's'], ['д', 'KeyD', 'd'], ['ф', 'KeyF', 'f'], ['ґ', 'KeyG', 'g'],
				['г', 'KeyH', 'h'], ['й', 'KeyJ', 'j'], ['к', 'KeyK', 'k'], ['л', 'KeyL', 'l'], ['ч', 'Semicolon', ';'],
				['ж', 'Quote', "'"], ['ь', 'Backslash', '\\']
			],
			1
		),
		[
			shiftKey,
			...row(
				[
					['з', 'KeyZ', 'z'], ['х', 'KeyX', 'x'], ['ц', 'KeyC', 'c'], ['в', 'KeyV', 'v'], ['б', 'KeyB', 'b'],
					['н', 'KeyN', 'n'], ['м', 'KeyM', 'm'], ['є', 'Minus', '-'], ['ї', 'Equal', '=']
				],
				4
			),
			backspaceKey
		],
		bottomRow
	];

	let rows = $derived(settings.layout === 'phonetic' ? PHONETIC : STANDARD);
	let byCode = $derived(
		new Map(rows.flat().flatMap((k) => (k.kind === 'letter' ? [[k.code, k] as const] : [])))
	);

	// Shift capitalises the next letter only, like a phone keyboard.
	let shift = $state(false);
	const cased = (letter: string) => (shift ? letter.toUpperCase() : letter);

	function type(letter: string) {
		oninsert(cased(letter));
		shift = false;
	}

	function press(key: Key) {
		// The hold already did the key's work (typed ґ, or deleted); the click
		// that ends the hold must not type г or delete once more.
		if (held === key) {
			held = null;
			return;
		}
		if (key.kind === 'letter') {
			type(key.letter);
		} else if (key.kind === 'shift') {
			shift = !shift;
		} else if (key.kind === 'backspace') {
			onbackspace();
		} else if (key.kind === 'stress') {
			onstress();
		} else if (key.kind === 'physical') {
			setPhysical(!physical);
		} else {
			oninsert(' ');
		}
	}

	// Holding a key with a second letter types that letter instead.
	const HOLD_MS = 450;
	let timer: ReturnType<typeof setTimeout> | undefined;
	// $state.raw: plain $state would wrap the key in a proxy, and the
	// `held === key` checks would never match (so a hold typed ґ and then г).
	let held: Key | null = $state.raw(null);

	// Holding ⌫ keeps deleting, as on a phone keyboard.
	const REPEAT_MS = 70;
	let repeat: ReturnType<typeof setInterval> | undefined;

	function down(event: PointerEvent, key: Key) {
		event.preventDefault(); // keep focus (and the caret) in the search box
		held = null;
		if (key.kind === 'backspace') {
			timer = setTimeout(() => {
				held = key;
				onbackspace();
				repeat = setInterval(onbackspace, REPEAT_MS);
			}, HOLD_MS);
			return;
		}
		if (key.kind !== 'letter' || !key.alt) return;
		const alt = key.alt;
		timer = setTimeout(() => {
			held = key;
			type(alt);
		}, HOLD_MS);
	}

	function up() {
		clearTimeout(timer);
		clearInterval(repeat);
	}

	// ---- Physical keyboard ----

	// Whether the physical keyboard types Ukrainian. On unless turned off; kept in
	// this browser only, and the keyboard works the same if storage is blocked.
	const PHYSICAL_KEY = 'nebokrai-physical-keys';
	let physical = $state(true);

	onMount(() => {
		try {
			physical = localStorage.getItem(PHYSICAL_KEY) !== 'off';
		} catch {}
	});

	function setPhysical(on: boolean) {
		physical = on;
		pressed = {};
		try {
			localStorage.setItem(PHYSICAL_KEY, on ? 'on' : 'off');
		} catch {}
	}

	// On-screen keys held down on the physical keyboard, by key id.
	let pressed: Record<string, boolean> = $state({});

	const SPECIAL_CODES: Record<string, string> = {
		ShiftLeft: 'shift',
		ShiftRight: 'shift',
		Backspace: 'backspace',
		Space: 'space'
	};

	function onkeydown(event: KeyboardEvent) {
		if (!physical || !input || event.target !== input || event.isComposing) return;
		const altGr = event.getModifierState('AltGraph') || (event.ctrlKey && event.altKey);
		// Leave shortcuts (Ctrl+A, Cmd+C…) alone.
		if (!altGr && (event.ctrlKey || event.metaKey || event.altKey)) return;

		// AltGr + the key left of 1: the stress mark (as on Linux).
		if (altGr && event.code === 'Backquote') {
			event.preventDefault();
			pressed.stress = true;
			onstress();
			return;
		}

		const special = SPECIAL_CODES[event.code];
		if (special) {
			pressed[special] = true; // typing itself is the browser's own
			return;
		}

		let key = byCode.get(event.code);
		let letter = key?.kind === 'letter' ? key.letter : undefined;
		if (settings.layout === 'standard') {
			// ґ: AltGr + г (Windows), or its own key (Linux, macOS, Windows Enhanced).
			if (altGr && event.code === 'KeyU') letter = 'ґ';
			else if (altGr) return;
			if (event.code === 'Backslash' || event.code === 'IntlBackslash') {
				key = byCode.get('KeyU');
				letter = 'ґ';
			}
		} else if (altGr) {
			return;
		}
		if (!key || !letter) return;

		event.preventDefault();
		pressed[key.id] = true;
		const upper = event.shiftKey !== event.getModifierState('CapsLock') || shift;
		oninsert(upper ? letter.toUpperCase() : letter);
		shift = false;
	}

	function onkeyup(event: KeyboardEvent) {
		const id =
			SPECIAL_CODES[event.code] ??
			(event.code === 'Backquote' && pressed.stress ? 'stress' : undefined) ??
			(event.code === 'Backslash' || event.code === 'IntlBackslash' ? 'KeyU' : undefined) ??
			byCode.get(event.code)?.id;
		if (id) pressed[id] = false;
		if (event.code === 'Backquote') pressed.Backquote = false;
	}

	// A key released while the window was in the background never sends keyup.
	const release = () => (pressed = {});

	const label = (key: Key) =>
		key.kind === 'shift'
			? m.keyboard.shift
			: key.kind === 'backspace'
				? m.keyboard.backspace
				: key.kind === 'stress'
					? m.keyboard.stress
					: key.kind === 'physical'
					? m.keyboard.physical
					: key.kind === 'letter' && key.alt
						? m.keyboard.holdFor(key.letter, key.alt)
						: undefined;
</script>

<svelte:window {onkeydown} {onkeyup} onblur={release} />

<div class="keyboard" {id} role="group" aria-label={m.keyboard.label} lang="uk">
	{#each rows as keys, r (r)}
		{#each keys as key (`${r}-${key.id}`)}
			<button
				type="button"
				class="key {key.kind}"
				class:held={held === key}
				class:down={pressed[key.id]}
				style:grid-row={r + 1}
				style:grid-column="{key.col} / span {key.span}"
				aria-label={label(key)}
				title={label(key)}
				aria-pressed={key.kind === 'shift' ? shift : key.kind === 'physical' ? physical : undefined}
				onpointerdown={(event) => down(event, key)}
				onpointerup={up}
				onpointerleave={up}
				onpointercancel={up}
				oncontextmenu={(event) => event.preventDefault()}
				onclick={() => press(key)}
			>
				{#if key.kind === 'letter'}
					{cased(held === key && key.alt ? key.alt : key.letter)}
					{#if key.alt}<span class="alt" aria-hidden="true">{cased(key.alt)}</span>{/if}
					{#if key.hint}<span class="hint" aria-hidden="true">{key.hint}</span>{/if}
				{:else if key.kind === 'shift'}⇧
				{:else if key.kind === 'backspace'}⌫
				{:else if key.kind === 'stress'}<span class="accent" aria-hidden="true">´</span>
			{:else if key.kind === 'physical'}<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					aria-hidden="true"
					><rect x="2" y="5" width="20" height="14" rx="2.5" /><path
						d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12.5h.01M10 12.5h.01M14 12.5h.01M18 12.5h.01M8 16h8"
					/></svg
				>
				{:else}{m.keyboard.space}{/if}
			</button>
		{/each}
	{/each}
</div>

<style>
	.keyboard {
		display: grid;
		grid-template-columns: repeat(24, minmax(0, 1fr));
		gap: 5px 0;
		padding: 0.7rem 0.7rem 0.8rem;
		border-top: 1px solid var(--border);
		background: var(--surface-2);
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		-webkit-touch-callout: none;
	}

	/* The gap between keys is a margin, so every key keeps the same width */
	.key {
		position: relative;
		min-width: 0;
		height: 2.6rem;
		margin: 0 2px;
		padding: 0;
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: 6px;
		background: var(--surface);
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
	}

	/* Not on touch screens: there the hover border stays on the last key tapped */
	@media (hover: hover) {
		.key:hover {
			border-color: var(--faint);
		}
	}

	/* Pressed: by mouse or finger (:active), or on the physical keyboard (.down) */
	.key:active,
	.key.down {
		translate: 0 1px;
		border-bottom-width: 1px;
		background: var(--border);
	}

	.key:focus-visible {
		outline: 3px solid #5b8fd6;
		outline-offset: 1px;
	}

	.shift,
	.backspace,
	.space {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: 1.05rem;
	}

	.space {
		font-size: 0.85rem;
		font-weight: 600;
	}

	/* Stress mark key (draft) */
	.accent {
		color: var(--stress);
		font-family: var(--font-text);
		font-size: 1.6rem;
		line-height: 0.6;
		vertical-align: -0.35em;
	}

	/* The second letter of a key (ґ on г), typed by holding the key */
	.alt {
		position: absolute;
		top: 3px;
		right: 5px;
		color: var(--faint);
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 1;
	}

	/* Phonetic layout: the Latin key a letter sits on */
	.hint {
		position: absolute;
		top: 3px;
		left: 5px;
		color: var(--faint);
		font-family: var(--font-text);
		font-size: 0.65rem;
		font-weight: 600;
		line-height: 1;
	}

	.held {
		border-color: #5b8fd6;
		background: #5b8fd6;
		color: #ffffff;
	}

	.held .alt {
		visibility: hidden;
	}

	.physical {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
	}

	.physical svg {
		width: 1.35rem;
		height: 1.35rem;
	}

	.shift[aria-pressed='true'],
	.physical[aria-pressed='true'] {
		border-color: #5b8fd6;
		background: #5b8fd6;
		color: #ffffff;
	}

	@media (max-width: 520px) {
		.keyboard {
			gap: 4px 0;
			padding: 0.5rem 0.3rem 0.6rem;
		}

		.key {
			height: 2.4rem;
			margin: 0 1px;
			border-radius: 4px;
			font-size: 0.95rem;
		}

		.shift,
		.backspace {
			font-size: 0.9rem;
		}

		.hint {
			display: none;
		}
	}

	/* Touch screens: keys as tall as a phone keyboard's (44px). Twelve keys
	   across a 390px phone leaves each 28px wide, so height is where the room is. */
	@media (pointer: coarse) {
		.key {
			height: 2.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.key:active,
		.key.down {
			translate: none;
		}
	}
</style>
