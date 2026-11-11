// The public GitHub profile shown on the About page. Fetched on the server and
// kept for an hour, so visitors don't use up GitHub's rate limit (60 requests
// an hour without a token). If GitHub can't be reached, the card still shows
// the username, avatar and link.

export interface GitHubProfile {
	login: string;
	name: string | null;
	bio: string | null;
	location: string | null;
	publicRepos: number | null;
	avatarUrl: string;
	url: string;
}

const HOUR = 60 * 60 * 1000;
const cache = new Map<string, { at: number; profile: GitHubProfile }>();

export async function githubProfile(login: string, fetcher: typeof fetch): Promise<GitHubProfile> {
	const hit = cache.get(login);
	if (hit && Date.now() - hit.at < HOUR) return hit.profile;

	const fallback: GitHubProfile = {
		login,
		name: null,
		bio: null,
		location: null,
		publicRepos: null,
		avatarUrl: `https://github.com/${login}.png?size=96`,
		url: `https://github.com/${login}`
	};
	try {
		const res = await fetcher(`https://api.github.com/users/${login}`, {
			headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'nebokrai.app' },
			signal: AbortSignal.timeout(3000)
		});
		if (!res.ok) return hit?.profile ?? fallback;
		const u = await res.json();
		const profile: GitHubProfile = {
			login: u.login ?? login,
			name: u.name || null,
			bio: u.bio || null,
			location: u.location || null,
			publicRepos: typeof u.public_repos === 'number' ? u.public_repos : null,
			avatarUrl: u.avatar_url ? `${u.avatar_url}&s=96` : fallback.avatarUrl,
			url: u.html_url ?? fallback.url
		};
		cache.set(login, { at: Date.now(), profile });
		return profile;
	} catch {
		return hit?.profile ?? fallback;
	}
}
