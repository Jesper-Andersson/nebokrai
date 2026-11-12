// GET /api/radio/now/<station> — see docs/api.md.
//
// The song a station of the radio (src/lib/radio.ts) is playing. The server
// asks the station, so the visitor's browser does not have to (it could not:
// see src/lib/radio-now.ts). Only a station in the list can be asked for, so
// this cannot be made to fetch an address of someone's choosing.
import { nowPlaying } from '#lib/radio-now.ts';
import { stationById } from '#lib/radio.ts';
import { cached } from '#lib/server/cache.ts';
import type { RequestHandler } from './$types';

// A song lasts minutes and the player asks every 20 seconds. Kept for 15, the
// answer is one question to the station however many people are listening.
const CACHE_CONTROL = 'public, max-age=15, s-maxage=15';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const station = stationById(params.id);
	if (!station) return Response.json({ error: 'not_found', station: params.id }, { status: 404 });

	return cached(
		`${url.origin}/api/radio/now/${station.id}`,
		async () => Response.json({ station: station.id, title: await nowPlaying(station, fetch) }),
		CACHE_CONTROL
	);
};
