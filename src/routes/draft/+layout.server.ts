import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { LayoutServerLoad } from './$types';

// The draft redesign is for looking at in `npm run dev`. A production build
// answers 404 for every page under /draft, so an unfinished design cannot be
// reached (or indexed) on the live site. Remove this file to deploy a preview.
export const load: LayoutServerLoad = () => {
	if (!dev) error(404, 'Not found');
};
