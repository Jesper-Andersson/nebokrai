// The cover of each story, by slug: the first page's picture, kept in this
// repository as src/lib/assets/covers/<slug>.webp so the page never loads a
// picture from another site. A story without a file gets a plain tile.
const files = import.meta.glob('./assets/covers/*.{webp,jpg}', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

const bySlug = new Map(
	Object.entries(files).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.\w+$/, ''), url])
);

export function coverOf(slug: string): string | null {
	return bySlug.get(slug) ?? null;
}
