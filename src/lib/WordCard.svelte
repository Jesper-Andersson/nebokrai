<script lang="ts">
	import type { Entry } from '#lib';

	let { entry }: { entry: Entry } = $props();

	let saved = $state(false);

	function speak() {
		const utterance = new SpeechSynthesisUtterance(entry.word.replace(/́/g, ''));
		utterance.lang = 'uk-UA';
		speechSynthesis.speak(utterance);
	}
</script>

<!-- Renders a word with its stressed vowel (letter + U+0301) in red -->
{#snippet stressed(text: string)}{#each text.split(/(.́)/) as part}{#if part.endsWith('́')}<span class="stress">{part}</span>{:else}{part}{/if}{/each}{/snippet}

<article class="card">
	<div class="entry">
		<p class="meta">
			<span class="pos">{entry.partOfSpeech}</span>
			{entry.tags.join(' - ')}
		</p>
		<p class="word">
			<span lang="uk">{@render stressed(entry.word)}</span>
			<button class="icon play" aria-label="Play pronunciation" onclick={speak}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<polygon points="10 8 16 12 10 16 10 8" />
				</svg>
			</button>
		</p>
		{#if entry.genitive}
			<p class="forms">
				(Gen) <b lang="uk">{@render stressed(entry.genitive)}</b>
			</p>
		{/if}
	</div>

	<p class="translations">{entry.translations.join(', ')}</p>

	<div class="actions">
		<button
			class="icon"
			aria-label={saved ? 'Remove from saved' : 'Save word'}
			aria-pressed={saved}
			onclick={() => (saved = !saved)}
		>
			<svg
				viewBox="0 0 24 24"
				fill={saved ? 'currentColor' : 'none'}
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linejoin="round"
			>
				<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
			</svg>
		</button>
		<a href="/word/{entry.latin}">Details</a>
	</div>
</article>

<style>
	.card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		padding: 0.25rem 0.6rem 0.5rem 0.8rem;
		border-radius: 6px;
		background: #f7f8fc;
		color: #111;
		font-family: 'Nunito', sans-serif;
		text-align: left;
	}

	p {
		margin: 0;
	}

	.meta {
		font-size: 0.85rem;
	}

	.pos {
		margin-right: 0.3rem;
		color: #333;
		font-family: 'Nyght Serif', serif;
		font-size: 1.15rem;
		font-weight: 700;
	}

	.word {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 1.6rem;
		font-weight: 800;
		line-height: 1.3;
	}

	.stress {
		color: #e3101b;
	}

	.forms {
		font-size: 0.8rem;
	}

	.forms b {
		font-size: 1.1rem;
		font-weight: 800;
	}

	.translations {
		display: flex;
		align-items: center;
		margin-block: 0.6rem;
		padding-left: 2.5rem;
		border-left: 1.5px solid #222;
		font-size: 1.3rem;
	}

	.actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-top: 0.3rem;
	}

	.actions a {
		margin-block: auto;
		font-family: 'Nyght Serif', serif;
		font-weight: 700;
		text-decoration: underline;
	}

	.icon {
		display: inline-flex;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}

	.icon svg {
		width: 1.3rem;
		height: 1.3rem;
	}

	.play {
		color: #1f8ac0;
	}

	/* Phones: translations go under the word instead of beside it */
	@media (max-width: 600px) {
		.card {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.translations {
			grid-column: 1;
			margin: 0.3rem 0 0;
			padding-left: 0;
			border-left: 0;
			font-size: 1.1rem;
		}

		.actions {
			grid-row: 1 / span 2;
			grid-column: 2;
		}
	}
</style>
