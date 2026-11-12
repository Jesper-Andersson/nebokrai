// The stations of the radio in the corner of the page (RadioPlayer.svelte),
// chosen by hand: Ukrainian speech for learners to listen to, and music sung
// in Ukrainian. To add one, add an object to STATIONS; the player, the
// Content-Security-Policy (vite.config.ts) and tests/radio.test.ts pick it up.
//
// What goes in: a station that broadcasts in Ukrainian and offers its own
// stream over https. The address is the station's own server: the sound goes
// straight from there to the visitor and never through this site. Prefer the
// 128 kbit/s stream to a 320 kbit/s one, for visitors on mobile data.
//
// Nothing here imports from Svelte or SvelteKit, so `npm test` and
// vite.config.ts can both read it.

/** In the order the player shows them. */
export const KINDS = ['talk', 'music'] as const;
export type StationKind = (typeof KINDS)[number];

export interface Station {
	/** Kept in the visitor's browser as the station last listened to: never reuse or rename one */
	id: string;
	/** As the station writes it */
	name: string;
	/** The live stream: https, answering with audio and no redirect to another host */
	url: string;
	/** The station's own site */
	home: string;
	kind: StationKind;
	/** One line on what it broadcasts, in English and in Ukrainian */
	en: string;
	uk: string;
	/** The day (ISO) the stream was last heard to work */
	checked: string;
	/**
	 * Where the station's own player reads the songs it has played, newest
	 * first, as JSON. Only for a station whose stream does not carry the
	 * song's title; the others are asked through the stream (radio-now.ts).
	 */
	playlist?: string;
}

// Ordered by kind (the test holds this), then by hand.
export const STATIONS: Station[] = [
	{
		id: 'ukr',
		name: 'Українське радіо',
		url: 'https://radio.ukr.radio/ur1-mp3',
		home: 'https://ukr.radio/channel.html?channelID=1',
		kind: 'talk',
		en: 'Ukraine’s public radio: news, talk and interviews.',
		uk: 'Суспільне радіо України: новини, розмови, інтерв’ю.',
		checked: '2026-11-12'
	},
	{
		id: 'kultura',
		name: 'Радіо Культура',
		url: 'https://radio.ukr.radio/ur3-mp3',
		home: 'https://ukr.radio/channel.html?channelID=3',
		kind: 'talk',
		en: 'Public radio’s culture channel: books, theatre, classical music.',
		uk: 'Канал культури Суспільного: книжки, театр, класична музика.',
		checked: '2026-11-12'
	},
	{
		id: 'hromadske',
		name: 'Громадське радіо',
		url: 'https://hromadske.radio/radio_https_upstream',
		home: 'https://hromadske.radio/',
		kind: 'talk',
		en: 'Independent talk radio: news and long conversations.',
		uk: 'Незалежне розмовне радіо: новини й довгі розмови.',
		checked: '2026-11-12'
	},
	{
		id: 'army',
		name: 'Армія FM',
		// On port 8443, which some office networks do not let through
		url: 'https://icecast.armyfm.com.ua:8443/ArmyFM',
		home: 'https://www.armyfm.com.ua/',
		kind: 'talk',
		en: 'The radio of Ukraine’s armed forces: news, talk and music.',
		uk: 'Радіо Збройних сил України: новини, розмови, музика.',
		checked: '2026-11-12'
	},
	{
		id: 'nv',
		name: 'Радіо NV',
		url: 'https://online-radio.nv.ua/radionv.mp3',
		home: 'https://radio.nv.ua/',
		kind: 'talk',
		en: 'News, analysis and interviews from the NV media group.',
		uk: 'Новини, аналітика й інтерв’ю від медіа NV.',
		checked: '2026-11-12'
	},
	{
		id: 'promin',
		name: 'Радіо Промінь',
		url: 'https://radio.ukr.radio/ur2-mp3',
		home: 'https://ukr.radio/channel.html?channelID=2',
		kind: 'music',
		en: 'Public radio’s music channel, with new Ukrainian music.',
		uk: 'Музичний канал Суспільного з новою українською музикою.',
		checked: '2026-11-12'
	},
	{
		id: 'tochka',
		name: 'Радіоточка',
		url: 'https://radio.ukr.radio/ur5-mp3',
		home: 'https://ukr.radio/channel.html?channelID=5',
		kind: 'music',
		en: 'Public radio’s archive: Ukrainian songs of past decades.',
		uk: 'Архів Суспільного: українські пісні минулих десятиліть.',
		checked: '2026-11-12'
	},
	{
		id: 'bayraktar',
		name: 'Радіо Байрактар',
		url: 'https://online.radiobayraktar.ua/RadioBayraktar',
		home: 'https://www.radiobayraktar.ua/',
		kind: 'music',
		en: 'Ukrainian songs around the clock.',
		uk: 'Українські пісні цілодобово.',
		checked: '2026-11-12',
		playlist: 'https://o.tavr.media/bayraktar'
	},
	{
		id: 'nashe',
		name: 'Наше Радіо',
		url: 'https://online.nasheradio.ua/NasheRadio',
		home: 'https://www.nasheradio.ua/',
		kind: 'music',
		en: 'Ukrainian pop hits.',
		uk: 'Українські попхіти.',
		checked: '2026-11-12',
		playlist: 'https://o.tavr.media/nasheradio'
	},
	{
		id: 'roks-ukr',
		name: 'Radio ROKS Український рок',
		url: 'https://online.radioroks.ua/RadioROKS_Ukr',
		home: 'https://www.radioroks.ua/',
		kind: 'music',
		en: 'Radio ROKS’s stream of Ukrainian rock.',
		uk: 'Потік українського року від Radio ROKS.',
		checked: '2026-11-12'
	},
	{
		id: 'nakypilo',
		name: 'Радіо Накипіло',
		url: 'https://radiostream.nakypilo.ua/full',
		home: 'https://radio.nakypilo.ua/',
		kind: 'music',
		en: 'Independent radio from Kharkiv, playing Ukrainian music.',
		uk: 'Незалежне радіо з Харкова, що грає українську музику.',
		checked: '2026-11-12'
	},
	{
		id: 'khartia',
		name: 'Радіо Хартія',
		// The station's other stream is MP3 at 320 kbit/s; this one is AAC at 64,
		// a fifth of the data
		url: 'https://a9.asurahosting.com/listen/radio_khartia/radio2.aac',
		home: 'https://radiokhartia.com/',
		kind: 'music',
		en: 'Music and talk about the army and the country behind it.',
		uk: 'Музика й розмови про військо та країну, яка його підтримує.',
		checked: '2026-11-12'
	},
	{
		id: 'pihota',
		name: 'РАДІОПІХОТА',
		// AAC at 64 kbit/s is the only stream
		url: 'https://online.pihota.fm/listen/radio/aac64',
		home: 'https://pihota.fm/',
		kind: 'music',
		en: 'Radio by soldiers, for soldiers and about soldiers.',
		uk: 'Радіо від військових, для військових і про військових.',
		checked: '2026-11-12'
	},
	{
		id: 'indie',
		name: 'Радіо Інді.UA',
		url: 'https://online.radioplayer.ua/RadioIndieUA',
		home: 'https://play.tavr.media/radioindieua/',
		kind: 'music',
		en: 'Ukrainian indie music.',
		uk: 'Українська інді-музика.',
		checked: '2026-11-12'
	},
	{
		id: 'kiss-ukr',
		name: 'Kiss FM Ukrainian',
		url: 'https://online.kissfm.ua/KissFM_Ukr',
		home: 'https://play.tavr.media/kissfm/ukr/',
		kind: 'music',
		en: 'Kiss FM’s stream of Ukrainian dance music.',
		uk: 'Потік української танцювальної музики від Kiss FM.',
		checked: '2026-11-12'
	},
	{
		// Mostly songs in English: here for the talk between them, and because
		// it is the station people know. The next one is its Ukrainian half.
		id: 'hit',
		name: 'Хіт FM',
		url: 'https://online.hitfm.ua/HitFM',
		home: 'https://www.hitfm.ua/',
		kind: 'music',
		en: 'Chart hits, international and Ukrainian.',
		uk: 'Хіти, світові й українські.',
		checked: '2026-11-12',
		playlist: 'https://o.tavr.media/hit'
	},
	{
		id: 'hit-ukr',
		name: 'Хіт FM Українські хіти',
		url: 'https://online.hitfm.ua/HitFM_Ukr',
		home: 'https://play.tavr.media/hitfm/ukr/',
		kind: 'music',
		en: 'Hit FM’s stream of Ukrainian hits.',
		uk: 'Потік українських хітів від Хіт FM.',
		checked: '2026-11-12'
	},
	{
		id: 'lux-ukr',
		name: 'Люкс ФМ Українські хіти',
		// AAC at 128 kbit/s, with the station's adverts put in on the way
		url: 'https://lux.radio.tvstitch.com/ukrayinski-hiti-sd',
		home: 'https://lux.fm/',
		kind: 'music',
		en: 'Lux FM’s stream of Ukrainian hits.',
		uk: 'Потік українських хітів від Люкс ФМ.',
		checked: '2026-11-12'
	},
	{
		id: 'classic',
		name: 'Classic Radio',
		url: 'https://online.classicradio.ua/ClassicRadio',
		home: 'https://www.classicradio.ua/',
		kind: 'music',
		en: 'Classical music around the clock.',
		uk: 'Класична музика цілодобово.',
		checked: '2026-11-12',
		playlist: 'https://o.tavr.media/radio3classic'
	}
];

export function stationById(id: string | null | undefined): Station | undefined {
	return STATIONS.find((station) => station.id === id);
}

/** The station after (`step` 1) or before (-1) this one, going round at the ends of the list. */
export function neighbour(id: string, step: 1 | -1): Station {
	const at = STATIONS.findIndex((station) => station.id === id);
	// An id that is not in the list counts as "before the first"
	const next = at === -1 ? 0 : (at + step + STATIONS.length) % STATIONS.length;
	return STATIONS[next];
}

/**
 * The servers the streams come from: what the page's Content-Security-Policy
 * must let `<audio>` load. The type is the shape SvelteKit asks of an address
 * in that policy; the test holds every one to https.
 */
export const RADIO_ORIGINS = [
	...new Set(STATIONS.map((station) => new URL(station.url).origin))
] as `https://${string}.${string}`[];
