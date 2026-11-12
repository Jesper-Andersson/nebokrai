<!-- Text from docs/sources-and-licences.md. The per-item credits it describes
     (Wiktionary, Tatoeba and Commons links) are on each word's Details page.
     The radio stations are named from the player's own list, so the two
     cannot differ. -->
<script lang="ts">
	import { STATIONS } from '#lib/radio.ts';
	import TextPage from '#lib/TextPage.svelte';
</script>

<TextPage
	title="Sources and licences"
	description="Where Nebokrai’s words, frequency ranks, example sentences and recordings come from, and the licence of each source."
>
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
			<!-- Worded as VESUM's README asks to be cited. It gives no version
			     number: the package we read is a snapshot that does not name one. -->
			Rysin, A., Starko, V. Large Electronic Dictionary of Ukrainian (VESUM). 2005–2022. Available
			at: <a href="https://vesum.nlp.net.ua/">https://vesum.nlp.net.ua/</a>
		</dd>
		<dd>
			By Andriy Rysin, Vasyl Starko and the BrUK team, with the data published at
			<a href="https://github.com/brown-uk/dict_uk">brown-uk/dict_uk</a> under the
			<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0</a>
			licence. Nebokrai reads it from the pymorphy3-dicts-uk package, a snapshot from 2022.
		</dd>
	</dl>

	<h2>Background photos</h2>
	<p>
		The two photos you can choose as a background in the settings are
		<a href="https://unsplash.com/photos/Y4aVJso5J_c">a field of yellow flowers under a blue sky</a>
		by Igor Karimov on Unsplash (<a href="https://unsplash.com/license">Unsplash Licence</a>) and
		<a href="https://www.pexels.com/photo/28041738/">a green hill with trees and fog</a>
		by neslihan on Pexels (<a href="https://www.pexels.com/license/">Pexels Licence</a>).
	</p>

	<h2>Logos of the funds</h2>
	<p>
		The logos on the <a href="/support">Support Ukraine</a> page belong to the organisations they
		stand for. Each was taken from that organisation’s own site and is shown only to say whose link
		it is. None of the licences above covers them.
	</p>

	<h2>Radio</h2>
	<p>
		The radio you can switch on in the settings plays Ukrainian stations:
		{#each STATIONS as station, i (station.id)}
			{#if i}{i === STATIONS.length - 1 ? ' and ' : ', '}{/if}<a href={station.home} lang="uk">{station.name}</a
			>{/each}. Each stream is the station’s own and comes straight from the station’s server to your
		browser; Nebokrai stores and re-broadcasts nothing. The programmes, and any advertising in
		them, belong to the stations, and Nebokrai earns nothing from them. The name of the song is the
		station’s own text: what it sends with its stream, or what its own player lists. The moving bars that show a
		station is on air follow an animation by Sam Herbert
		(<a href="https://github.com/SamHerbert/SVG-Loaders">SVG Loaders</a>,
		<a href="https://github.com/SamHerbert/SVG-Loaders/blob/master/LICENSE.md">MIT licence</a>).
	</p>

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
</TextPage>

<style>
	dt {
		margin-top: 1rem;
		font-weight: 700;
	}

	dd {
		margin: 0.2rem 0 0;
	}

</style>
