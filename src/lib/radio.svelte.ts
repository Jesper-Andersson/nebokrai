// The radio's sound, in the browser: which station, whether it is playing, how
// loud. RadioPlayer.svelte draws it; the stations are in radio.ts.
//
// A station is a live stream with no beginning or end, which changes two
// things about playing it. Stopping drops the connection instead of pausing:
// a paused stream goes on downloading, and what plays on resuming is whatever
// was buffered, minutes old. And a stream that ends has not finished, it has
// broken, so it is tried once more before the visitor is told.
//
// Sound starts only when the visitor presses something: never on page load.
//
// One object per page, shared through Svelte context like the settings (a
// module variable would be shared between visitors on the server).
import { getContext, setContext } from 'svelte';
import { STATIONS, neighbour, stationById, type Station } from './radio.ts';

const STATION_KEY = 'radio-station';
const VOLUME_KEY = 'radio-volume';

/** How long a station may stay silent while connecting or buffering */
const PATIENCE_MS = 15_000;
/** The pause before the one second try */
const RETRY_MS = 2_000;
/** The share of the volume left while a word's recording plays over the radio */
const DUCKED = 0.2;
/** How often the station is asked what it is playing (through /api/radio/now, which keeps an answer for 15 seconds) */
const SONG_EVERY_MS = 20_000;
/** A recording of a word is a second or two; one that never reports its end must not leave the radio quiet */
const DUCK_LIMIT_MS = 15_000;

/** `failed`: the visitor asked for sound and the station gave none. */
export type RadioStatus = 'stopped' | 'loading' | 'playing' | 'failed';

function store(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Storage blocked or full: the choice lasts until the page is closed.
	}
}

export class Radio {
	/** The station playing, or the one that will play on the next press. */
	stationId = $state(STATIONS[0].id);
	status = $state<RadioStatus>('stopped');
	/** 0 to 1 */
	volume = $state(1);
	/** False where the browser keeps the volume to the device's own buttons (iOS). */
	canSetVolume = $state(true);
	/**
	 * What the station says it is playing, as "artist - song". Null while
	 * nothing plays, before the station has answered, and whenever it does
	 * not say: speech, adverts, a station that names no songs.
	 */
	song = $state<string | null>(null);

	#audio: HTMLAudioElement | null = null;
	#timer: ReturnType<typeof setTimeout> | undefined;
	/** The station has already been tried again since it last played. */
	#retried = false;
	/** How many recordings are playing over the radio right now. */
	#ducks = 0;
	#songTimer: ReturnType<typeof setInterval> | undefined;
	/** The station whose song is being asked for. */
	#songOf: string | null = null;

	get station(): Station {
		return stationById(this.stationId) ?? STATIONS[0];
	}

	/** True from the press until the sound stops: connecting counts. */
	get on(): boolean {
		return this.status === 'loading' || this.status === 'playing';
	}

	/** Browser only, once per page load: read the station and the volume last used here. */
	load(): void {
		try {
			const id = localStorage.getItem(STATION_KEY);
			if (stationById(id)) this.stationId = id!;
			const volume = Number(localStorage.getItem(VOLUME_KEY) ?? '1');
			if (volume >= 0 && volume <= 1) this.volume = volume;
		} catch {
			// storage blocked
		}
		const probe = new Audio();
		probe.volume = 0.5;
		this.canSetVolume = probe.volume === 0.5;
	}

	/** Play this station, or the current one. Call it from a press: browsers refuse sound nobody asked for. */
	play(id: string = this.stationId): void {
		const station = stationById(id) ?? STATIONS[0];
		if (station.id !== this.stationId) this.#forgetSong();
		this.stationId = station.id;
		store(STATION_KEY, station.id);
		this.#retried = false;
		this.#start();
	}

	stop(): void {
		this.#silence('stopped');
	}

	/** Play if silent, stop if not. */
	toggle(): void {
		if (this.on) this.stop();
		else this.play();
	}

	setVolume(volume: number): void {
		this.volume = Math.min(1, Math.max(0, volume));
		store(VOLUME_KEY, String(this.volume));
		this.#applyVolume();
	}

	/**
	 * Turn the radio down while something short plays over it (a word's
	 * recording). Returns the function that turns it back up; calling that
	 * more than once is harmless.
	 */
	duck(): () => void {
		let ducked = true;
		const release = () => {
			if (!ducked) return;
			ducked = false;
			clearTimeout(limit);
			this.#ducks--;
			this.#applyVolume();
		};
		const limit = setTimeout(release, DUCK_LIMIT_MS);
		this.#ducks++;
		this.#applyVolume();
		return release;
	}

	#applyVolume(): void {
		if (!this.#audio) return;
		const ducked = this.#ducks > 0;
		this.#audio.volume = ducked ? this.volume * DUCKED : this.volume;
		// Where the volume cannot be set, silence is the only way to step aside
		this.#audio.muted = ducked && !this.canSetVolume;
	}

	#element(): HTMLAudioElement {
		if (this.#audio) return this.#audio;
		const audio = new Audio();
		audio.preload = 'none';

		audio.addEventListener('playing', () => {
			clearTimeout(this.#timer);
			this.#retried = false;
			this.status = 'playing';
			this.#watchSong();
			this.#announce();
		});
		// Playing, then nothing left to play: the connection is slow or gone
		audio.addEventListener('waiting', () => {
			if (this.status === 'playing') this.#wait();
		});
		audio.addEventListener('error', () => this.#dropped());
		audio.addEventListener('ended', () => this.#dropped());
		// Paused from outside the page: a headset button, a phone call. (A
		// stream that breaks is also paused by the browser, just before
		// `ended`; that case is the line above.)
		audio.addEventListener('pause', () => {
			if (this.status === 'playing' && !audio.ended) this.stop();
		});

		// The lock screen's and the keyboard's media buttons. A browser throws
		// on an action it does not know, and the rest still work.
		if ('mediaSession' in navigator) {
			const actions: [MediaSessionAction, () => void][] = [
				['play', () => this.play()],
				['pause', () => this.stop()],
				['stop', () => this.stop()],
				['previoustrack', () => this.play(neighbour(this.stationId, -1).id)],
				['nexttrack', () => this.play(neighbour(this.stationId, 1).id)]
			];
			for (const [action, handler] of actions) {
				try {
					navigator.mediaSession.setActionHandler(action, handler);
				} catch {
					// not supported here
				}
			}
		}

		this.#audio = audio;
		return audio;
	}

	#start(): void {
		const audio = this.#element();
		audio.src = this.station.url;
		this.#applyVolume();
		this.#wait();
		audio.play().catch((error: unknown) => {
			// Refused because no press led here (a media button can do that). A
			// stream that cannot be played reports through `error` instead, and
			// a start overtaken by another press needs no answer.
			if (error instanceof DOMException && error.name === 'NotAllowedError') this.#silence('failed');
		});
		this.#announce();
	}

	/** Show "connecting", and give up on a station that stays silent. */
	#wait(): void {
		clearTimeout(this.#timer);
		this.status = 'loading';
		this.#timer = setTimeout(() => this.#dropped(), PATIENCE_MS);
	}

	/** The stream broke, or never came. */
	#dropped(): void {
		if (!this.on) return;
		if (this.#retried) {
			this.#silence('failed');
			return;
		}
		this.#retried = true;
		clearTimeout(this.#timer);
		this.status = 'loading';
		this.#timer = setTimeout(() => this.#start(), RETRY_MS);
	}

	#silence(status: 'stopped' | 'failed'): void {
		clearTimeout(this.#timer);
		this.#forgetSong();
		this.status = status;
		const audio = this.#audio;
		if (!audio) return;
		audio.pause();
		// Without an address the browser lets go of the connection. (An empty
		// `src` would count as a broken one and report an error.)
		audio.removeAttribute('src');
		audio.load();
		this.#announce();
	}

	/**
	 * Ask what the station is playing, now and every 20 seconds while it
	 * plays. Only the music stations are asked: the others have no songs to
	 * name, and each question makes the server ring the station up.
	 */
	#watchSong(): void {
		const id = this.stationId;
		if (this.#songOf === id || this.station.kind !== 'music') return;
		this.#forgetSong();
		this.#songOf = id;
		const ask = async () => {
			let title: unknown = null;
			try {
				const response = await fetch(`/api/radio/now/${id}`);
				if (response.ok) title = (await response.json()).title;
			} catch {
				// Offline for a moment: the next round asks again
			}
			// Another station, or silence, since the question was put
			if (this.#songOf !== id) return;
			this.song = typeof title === 'string' && title ? title : null;
			this.#announce();
		};
		void ask();
		this.#songTimer = setInterval(() => void ask(), SONG_EVERY_MS);
	}

	#forgetSong(): void {
		clearInterval(this.#songTimer);
		this.#songOf = null;
		this.song = null;
	}

	/** Tell the system what is playing, for the lock screen and the media buttons. */
	#announce(): void {
		if (!('mediaSession' in navigator)) return;
		// With a song, the station takes the line under it, where a player shows the artist
		navigator.mediaSession.metadata = new MediaMetadata(
			this.song ? { title: this.song, artist: this.station.name } : { title: this.station.name, artist: 'Nebokrai' }
		);
		navigator.mediaSession.playbackState = this.on ? 'playing' : 'paused';
	}
}

const KEY = Symbol('radio');

export function provideRadio(): Radio {
	return setContext(KEY, new Radio());
}

export function useRadio(): Radio {
	return getContext<Radio>(KEY);
}
