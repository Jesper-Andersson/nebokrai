<!-- Text from docs/sources-and-licences.md. The per-item credits it describes
     (Wiktionary, Tatoeba and Commons links) are on each word's Details page. -->
<svelte:head>
	<title>Sources and licences · Nebokrai</title>
</svelte:head>

<article>
	<h1>Sources and licences</h1>

	<p class="lead">
		Nebokrai is built from open data made by volunteers. Thank you to all of them.
	</p>

	<h2>Where the dictionary comes from</h2>

	<dl>
		<dt>Words, meanings, pronunciation and inflection tables</dt>
		<dd>
			<a href="https://en.wiktionary.org/">Wiktionary</a>, the free dictionary, extracted with
			<a href="https://github.com/tatuylonen/wiktextract">Wiktextract</a> and published by
			<a href="https://kaikki.org/">kaikki.org</a>. Available under the
			<a href="https://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution-ShareAlike 4.0</a>
			licence. The authors of each entry are listed in its Wiktionary page history.
		</dd>

		<dt>Audio recordings</dt>
		<dd>
			Hosted by <a href="https://commons.wikimedia.org/">Wikimedia Commons</a>. Each recording has
			its own author and licence, shown on its Commons page.
		</dd>

		<dt>Example sentences</dt>
		<dd>
			<a href="https://tatoeba.org/">Tatoeba</a>, available under the
			<a href="https://creativecommons.org/licenses/by/2.0/fr/">Creative Commons Attribution 2.0 France</a>
			licence. Each sentence's Tatoeba page names its author.
		</dd>

		<dt>Word frequency</dt>
		<dd>
			<a href="https://github.com/hermitdave/FrequencyWords">FrequencyWords</a> by Hermit Dave
			(<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>), based on film
			and television subtitles from <a href="https://www.opensubtitles.org/">OpenSubtitles</a>
			collected in the <a href="https://opus.nlpl.eu/">OPUS</a> corpus.
		</dd>

		<dt>Recognising word forms missing from Wiktionary</dt>
		<dd>
			The <a href="https://github.com/brown-uk/dict_uk">Large Electronic Dictionary of Ukrainian (VESUM)</a>
			by Andriy Rysin, Vasyl Starko and the BrUK team, available under the
			<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0</a>
			licence.
		</dd>
	</dl>

	<h2>Using our data</h2>
	<p>
		The dictionary data shown on this site, apart from VESUM, is available under
		<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. You may copy and
		adapt it if you give credit and share your version under the same licence. VESUM data stays
		under its own non-commercial licence.
	</p>
	<p>Nebokrai is a non-commercial project.</p>

	<h2>Found a mistake?</h2>
	<p>
		Most mistakes come from the sources. You can <a href="/report">report an issue</a>, and many
		mistakes can be fixed directly on Wiktionary or Tatoeba, which improves them for everyone.
	</p>
</article>

<style>
	article {
		box-sizing: border-box;
		max-width: 44rem;
		margin: 1.5rem auto 2rem;
		padding: 1.5rem 1.75rem 1.75rem;
		border-radius: 6px;
		background: var(--panel);
		color: var(--ink);
		line-height: 1.6;
		text-align: left;
	}

	h1,
	h2 {
		font-family: var(--font-heading);
		font-weight: 700;
		line-height: 1.2;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: clamp(1.6rem, 4vw, 2rem);
	}

	h2 {
		margin: 1.75rem 0 0.5rem;
		font-size: 1.3rem;
	}

	.lead {
		margin-top: 0;
		font-size: 1.1rem;
	}

	dt {
		margin-top: 1rem;
		font-weight: 800;
	}

	dd {
		margin: 0.2rem 0 0;
	}

	p {
		margin: 0.5rem 0;
	}

	a {
		color: var(--link);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	a:hover {
		color: var(--link-hover);
	}

	@media (max-width: 600px) {
		article {
			margin-top: 1rem;
			padding: 1.1rem 1.1rem 1.3rem;
		}
	}
</style>
