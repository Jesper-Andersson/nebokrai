<!-- The word of the day, under the search box while nothing is typed: the
     card a search result has, with the label and one example sentence in the
     same frame (option B of the main-page design, user, 2026-11-14).

       WORD OF THE DAY
       тра́вма 🔈 noun · feminine (вона)  │ trauma, injury (…)        ☐ ›
       ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
       │ На щастя, він уникнув травми.
       │ ░░ ░░░░░░ ░░░░░░, ░░░░░░░

     With "Hide translations" on, the meanings are blurred as the example's
     English is: the learner did not choose this word, so it can be guessed
     first. Latin letters and the phonetic alphabet are left to the word's
     page, as a search result leaves them. -->
<script lang="ts">
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';
	import type { WordOfDay } from '#lib/word-of-day.ts';
	import Translation from './Translation.svelte';
	import WordCard from './WordCard.svelte';

	let { entry }: { entry: WordOfDay } = $props();

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	const label = (tag: string) => tag.replace(/-/g, ' ');
	// A meaning's own tags go before it, as the word's page sets them: (colloquial) mate
	let card = $derived({
		...entry,
		glosses: entry.senses.map((s) => (s.tags.length ? `(${s.tags.map(label).join(', ')}) ${s.gloss}` : s.gloss))
	});
</script>

<section class="ui-page" aria-labelledby="word-of-day">
	<div class="ui-card">
		<h2 id="word-of-day" class="ui-label">{m.home.wordOfDay}</h2>
		<WordCard entry={card} framed={false} hideMeanings />
		<div class="example">
			<p>
				<span lang="uk">{entry.example.uk}</span>
				<Translation text={entry.example.en} />
				<!-- Tatoeba's licence asks for the sentence's source to be named -->
				<a class="credit" href="https://tatoeba.org/sentences/show/{entry.example.tatoeba_id}">
					Tatoeba #{entry.example.tatoeba_id}
				</a>
			</p>
		</div>
	</div>
</section>

<style>
	/* Close under the search box, which is 1rem above (the hero's margin, in
	   the search page) */
	section {
		margin-top: 0.5rem;
	}

	.ui-card {
		overflow: hidden;
		padding-bottom: 0.75rem;
	}

	/* Lined up with the card's word, at its left padding */
	h2 {
		margin: 0.7rem 1rem 0;
		color: var(--muted);
	}

	/* No rule running from it to the edge: inside an entry the rule divides one
	   part from the next, and here there is nothing on the line to divide */
	h2::after {
		content: none;
	}

	/* Set off from the meanings by the dashed rule a result's "Form found"
	   has, so it is not read as one more meaning */
	.example {
		margin: 0.25rem 1rem 0;
		padding-top: 0.6rem;
		border-top: 1px dashed var(--border);
	}

	p {
		margin: 0;
		padding-left: 0.75rem;
		border-left: 2px solid var(--border-strong);
		line-height: 1.5;
	}

	.credit {
		color: var(--muted);
		font-size: var(--text-xs);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	@media (max-width: 600px) {
		h2 {
			margin: 0.55rem 0.8rem 0;
		}

		.example {
			margin: 0.2rem 0.8rem 0;
			padding-top: 0.5rem;
		}
	}

	/* A low desktop window (a 768px laptop screen leaves the page some 650px):
	   the search page is kept from scrolling (+page.svelte), and the example
	   sentence is what the card can best do without. The word's page has it. */
	@media (min-width: 701px) and (max-height: 690px) {
		.example {
			display: none;
		}
	}
</style>
