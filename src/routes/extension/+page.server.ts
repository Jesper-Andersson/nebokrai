import { error } from '@sveltejs/kit';
import { browserOf, EXTENSION_LIVE } from '#lib/extension.ts';
import type { PageServerLoad } from './$types';

// No page until a store has the extension (src/lib/extension.ts). The
// visitor's browser is read here, not in the page, so its button is first
// from the start and nothing moves once the page has loaded.
export const load: PageServerLoad = ({ request }) => {
	if (!EXTENSION_LIVE) error(404);
	return { browser: browserOf(request.headers.get('user-agent') ?? '') };
};
