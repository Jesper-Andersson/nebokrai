// What search engines are told (src/lib/seo.ts): titles, descriptions, the sitemap.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { messagesFor } from '../src/lib/i18n.ts';
import { wordSlug } from '../src/lib/search/slug.ts';
import { wordDetails, wordDetailsBySlug } from '../src/lib/search/word.ts';
import { sitemap, wordDescription, wordTitle } from '../src/lib/seo.ts';
import { openLocal } from './local-db.ts';

const hasDb = existsSync('nebokrai.db');
const en = messagesFor('en');
const uk = messagesFor('uk');

test('a word page says what it has, and no more', { skip: !hasDb }, async () => {
	const db = openLocal('nebokrai.db');
	const [knyha] = await wordDetails(db, 'книга');
	assert.equal(wordTitle(en, knyha), 'книга: meaning in English, stress and declension · Nebokrai');
	assert.equal(wordTitle(uk, knyha), 'книга: значення англійською, наголос і відмінювання · Nebokrai');
	assert.match(wordDescription(en, knyha), /^кни́га \(noun\): book/);
	assert.match(wordDescription(en, knyha), /a full declension table/);

	const [chytaty] = await wordDetails(db, 'читати');
	assert.match(wordTitle(en, chytaty), /stress and conjugation · Nebokrai$/);
	assert.match(wordTitle(uk, chytaty), /наголос і дієвідмінювання · Nebokrai$/);

	// A word that does not inflect promises no table: і ("and") is a conjunction.
	const [i] = await wordDetails(db, 'і');
	assert.doesNotMatch(wordTitle(en, i), /declension|conjugation/);
	assert.doesNotMatch(wordDescription(en, i), /table/);
});

test('descriptions fit in a search result', { skip: !hasDb }, async () => {
	const db = openLocal('nebokrai.db');
	// стан has five entries and іти dozens of meanings: long ones must be cut at a word.
	for (const word of ['стан', 'іти', 'на', 'калина', 'Київ', 'небокрай']) {
		for (const entry of await wordDetails(db, word)) {
			for (const m of [en, uk]) {
				const text = wordDescription(m, entry);
				assert.ok(text.length <= 165, `${word}: ${text.length} characters: ${text}`);
				assert.doesNotMatch(text, /\s…|\.\./, `${word}: ${text}`);
			}
		}
	}
});

test('the sitemap lists every word page once', { skip: !hasDb }, async () => {
	const db = openLocal('nebokrai.db');
	const text = await sitemap(db, 'https://nebokrai.app');
	const urls = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

	assert.ok(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset '));
	assert.equal(new Set(urls).size, urls.length, 'no address twice');
	assert.ok(urls.length > 25_000 && urls.length < 50_000, `${urls.length} addresses`);
	for (const page of ['/', '/about', '/resources', '/sources', '/word/kalyna', '/word/knyha', '/word/kyiv']) {
		assert.ok(urls.includes(`https://nebokrai.app${page}`), page);
	}
	for (const page of ['/saved', '/report']) assert.ok(!urls.includes(`https://nebokrai.app${page}`), page);
	// Nothing that would break the XML or need escaping in an address. The
	// brackets are for the one entry spelled ")))", the smiley.
	assert.ok(urls.every((url) => /^https:\/\/nebokrai\.app\/[A-Za-z0-9\-/%._~()]*$/.test(url)));

	// Every word is covered by the address the word page answers at.
	const words = await db.all<{ word: string }>('SELECT DISTINCT word FROM entries');
	const listed = new Set(urls);
	for (const { word } of words) {
		const slug = wordSlug(word);
		assert.ok(listed.has(`https://nebokrai.app/word/${slug || encodeURIComponent(word)}`), word);
		// A word with no slug is found by its own spelling (routes/word/[word]/+page.server.ts).
		if (!slug) assert.ok((await wordDetails(db, word)).length > 0, `${word} has no entry`);
	}
	// A sample of addresses really leads to entries: the most common, and every 500th after.
	const slugs = urls.filter((url) => /\/word\/[a-z0-9-]+$/.test(url)).map((url) => url.split('/word/')[1]);
	for (let n = 0; n < slugs.length; n += 500) {
		assert.ok((await wordDetailsBySlug(db, slugs[n])).length > 0, `/word/${slugs[n]} has no entry`);
	}
});

test('robots.txt points at the sitemap and keeps crawlers off the API', () => {
	const robots = readFileSync('static/robots.txt', 'utf8');
	assert.match(robots, /^Sitemap: https:\/\/nebokrai\.app\/sitemap\.xml$/m);
	assert.match(robots, /^Disallow: \/api\/$/m);
	assert.doesNotMatch(robots, /^Disallow: \/(word)?$/m);
});
