# Sources and licences

The text of the site's [Sources page](https://nebokrai.app/sources)
(`src/routes/sources/+page.svelte`), followed by what each licence asks of the
site and where the site does it.

---

## Page text

### Where the dictionary comes from

Nebokrai is built from open data made by volunteers. Thank you to all of them.

**Words, meanings, pronunciation and inflection tables** come from
[Wiktionary](https://en.wiktionary.org/), the free dictionary, extracted with
[Wiktextract](https://github.com/tatuylonen/wiktextract) and published by
[kaikki.org](https://kaikki.org/). The text is available under the
[Creative Commons Attribution-ShareAlike 4.0 licence](https://creativecommons.org/licenses/by-sa/4.0/).
Each word page links to its Wiktionary entry, where the authors are listed in
the page history.

**Audio recordings** are hosted by
[Wikimedia Commons](https://commons.wikimedia.org/). Each recording has its own
author and licence, shown on its Commons page, which is linked next to the
play button. The letters on the alphabet page are read by
[Tabrus](https://commons.wikimedia.org/wiki/Category:Ukrainian_pronunciation_of_letters_by_a_young_male_uploaded_by_Tabrus),
under the
[Creative Commons Attribution-ShareAlike 4.0 licence](https://creativecommons.org/licenses/by-sa/4.0/).
The site plays its own copies of them, each cut down to the letter and cleaned
of noise; the copies are available under the same licence.

**Example sentences** come from [Tatoeba](https://tatoeba.org/) and are
available under the
[Creative Commons Attribution 2.0 France licence](https://creativecommons.org/licenses/by/2.0/fr/).
Each sentence links to its Tatoeba page, which names its author.

**Word frequency** is calculated from
[FrequencyWords](https://github.com/hermitdave/FrequencyWords) by Hermit Dave
(CC BY-SA 4.0), which is based on film and television subtitles from
[OpenSubtitles](https://www.opensubtitles.org/) collected in the
[OPUS](https://opus.nlpl.eu/) corpus.

**Recognising word forms** that are missing from Wiktionary:
Rysin, A., Starko, V. Large Electronic Dictionary of Ukrainian (VESUM).
2005–2022. Available at: <https://vesum.nlp.net.ua/>

By Andriy Rysin, Vasyl Starko and the BrUK team, with the data published at
[brown-uk/dict_uk](https://github.com/brown-uk/dict_uk) under the
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 licence](https://creativecommons.org/licenses/by-nc-sa/4.0/).
Nebokrai reads it from the pymorphy3-dicts-uk package, a snapshot from 2022.

### Background photos

The two photos you can choose as a background in the settings are
[a field of yellow flowers under a blue sky](https://unsplash.com/photos/Y4aVJso5J_c)
by Igor Karimov on Unsplash ([Unsplash Licence](https://unsplash.com/license)) and
[a green hill with trees and fog](https://www.pexels.com/photo/28041738/)
by neslihan on Pexels ([Pexels Licence](https://www.pexels.com/license/)).

### Logos of the funds

The logos on the Support Ukraine page belong to the organisations they stand
for. Each was taken from that organisation's own site and is shown only to say
whose link it is. None of the licences above covers them.

### Radio

The radio you can switch on in the settings plays Ukrainian stations, each
named with a link to its own site. (The page lists them from
`src/lib/radio.ts`, nineteen on 2026-11-12: the public broadcaster's four
channels, Громадське радіо, Армія FM, Радіо NV, Радіо Накипіло, Радіо Хартія,
РАДІОПІХОТА, Люкс ФМ and eight of TAVR Media's.) Each stream is the station's own and comes straight from the station's server
to your browser; Nebokrai stores and re-broadcasts nothing. The programmes,
and any advertising in them, belong to the stations, and Nebokrai earns
nothing from them. The player links to the site of the station that is
playing. The name of the song is the station's own text: what it sends
with its stream, or what its own player lists. The moving bars that show a station is on air follow an animation by
Sam Herbert ([SVG Loaders](https://github.com/SamHerbert/SVG-Loaders), MIT
licence).

### Using our data

The dictionary data shown on this site, apart from VESUM, is available under
CC BY-SA 4.0. You may copy and adapt it if you give credit and share your
version under the same licence. VESUM data stays under its own non-commercial
licence.

Nebokrai is a non-commercial project.

### The site's code

The code of the site is free software under the
[GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.html),
version 3 or later, and is published at
<https://github.com/Jesper-Andersson/nebokrai>. The data, fonts, photos and
logos keep the licences named on this page.

### Found a mistake?

Most mistakes come from the sources. You can report one with "Report an issue",
and many can be fixed directly on Wiktionary or Tatoeba, which improves them
for everyone.

---

## What each licence asks

| Source | Licence | What it asks of us | Where we do it |
|---|---|---|---|
| Wiktionary | CC BY-SA 4.0 | Credit, link to the licence, say if changed, share derived data under the same licence | Sources page; a "Wiktionary" link on each word page |
| Wikimedia Commons audio | per file, mostly CC BY-SA or public domain | Credit the author of each file | Link to the file's Commons page beside the play button |
| The letters' recordings on the alphabet page (32 files by Tabrus, Wikimedia Commons, 2023) | CC BY-SA 4.0 | Credit the author, link to the licence, say what was changed, share the changed files under the same licence | The line under the letters on `/alphabet` (author, licence, "cut down to the letter and cleaned of noise"); each letter's original on Commons beside its play button; Sources page. The files are `static/audio/letters/*.mp3`, made with their list (`src/lib/alphabet/recordings.ts`) by `data/letter_recordings.py`, and are CC BY-SA 4.0 themselves |
| Tatoeba | CC BY 2.0 FR | Credit the author of each sentence | Link each sentence to `tatoeba.org/sentences/show/<id>` (`tatoeba_id` is stored) |
| FrequencyWords | CC BY-SA 4.0 | Credit; share-alike | Sources page |
| VESUM | CC BY-NC-SA 4.0 | Credit; no commercial use; share-alike | Sources page; kept in its own database |
| Background photo "field" (Igor Karimov, Unsplash) | Unsplash Licence | No credit required; we give it anyway | Sources page. Files: `src/lib/assets/backgrounds/field-*.webp` |
| Background photo "hills" (neslihan, Pexels) | Pexels Licence | No credit required; we give it anyway | Sources page. Files: `src/lib/assets/backgrounds/hills-*.webp` |
| Fund logos on the Support Ukraine page | None: each is its organisation's trademark | Use one only beside that fund's own link, unaltered; take it down if the fund asks | Support page ("About this list"); Sources page. Files: `static/funds/*.png`, each the icon the fund's site gives browsers |
| Radio streams (the player in the corner) | None: each stream and its programmes are the station's | Play the stream from the station's own server, unaltered, under the station's name with a link to its site; no copy, no recording, no advertising of ours around it; take a station out if it asks | Sources page; the link in the player. List: `src/lib/radio.ts` |
| The radio's moving bars (the heights and timings of "audio" in SVG Loaders, Sam Herbert, 2014, rewritten as CSS keyframes) | MIT | Keep the copyright line and the licence's name with the copy | The comment over the bars in `src/lib/RadioPlayer.svelte`; Sources page |

How the licences fit together:

- **Share-alike.** The dictionary is derived from CC BY-SA data, so the
  compiled database is an adaptation and is CC BY-SA 4.0 too. The site's own
  code and design are separate works under the AGPL (see `LICENSE` and the
  README).
- **VESUM stays apart.** CC BY-SA and CC BY-NC-SA data cannot be merged into
  one dataset, so VESUM is kept in a database of its own and nothing from it is
  copied into the dictionary. A search answer can show both side by side, each
  under its own licence.
- **Non-commercial.** While VESUM is used: no advertising and no paid features.
- **Audio credit.** Only the mp3 address is stored. The Commons page address is
  worked out from it: the file name is the second-to-last part of the address
  (it ends in `.ogg` or `.wav`), and the page is
  `https://commons.wikimedia.org/wiki/File:<name>`.
- **VESUM version.** VESUM is read through the `pymorphy3-dicts-uk` package,
  which is a 2022 snapshot (2.4.1.1.1663094765, built on 13 September 2022).
  It does not say which VESUM version it holds, so the citation on the Sources
  page gives the years, 2005–2022, where VESUM's README asks for a version.
- This is a careful reading of the licences, not legal advice.
