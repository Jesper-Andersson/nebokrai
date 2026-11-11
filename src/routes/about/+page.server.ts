import { githubProfile } from '#lib/server/github.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => ({
	github: await githubProfile('Jesper-Andersson', fetch)
});
