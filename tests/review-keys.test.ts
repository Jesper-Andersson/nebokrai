// The keys that answer a flashcard (src/lib/review/keys.ts). Needs no data.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	DEFAULT_KEYS, actionFor, bindable, isDefault, keyLabel, parseBindings, rebind
} from '../src/lib/review/keys.ts';

test("the defaults are Anki's", () => {
	const does = (code: string) => actionFor(DEFAULT_KEYS, code);
	assert.deepEqual(['Space', 'Enter', 'NumpadEnter'].map(does), ['show', 'show', 'show']);
	assert.deepEqual(['Digit1', 'Digit2', 'Digit3', 'Digit4'].map(does), ['again', 'good', 'good', 'good']);
	assert.deepEqual(['KeyR', 'F5', 'KeyU'].map(does), ['replay', 'replay', 'undo']);
	assert.deepEqual(['ArrowLeft', 'ArrowRight'].map(does), ['again', 'good']);
	assert.equal(does('KeyQ'), null);
});

test('a key given to an action is taken from whatever had it', () => {
	// A free key: only that action changes.
	const withJ = rebind(DEFAULT_KEYS, 'again', 'KeyJ');
	assert.deepEqual(withJ, { ...DEFAULT_KEYS, again: 'KeyJ' });
	assert.equal(actionFor(withJ, 'KeyJ'), 'again');
	assert.equal(actionFor(withJ, 'Digit1'), null); // no longer anything

	// Another action's key: the two change places.
	assert.deepEqual(rebind(DEFAULT_KEYS, 'again', 'KeyU'), { ...DEFAULT_KEYS, again: 'KeyU', undo: 'Digit1' });
	// One of the extra keys: the action it is given to wins.
	assert.equal(actionFor(rebind(DEFAULT_KEYS, 'undo', 'ArrowLeft'), 'ArrowLeft'), 'undo');
	// Its own key again changes nothing, and neither does a key that cannot be bound.
	assert.deepEqual(rebind(DEFAULT_KEYS, 'good', 'Digit3'), DEFAULT_KEYS);
	assert.equal(rebind(DEFAULT_KEYS, 'good', 'Escape'), DEFAULT_KEYS);
	assert.ok(isDefault(DEFAULT_KEYS) && !isDefault(withJ));
});

test('which keys can be bound', () => {
	for (const code of ['KeyJ', 'Space', 'Enter', 'F2', 'Numpad5', 'Backquote']) assert.ok(bindable(code), code);
	for (const code of ['Escape', 'Tab', 'ShiftLeft', 'ControlRight', 'AltLeft', 'MetaLeft', 'CapsLock', '']) {
		assert.ok(!bindable(code), code);
	}
});

test('bindings from storage are read defensively', () => {
	assert.deepEqual(parseBindings({ again: 'KeyJ', good: 'KeyL' }), { ...DEFAULT_KEYS, again: 'KeyJ', good: 'KeyL' });
	assert.deepEqual(parseBindings({ again: 5, good: 'Escape', extra: 'KeyX' }), DEFAULT_KEYS);
	// One key for two actions cannot be told apart: back to the defaults.
	assert.deepEqual(parseBindings({ again: 'KeyR' }), DEFAULT_KEYS);
	for (const bad of [null, 'x', 7]) assert.deepEqual(parseBindings(bad), DEFAULT_KEYS);
});

test('a key is named by what is printed on it', () => {
	const names = ['Space', 'Digit1', 'KeyR', 'Numpad3', 'ArrowLeft', 'Enter', 'Semicolon', 'F5', 'IntlBackslash'];
	assert.deepEqual(names.map(keyLabel), ['Space', '1', 'R', '3', '←', 'Enter', ';', 'F5', 'IntlBackslash']);
});
