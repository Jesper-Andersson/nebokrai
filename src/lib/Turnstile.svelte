<!-- Cloudflare Turnstile: a small box that checks the visitor's browser is a
     real one and, when it is satisfied, hands back a token for the form to
     send along (the server checks it: src/lib/server/turnstile.ts). Most
     people see it tick itself; some are asked to tick it.

     Cloudflare's script is loaded here, by the one page that needs it, and
     drawn by hand ("explicit" rendering) so it also appears when the page is
     reached by a link inside the site. A token works once and for five
     minutes: the script fetches a new one when it expires, and the form calls
     reset() after a send that failed. -->
<script lang="ts">
	import { useSettings } from '#lib/settings.ts';

	// The few parts of Cloudflare's script used here
	interface Api {
		render(container: HTMLElement, params: Record<string, unknown>): string;
		reset(widget: string): void;
		remove(widget: string): void;
	}

	const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

	let { sitekey, token = $bindable(null) }: { sitekey: string; token?: string | null } = $props();

	const settings = useSettings();

	let box: HTMLDivElement;
	let api = $state.raw<Api>();
	let widget: string | undefined;

	const loaded = () => (window as unknown as { turnstile?: Api }).turnstile;

	function load(): Promise<Api> {
		return new Promise((resolve, reject) => {
			const ready = loaded();
			if (ready) return resolve(ready);
			let script = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
			if (!script) {
				script = document.createElement('script');
				script.src = SRC;
				script.async = true;
				document.head.append(script);
			}
			const tag = script;
			tag.addEventListener('load', () => {
				const now = loaded();
				if (now) resolve(now);
				else reject();
			});
			// Taken out again, so the next visit to the form tries afresh
			tag.addEventListener('error', () => {
				tag.remove();
				reject();
			});
		});
	}

	/** Throw the token away and ask for a new one: a token is good for one send. */
	export function reset() {
		token = null;
		if (api && widget !== undefined) api.reset(widget);
	}

	$effect(() => {
		let gone = false;
		// Without the script there is no token, and the form says so on sending
		load().then(
			(found) => {
				if (!gone) api = found;
			},
			() => {}
		);
		return () => {
			gone = true;
		};
	});

	// Drawn again when the theme or the language changes, since the box is
	// Cloudflare's own frame and takes both only when it is made
	$effect(() => {
		if (!api) return;
		const turnstile = api;
		const made = turnstile.render(box, {
			sitekey,
			theme: settings.theme === 'system' ? 'auto' : settings.theme,
			language: settings.lang,
			size: 'flexible',
			callback: (fresh: string) => (token = fresh),
			'expired-callback': () => (token = null),
			'error-callback': () => (token = null)
		});
		widget = made;
		return () => {
			turnstile.remove(made);
			widget = undefined;
			token = null;
		};
	});
</script>

<div class="box" bind:this={box}></div>

<style>
	/* Cloudflare's frame is 65px tall: the room is kept, so the button below
	   does not jump when the box arrives */
	.box {
		min-height: 65px;
		max-width: 26rem;
	}
</style>
