// The keys that answer a flashcard, and changing them. The defaults are
// Anki's. A key is known by its place on the keyboard (KeyboardEvent.code:
// "KeyR", "Digit1"), not by the letter it types: someone learning Ukrainian
// often has the Ukrainian layout on, where the R key types к, and the keys
// must go on working. No imports: `npm test` runs this file.

export const ACTIONS = ['show', 'again', 'good', 'replay', 'undo'] as const;
/**
 * `show` shows the answer and, once it shows, answers "Good", as Space does
 * in Anki. `replay` plays the recording again.
 */
export type Action = (typeof ACTIONS)[number];
/** The key for each action, as a KeyboardEvent.code. */
export type Bindings = Record<Action, string>;

export const DEFAULT_KEYS: Bindings = { show: 'Space', again: 'Digit1', good: 'Digit3', replay: 'KeyR', undo: 'KeyU' };

// Keys that work besides the five above, for as long as none of them is given
// to something else: Enter like Space; Anki's 2 (Hard) and 4 (Easy), which
// with two answers are a card remembered like 3; the number pad; F5, Anki's
// other key for the sound; and the arrows, the way the card leaves.
const ALSO: Record<string, Action> = {
	Enter: 'show', NumpadEnter: 'show', Digit2: 'good', Digit4: 'good', Numpad1: 'again', Numpad2: 'good',
	Numpad3: 'good', Numpad4: 'good', F5: 'replay', ArrowLeft: 'again', ArrowRight: 'good'
};

/** Keys that cannot be given to an action: they are part of other keys, or move the focus. */
const NOT_BINDABLE = /^(Escape|Tab|CapsLock|NumLock|ScrollLock|ContextMenu|(Shift|Control|Alt|Meta|OS)(Left|Right)?|)$/;

export function bindable(code: string): boolean {
	return !NOT_BINDABLE.test(code);
}

/** What the key at `code` does, if anything. */
export function actionFor(keys: Bindings, code: string): Action | null {
	return ACTIONS.find((action) => keys[action] === code) ?? ALSO[code] ?? null;
}

/**
 * The bindings with `code` given to `action`. If another action had that key,
 * the two change places, so every action always has a key and no key two.
 */
export function rebind(keys: Bindings, action: Action, code: string): Bindings {
	if (!bindable(code)) return keys;
	const other = ACTIONS.find((a) => a !== action && keys[a] === code);
	return { ...keys, ...(other ? { [other]: keys[action] } : {}), [action]: code };
}

/** Read bindings from storage: the defaults for anything missing, malformed or given twice. */
export function parseBindings(value: unknown): Bindings {
	if (!value || typeof value !== 'object') return DEFAULT_KEYS;
	const keys = { ...DEFAULT_KEYS };
	for (const action of ACTIONS) {
		const code = (value as Record<string, unknown>)[action];
		if (typeof code === 'string' && code.length <= 32 && bindable(code)) keys[action] = code;
	}
	return new Set(Object.values(keys)).size === ACTIONS.length ? keys : DEFAULT_KEYS;
}

export function isDefault(keys: Bindings): boolean {
	return ACTIONS.every((action) => keys[action] === DEFAULT_KEYS[action]);
}

const NAMES: Record<string, string> = {
	Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Backspace: '⌫', Delete: 'Del', ArrowLeft: '←',
	ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
	Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Backquote: '`',
	NumpadAdd: '+', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/', NumpadDecimal: '.'
};

/** What is printed on the key, on a US keyboard: "KeyR" is R, "Digit1" is 1. */
export function keyLabel(code: string): string {
	return NAMES[code] ?? code.replace(/^(Key|Digit|Numpad)(?=.$)/, '');
}
