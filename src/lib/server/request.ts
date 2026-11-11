// What an endpoint does to a request before trusting it: read a JSON body
// without letting it grow past a limit, and name the visitor for a rate limit.
//
// Nothing here imports from SvelteKit, so `npm test` can run it.

const refuse = (status: number, error: string) => Response.json({ error }, { status });

/**
 * The request's JSON body, or the Response to answer with: 413 `too_large`
 * when it is over `maxBytes`, 400 `invalid_json` when it does not parse.
 *
 * `request.json()` would read whatever is sent, and a Worker has 128 MB of
 * memory. Reading stops at the limit even when Content-Length lies or is absent.
 */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
	if (Number(request.headers.get('content-length')) > maxBytes) return refuse(413, 'too_large');
	const reader = request.body?.getReader();
	if (!reader) return refuse(400, 'invalid_json');

	const bytes = new Uint8Array(maxBytes);
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (size + value.byteLength > maxBytes) {
			await reader.cancel();
			return refuse(413, 'too_large');
		}
		bytes.set(value, size);
		size += value.byteLength;
	}
	try {
		return JSON.parse(new TextDecoder().decode(bytes.subarray(0, size)));
	} catch {
		return refuse(400, 'invalid_json');
	}
}

/**
 * The address to count requests by. An IPv6 visitor is counted by their /64:
 * one home connection is given that whole range, so counting single addresses
 * would let it send 2^64 times the limit. 2a02:8084:1:2:aaaa:bbbb:cccc:dddd
 * becomes 2a02:8084:1:2.
 */
export function rateKey(address: string): string {
	// IPv4, also when written as ::ffff:203.0.113.7
	if (!address.includes(':') || address.includes('.')) return address;
	const [head, tail] = address.toLowerCase().split('::');
	const groups = head ? head.split(':') : [];
	if (tail !== undefined) {
		const after = tail ? tail.split(':') : [];
		while (groups.length + after.length < 8) groups.push('0');
		groups.push(...after);
	}
	return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':');
}
