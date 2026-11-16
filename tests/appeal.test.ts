import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APPEAL, showAppeal } from '../src/lib/appeal.ts';
import { readSettings } from '../src/lib/settings.ts';

const appeal = { id: 'volt4victory', url: 'https://auroraaid.eu/volt4victory/', until: '2027-01-31' };

test('the banner links to the Volt 4 Victory page', () => {
	assert.equal(APPEAL.url, 'https://auroraaid.eu/volt4victory/');
});

test('an appeal shows until it is closed or past its last day', () => {
	const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
	assert.equal(showAppeal(appeal, '', day('2026-11-17')), true);
	assert.equal(showAppeal(appeal, '', day('2027-01-31')), true);
	assert.equal(showAppeal(appeal, '', day('2027-02-01')), false);
	assert.equal(showAppeal(appeal, 'volt4victory', day('2026-11-17')), false);
	// Closing an earlier campaign does not hide a new one
	assert.equal(showAppeal(appeal, 'an-older-appeal', day('2026-11-17')), true);
});

test('the closed cookie keeps only an id', () => {
	const read = (value: string) => readSettings((name) => (name === 'closed' ? value : undefined)).closed;
	assert.equal(read('volt4victory'), 'volt4victory');
	assert.equal(read('<script>'), '');
	assert.equal(readSettings(() => undefined).closed, '');
});
