<!-- Where "Anki, straight into the app" on the Saved page puts the words: the
     deck, the note type and what goes in its fields, extra tags, and whether
     notes already in Anki are updated. A Bits UI Dialog. When it opens it asks
     Anki (through AnkiConnect) which decks and note types there are; with Anki
     closed the deck can still be typed. The page that opens it keeps the
     choices. -->
<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { untrack } from 'svelte';
	import {
		ANKI_VALUES, AnkiError, NOTE_TYPE, ankiChoices, ankiFieldNames, browserInvoke, defaultFields, fieldsProblem,
		parseTags, type AnkiSettings, type AnkiValue
	} from '#lib/anki-connect.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	let { open = $bindable(false), settings, onsave }: {
		open?: boolean;
		settings: AnkiSettings;
		onsave: (settings: AnkiSettings) => void;
	} = $props();

	const site = useSettings();
	let m = $derived(messagesFor(site.lang));
	let t = $derived(m.export.ankiSettings);

	// The form's own copy: nothing is kept until Save.
	let deck = $state('');
	let noteType = $state(NOTE_TYPE);
	let fields = $state<Record<string, AnkiValue | ''>>({});
	let tags = $state('');
	let update = $state(true);

	// What Anki has. `null` while it has not answered.
	let decks = $state.raw<string[]>([]);
	let noteTypes = $state.raw<string[]>([]);
	let fieldNames = $state.raw<string[] | null>(null);
	let status = $state<'loading' | 'ready' | 'offline'>('loading');

	let own = $derived(noteType === NOTE_TYPE);
	// A chosen note type stays in the list while Anki is closed
	let listed = $derived(own || noteTypes.includes(noteType) ? noteTypes : [noteType, ...noteTypes]);
	let chosen = $derived(
		Object.fromEntries(Object.entries(fields).filter(([, value]) => value)) as Record<string, AnkiValue>
	);
	let problem = $derived(own || !fieldNames ? null : fieldsProblem(fieldNames, chosen));
	// With Anki closed the fields of another note type cannot be checked: only what was saved before may stay
	let canSave = $derived(
		deck.trim() !== '' && !problem && parseTags(tags).length > 0 && (own || fieldNames !== null || noteType === settings.noteType)
	);

	async function load() {
		status = 'loading';
		try {
			({ decks, noteTypes } = await ankiChoices(browserInvoke));
			status = 'ready';
			if (!own) await loadFields(noteType, settings.fields);
		} catch (error) {
			if (!(error instanceof AnkiError)) throw error;
			status = 'offline';
		}
	}

	// The fields of a note type, with the choices made before if they still fit, else a first guess
	async function loadFields(name: string, before: Record<string, AnkiValue>) {
		fieldNames = null;
		try {
			const names = await ankiFieldNames(browserInvoke, name);
			if (name !== noteType) return; // another one was picked meanwhile
			const kept = Object.fromEntries(names.flatMap((n) => (before[n] ? [[n, before[n]]] : [])));
			const start = fieldsProblem(names, kept) ? defaultFields(names) : kept;
			fields = Object.fromEntries(names.map((n) => [n, start[n] ?? '']));
			fieldNames = names;
		} catch (error) {
			if (!(error instanceof AnkiError)) throw error;
			// Chosen before and gone from Anki since: back to ours
			if (error.reason === 'failed') noteType = NOTE_TYPE;
			else status = 'offline';
		}
	}

	// Each time the dialog opens: the form starts from what is kept, and Anki
	// is asked what it has. An effect, not Bits UI's onOpenChange, which is
	// silent when the page that owns `open` is the one to set it.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			deck = settings.deck;
			noteType = settings.noteType;
			fields = { ...settings.fields };
			tags = settings.tags.join(' ');
			update = settings.update;
			fieldNames = null;
			void load();
		});
	});

	function pickNoteType(name: string) {
		noteType = name;
		fieldNames = null;
		if (name !== NOTE_TYPE) void loadFields(name, name === settings.noteType ? settings.fields : {});
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!canSave) return;
		onsave({
			deck: deck.trim(),
			noteType,
			fields: own ? {} : fieldNames ? chosen : settings.fields,
			tags: parseTags(tags),
			update
		});
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="ui-overlay" />
		<Dialog.Content class="ui-anki">
			<Dialog.Title class="ui-anki-title">{t.title}</Dialog.Title>
			<Dialog.Description class="ui-anki-intro">{t.intro}</Dialog.Description>

			{#if status === 'offline'}
				<p class="ui-anki-offline" role="status">
					{t.offline}
					<button type="button" class="ui-btn" onclick={load}>{m.export.ankiRetry}</button>
				</p>
			{/if}

			<form onsubmit={save}>
				<label class="ui-anki-row" for="anki-deck">
					<span>{t.deck}</span>
					<input id="anki-deck" class="ui-field" type="text" list="anki-decks" maxlength="200" autocomplete="off" bind:value={deck} />
					<small>{t.deckHint}</small>
				</label>
				<datalist id="anki-decks">
					{#each decks as name (name)}<option value={name}></option>{/each}
				</datalist>

				<label class="ui-anki-row" for="anki-note-type">
					<span>{t.noteType}</span>
					<select
						id="anki-note-type"
						class="ui-field"
						value={noteType}
						onchange={(event) => pickNoteType(event.currentTarget.value)}
					>
						<option value={NOTE_TYPE}>{t.own}</option>
						{#each listed as name (name)}<option value={name}>{name}</option>{/each}
					</select>
					{#if status === 'loading'}<small>{t.loading}</small>{/if}
				</label>

				{#if !own && fieldNames}
					<fieldset class="ui-anki-fields">
						<legend>{t.fields}</legend>
						{#each fieldNames as name (name)}
							<label>
								<span>{name}</span>
								<select class="ui-field" bind:value={fields[name]}>
									<option value="">{t.values.none}</option>
									{#each ANKI_VALUES as value (value)}<option {value}>{t.values[value]}</option>{/each}
								</select>
							</label>
						{/each}
						{#if problem}<p class="ui-anki-problem" role="alert">{t.problem[problem]}</p>{/if}
						<small>{t.ownNote}</small>
					</fieldset>
				{/if}

				<label class="ui-anki-row" for="anki-tags">
					<span>{t.tags}</span>
					<input id="anki-tags" class="ui-field" type="text" maxlength="200" autocomplete="off" bind:value={tags} />
					{#if !parseTags(tags).length}<p class="ui-anki-problem" role="alert">{t.problem.tags}</p>{/if}
					<small>{t.tagsHint}</small>
				</label>

				<label class="ui-anki-check">
					<input type="checkbox" bind:checked={update} />
					<span>
						<strong>{t.update}</strong>
						<small>{t.updateHint}</small>
					</span>
				</label>

				<div class="ui-anki-actions">
					<Dialog.Close class="ui-btn" type="button">{t.cancel}</Dialog.Close>
					<button type="submit" class="ui-btn ui-anki-save" disabled={!canSave}>{t.save}</button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	/* Everything here is rendered by Bits UI at the end of <body>, so the rules
	   are global and the class names carry a prefix of their own. */
	:global(.ui-anki) {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 50;
		box-sizing: border-box;
		width: min(30rem, calc(100vw - 20px));
		max-height: calc(100dvh - 20px);
		padding: 1.25rem 1.35rem;
		translate: -50% -50%;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-pop);
		color: var(--ink);
	}

	:global(.ui-anki:focus-visible) {
		outline: none;
	}

	:global(.ui-anki-title) {
		margin: 0;
		font-family: var(--font-heading);
		font-size: var(--text-lg);
	}

	:global(.ui-anki-intro) {
		margin: 0.25rem 0 0;
		color: var(--ink-2);
		font-size: var(--text-sm);
	}

	:global(.ui-anki form) {
		display: grid;
		gap: 1rem;
		margin-top: 1.1rem;
	}

	:global(.ui-anki-row) {
		display: grid;
		gap: 0.3rem;
	}

	:global(.ui-anki-row > span),
	:global(.ui-anki-fields legend) {
		font-size: var(--text-sm);
		font-weight: 700;
	}

	:global(.ui-anki small) {
		color: var(--muted);
		font-size: var(--text-xs);
	}

	:global(.ui-anki-fields) {
		display: grid;
		gap: 0.45rem;
		margin: 0;
		padding: 0.6rem 0.8rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	:global(.ui-anki-fields legend) {
		padding: 0 0.35rem;
	}

	/* A field's name, then what goes in it */
	:global(.ui-anki-fields label) {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
		align-items: center;
		gap: 0.75rem;
		font-size: var(--text-sm);
	}

	:global(.ui-anki-fields label span) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.ui-anki-problem) {
		margin: 0;
		color: var(--stress);
		font-size: var(--text-sm);
	}

	:global(.ui-anki-check) {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		font-size: var(--text-sm);
		cursor: pointer;
	}

	:global(.ui-anki-check span) {
		display: grid;
		gap: 0.2rem;
	}

	:global(.ui-anki-check input) {
		flex: none;
		width: 1.05rem;
		height: 1.05rem;
		margin: 0.15rem 0 0;
		accent-color: var(--accent);
	}

	:global(.ui-anki-offline) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin: 0.9rem 0 0;
		padding: 0.6rem 0.8rem;
		border-left: 3px solid var(--stress);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		font-size: var(--text-sm);
	}

	:global(.ui-anki-actions) {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	:global(.ui-anki-save) {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
	}

	:global(.ui-anki-save:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
