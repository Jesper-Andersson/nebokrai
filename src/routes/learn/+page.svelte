<!-- The pages for learning, gathered: the alphabet and its drill, the commonest
     words, the grammar words, and grammar practice. The first three were links
     in the footer until 2026-11-13, where a learner had to go looking for
     them. Each is a card that is one link, headed by a specimen of what its
     page holds. The header keeps this page's tab lit on all four (Header.svelte,
     LEARN). -->
<script lang="ts">
	import Icon from '#lib/Icon.svelte';
	import PageMeta from '#lib/PageMeta.svelte';
	import { COMMON_WORDS } from '#lib/browse.ts';
	import { HINTS } from '#lib/grammar.ts';
	import { messagesFor } from '#lib/i18n.ts';
	import { useSettings } from '#lib/settings.ts';

	const settings = useSettings();
	let m = $derived(messagesFor(settings.lang));

	// A thousand is written 1,000 in English and 1000 in Ukrainian
	let thousand = $derived(settings.lang === 'uk' ? String(COMMON_WORDS) : COMMON_WORDS.toLocaleString('en'));

	// The specimens: the first letters, how many words, and the question the
	// nominative answers (хто? що?), which is how a Ukrainian school names a case;
	// and for practice, a preposition with the gap after it that a round asks
	// you to fill (без кого? чого? — the genitive).
	let ways = $derived([
		{ href: '/alphabet', specimen: 'Аа Бб Вв', ukrainian: true, ...m.learn.alphabet },
		{ href: '/common-words', specimen: thousand, ukrainian: false, ...m.learn.common },
		{ href: '/grammar', specimen: HINTS.nominative, ukrainian: true, ...m.learn.grammar },
		{ href: '/practice', specimen: 'без ___', ukrainian: true, ...m.learn.practice }
	]);
</script>

<PageMeta title="{m.pageTitle.learn} · Nebokrai" description={m.meta.learn} />

<div class="ui-page page">
	<header>
		<h1 class="ui-title">{m.pageTitle.learn}</h1>
		<p class="lead">{m.learn.lead}</p>
	</header>

	<div class="ways">
		{#each ways as way (way.href)}
			<a class="ui-card way" href={way.href}>
				<span class="specimen" lang={way.ukrainian ? 'uk' : undefined} aria-hidden="true">{way.specimen}</span>
				<h2>{way.name}</h2>
				<p>{way.text}</p>
				<span class="go">{way.go} <Icon name="arrow-right" size={16} /></span>
			</a>
		{/each}
	</div>
</div>

<style>
	.page {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.25rem;
		padding-block: 1.75rem 2rem;
	}

	p {
		margin: 0;
	}

	/* Straight on the page, not on a card: full ink over a background photo */
	.lead {
		margin-top: 0.4rem;
		color: var(--on-page);
		font-size: var(--text-lg);
	}

	/* Two by two: four across would leave each card too narrow to read, and
	   three across would leave the fourth alone on a row. The cards of a row
	   are as tall as the tallest, and each keeps its link at the foot. */
	.ways {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.way {
		display: flex;
		flex-direction: column;
		padding: 1.25rem 1.25rem 1.1rem;
		line-height: 1.5;
	}

	/* Set as a headword is, and ruled off from what is said about it */
	.specimen {
		padding-bottom: 0.8rem;
		border-bottom: 1px solid var(--border);
		color: var(--ink);
		font-family: var(--font-headword);
		font-size: 1.75rem;
		font-weight: 800;
		line-height: 1.2;
		white-space: nowrap;
	}

	h2 {
		margin: 0.9rem 0 0.3rem;
		font-family: var(--font-heading);
		font-size: 1.3rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.way p {
		color: var(--ink-2);
	}

	.go {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: auto;
		padding-top: 1rem;
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	@media (hover: hover) {
		.way:hover {
			border-color: var(--accent);
		}

		.way:hover h2 {
			color: var(--accent);
		}
	}

	/* Narrower than two cards can be read in: one under another, set a
	   little closer */
	@media (max-width: 600px) {
		.page {
			gap: 1rem;
			padding-top: 1rem;
		}

		.ways {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.75rem;
		}

		.way {
			padding: 1rem 1.1rem;
		}

		.specimen {
			font-size: 1.5rem;
		}

		.go {
			padding-top: 0.7rem;
		}
	}
</style>
