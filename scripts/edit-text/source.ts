// Finding a piece of text from a page in the site's source, and writing a
// changed text back. This is the thinking half of the text editor of
// `npm run dev` (plugin.ts is the half that reads and writes files); it works
// on strings only, so tests/edit-text.test.ts can run it.
//
// The site's text is written in two ways, and each is found its own way:
//
//   - src/lib/i18n.ts: a string or a template under a key of `en` or `uk`.
//     The file is parsed, so a text is found whatever quotes it is in, and a
//     template is found from what it printed: "3 selected" leads to
//     `${n} selected`.
//   - a .svelte file: text written straight into the markup. It is found as
//     a whole run of text between two tags, however its lines are broken.
//     A short text is often a string in the page's code instead, one for
//     each language; that is found as a whole string in quotes.
import ts from 'typescript';

export type Lang = 'en' | 'uk';

/** One place in the source where the clicked text is written. */
export interface Spot {
	/** Names the place to the server again when the change is saved */
	id: string;
	/** From the repository's root, with forward slashes */
	file: string;
	line: number;
	/** The key in i18n.ts (home.placeholder); null for text written in a page */
	key: string | null;
	lang: Lang;
	/** What the edit box starts with */
	text: string;
	/** The ${…} parts of a template, in order. An edit must keep them. */
	holes: string[];
	kind: 'string' | 'template' | 'markup';
	/** Where the text stands in the file: for a message, its quotes included */
	start: number;
	end: number;
}

/** English text that was changed, and whose Ukrainian is now behind it. */
export interface Pending {
	file: string;
	key: string | null;
	/** The English before the first change that has not been translated */
	was: string;
	now: string;
	/** The day of the latest change, as 2026-11-13 */
	changed: string;
}

/** A mistake in what was typed, worded for the person who typed it. */
export class EditError extends Error {}

const SPACE = '[ \\t\\r\\n]+';

/** One space for every run of spaces and line breaks, and none at the ends. */
export const squash = (text: string) => text.replace(/[ \t\r\n]+/g, ' ').trim();

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern for `text` in which any run of spaces and line breaks matches any other. */
const loose = (text: string) => escapeRegExp(text).replace(/[ \t\r\n]+/g, SPACE);

const lineOf = (source: string, offset: number) => source.slice(0, offset).split('\n').length;

const spotId = (file: string, start: number, end: number) => `${file}:${start}:${end}`;

// ---- src/lib/i18n.ts ----

type Text = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression;

/** A string that is compared or looked up with, not shown: `tag === 'feminine'`, `names['noun']`. */
function isCode(node: ts.Node): boolean {
	const parent = node.parent;
	if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
	if (ts.isCaseClause(parent)) return true;
	if (ts.isBinaryExpression(parent)) {
		const kind = parent.operatorToken.kind;
		return (
			kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
			kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
			kind === ts.SyntaxKind.EqualsEqualsToken ||
			kind === ts.SyntaxKind.ExclamationEqualsToken
		);
	}
	return false;
}

/** Every string and template under `en` and `uk`, with the key it stands under. */
function messageTexts(source: string, file: string) {
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	const found: { node: Text; key: string; lang: Lang }[] = [];

	function visit(node: ts.Node, path: string[], lang: Lang) {
		if (ts.isTypeNode(node)) return;
		if (ts.isObjectLiteralExpression(node)) {
			for (const property of node.properties) {
				if (ts.isPropertyAssignment(property)) {
					const name = ts.isComputedPropertyName(property.name) ? '?' : property.name.text;
					visit(property.initializer, [...path, name], lang);
				} else {
					ts.forEachChild(property, (child) => visit(child, path, lang));
				}
			}
			return;
		}
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			if (!isCode(node)) found.push({ node, key: path.join('.'), lang });
			return;
		}
		if (ts.isTemplateExpression(node)) {
			found.push({ node, key: path.join('.'), lang });
			// A hole can hold text of its own: `${n === 1 ? 'word' : 'words'}`
			for (const span of node.templateSpans) visit(span.expression, path, lang);
			return;
		}
		ts.forEachChild(node, (child) => visit(child, path, lang));
	}

	for (const statement of tree.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			const name = declaration.name.getText(tree);
			if ((name === 'en' || name === 'uk') && declaration.initializer) visit(declaration.initializer, [], name);
		}
	}
	return { tree, found };
}

/** The places in i18n.ts that print `clicked`: first those that are it word for word, then the templates. */
export function messageSpots(source: string, file: string, clicked: string): Spot[] {
	const wanted = squash(clicked);
	if (!wanted) return [];
	const { tree, found } = messageTexts(source, file);
	const exact: Spot[] = [];
	const templates: Spot[] = [];

	for (const { node, key, lang } of found) {
		const start = node.getStart(tree);
		const end = node.getEnd();
		const base = { id: spotId(file, start, end), file, line: lineOf(source, start), key, lang, start, end };

		if (!ts.isTemplateExpression(node)) {
			if (squash(node.text) === wanted) exact.push({ ...base, text: node.text, holes: [], kind: 'string' });
			continue;
		}

		const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
		// A template with no words of its own, such as `${word} (${pos})`, would
		// match text it never printed: "to carry (on foot)"
		if ((parts.join('').match(/\p{L}/gu) ?? []).length < 2) continue;
		if (!new RegExp(`^${parts.map(loose).join('(.*?)')}$`, 's').test(wanted)) continue;

		// A hole as it is written, from the `${` that ends one piece of text to
		// the `}` that begins the next
		const holes: string[] = [];
		let from = node.head.getEnd();
		for (const span of node.templateSpans) {
			holes.push('${' + source.slice(from, span.literal.getStart(tree)) + '}');
			from = span.literal.getEnd();
		}
		const text = parts[0] + holes.map((hole, i) => hole + parts[i + 1]).join('');
		templates.push({ ...base, text, holes, kind: 'template' });
	}
	return [...exact, ...templates];
}

const inTemplate = (text: string) => text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/** `value` written as the string or template that stood at `spot`. */
function messageLiteral(source: string, spot: Spot, value: string): string {
	const quote = source[spot.start];
	if (spot.kind === 'template') {
		// The text between the holes is escaped; the holes are code and go back as they were
		let rest = value;
		let out = '';
		for (const hole of spot.holes) {
			const at = rest.indexOf(hole);
			if (at < 0) throw new EditError(`Keep ${hole} as it is, and in the same order.`);
			out += inTemplate(rest.slice(0, at)) + hole;
			rest = rest.slice(at + hole.length);
		}
		return '`' + out + inTemplate(rest) + '`';
	}
	if (quote === '`') return '`' + inTemplate(value) + '`';
	const escaped = value
		.replace(/\\/g, '\\\\')
		.replaceAll(quote, '\\' + quote)
		.replace(/\r?\n/g, '\\n');
	return quote + escaped + quote;
}

// ---- .svelte files ----

/** The parts of a .svelte file that are not its markup: script, style, comments. */
function notMarkup(source: string): [number, number][] {
	const ranges: [number, number][] = [];
	for (const match of source.matchAll(/<script[\s>][^]*?<\/script>|<style[\s>][^]*?<\/style>|<!--[^]*?-->/g)) {
		ranges.push([match.index, match.index + match[0].length]);
	}
	return ranges;
}

/**
 * The places in a .svelte file where `clicked` is written into the markup.
 * It has to be all of the text between two tags (or `{…}` blocks), as the
 * browser has it in one piece; part of a longer sentence is not a match.
 */
export function markupSpots(source: string, file: string, clicked: string): Spot[] {
	const wanted = squash(clicked);
	if (!wanted) return [];
	// What the browser shows as & or < is written &amp; or &lt; in the file
	const body = loose(wanted)
		.replace(/&/g, '&(?:amp;)?')
		.replace(/</g, '(?:<|&lt;)')
		.replace(/>/g, '(?:>|&gt;)')
		.replace(/ /g, '(?: |&nbsp;)');
	const pattern = new RegExp(`(?<=[>}][ \\t\\r\\n]*)${body}(?=[ \\t\\r\\n]*[<{])`, 'g');
	const skipped = notMarkup(source);
	const lang: Lang = /[Ѐ-ӿ]/.test(wanted) ? 'uk' : 'en';

	const spots: Spot[] = [];
	for (const match of source.matchAll(pattern)) {
		const start = match.index;
		const end = start + match[0].length;
		if (skipped.some(([from, to]) => start >= from && start < to)) continue;
		spots.push({
			id: spotId(file, start, end),
			file,
			line: lineOf(source, start),
			key: null,
			lang,
			text: wanted,
			holes: [],
			kind: 'markup',
			start,
			end
		});
	}
	return spots;
}

/**
 * The places in a .svelte file where `clicked` is a whole string in the
 * page's code, as the two languages of a short text are often written:
 * {uk ? 'Тут поки порожньо.' : 'Nothing saved yet.'}
 *
 * Only a text of two words or more is looked for. A single word in quotes
 * is as likely a name the code goes by ('saved', 'en') as something shown.
 */
export function quotedSpots(source: string, file: string, clicked: string): Spot[] {
	const wanted = squash(clicked);
	if (!wanted.includes(' ')) return [];
	// A quote inside the text may be written with a backslash before it
	const body = loose(wanted).replace(/['"`]/g, '\\\\?$&');
	const pattern = new RegExp(`(?<![\\\\\\w])(['"\`])${body}\\1`, 'g');
	const skipped = [...source.matchAll(/<style[\s>][^]*?<\/style>|<!--[^]*?-->/g)].map(
		(match): [number, number] => [match.index, match.index + match[0].length]
	);
	const lang: Lang = /[Ѐ-ӿ]/.test(wanted) ? 'uk' : 'en';

	const spots: Spot[] = [];
	for (const match of source.matchAll(pattern)) {
		const start = match.index;
		const end = start + match[0].length;
		if (skipped.some(([from, to]) => start >= from && start < to)) continue;
		spots.push({
			id: spotId(file, start, end),
			file,
			line: lineOf(source, start),
			key: null,
			lang,
			text: wanted,
			holes: [],
			kind: 'string',
			start,
			end
		});
	}
	return spots;
}

/** The longest line the pages' text is wrapped to, a tab counting as one letter. */
const WIDTH = 100;

/** `value` as markup, with its lines broken as the old text's were if it had more than one. */
function markupText(source: string, spot: Spot, value: string): string {
	const text = squash(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\{/g, '&#123;')
		.replace(/\}/g, '&#125;')
		.replace(/ /g, '&nbsp;');
	const old = source.slice(spot.start, spot.end);
	if (!old.includes('\n')) return text;

	const eol = old.includes('\r\n') ? '\r\n' : '\n';
	const lineStart = source.lastIndexOf('\n', spot.start - 1) + 1;
	const before = source.slice(lineStart, spot.start);
	// Later lines stand as far in as the old ones did
	const indent = /^[ \t]*$/.test(before) ? before : (/\n([ \t]*)/.exec(old)?.[1] ?? '');

	const lines: string[] = [];
	let line = '';
	let room = WIDTH - before.length;
	for (const word of text.split(' ')) {
		if (line && line.length + 1 + word.length > room) {
			lines.push(line);
			line = word;
			room = WIDTH - indent.length;
		} else {
			line = line ? `${line} ${word}` : word;
		}
	}
	lines.push(line);
	return lines.join(eol + indent);
}

// ---- Writing a change ----

/** The file's text with `value` in the place of what stood at `spot`. */
export function applyEdit(source: string, spot: Spot, value: string): string {
	if (!squash(value)) throw new EditError('The text cannot be empty.');
	const written = spot.kind === 'markup' ? markupText(source, spot, value) : messageLiteral(source, spot, value);
	return source.slice(0, spot.start) + written + source.slice(spot.end);
}

/**
 * The list of English waiting for its Ukrainian, after one more change. A
 * second change to the same text keeps the first `was`: the Ukrainian still
 * says that. A change back to it takes the entry off the list.
 */
export function notePending(list: Pending[], edit: Pending): Pending[] {
	if (squash(edit.was) === squash(edit.now)) return list;
	const same = (entry: Pending) =>
		entry.file === edit.file && entry.key === edit.key && squash(entry.now) === squash(edit.was);
	const earlier = list.find(same);
	if (!earlier) return [...list, edit];
	if (squash(earlier.was) === squash(edit.now)) return list.filter((entry) => entry !== earlier);
	return list.map((entry) => (entry === earlier ? { ...entry, now: edit.now, changed: edit.changed } : entry));
}
