// Reading single files out of a zip, such as an Anki package, without loading
// the whole archive. A deck of 1,400 cards is a 141 MB .apkg, and all but 1 MB
// of it is pictures and sound the import leaves behind. So the directory at the
// end of the file is read first, and then only the entries asked for.
// The browser's own DecompressionStream inflates them, so no library is needed.

const EOCD = 0x06054b50; // end of central directory
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

export class ZipError extends Error {}

interface Entry {
	name: string;
	method: number;
	size: number;
	offset: number;
}

async function bytes(blob: Blob, start: number, end: number): Promise<DataView> {
	return new DataView(await blob.slice(start, end).arrayBuffer());
}

/** Every entry in the archive's central directory. */
async function entries(blob: Blob): Promise<Entry[]> {
	// The end record is 22 bytes, plus a comment of up to 64 KB.
	const tailStart = Math.max(0, blob.size - 22 - 0xffff);
	const tail = await bytes(blob, tailStart, blob.size);
	let at = -1;
	for (let i = tail.byteLength - 22; i >= 0; i--) {
		if (tail.getUint32(i, true) === EOCD) {
			at = i;
			break;
		}
	}
	if (at < 0) throw new ZipError('not a zip file');
	const count = tail.getUint16(at + 10, true);
	const dirSize = tail.getUint32(at + 12, true);
	const dirOffset = tail.getUint32(at + 16, true);
	if (dirOffset === 0xffffffff || count === 0xffff) throw new ZipError('zip64 archives are not supported');

	const dir = await bytes(blob, dirOffset, dirOffset + dirSize);
	const names = new TextDecoder();
	const found: Entry[] = [];
	for (let p = 0; p + 46 <= dir.byteLength && found.length < count; ) {
		if (dir.getUint32(p, true) !== CENTRAL) throw new ZipError('damaged zip directory');
		const nameLength = dir.getUint16(p + 28, true);
		const extra = dir.getUint16(p + 30, true);
		const comment = dir.getUint16(p + 32, true);
		found.push({
			method: dir.getUint16(p + 10, true),
			size: dir.getUint32(p + 20, true),
			offset: dir.getUint32(p + 42, true),
			name: names.decode(new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLength))
		});
		p += 46 + nameLength + extra + comment;
	}
	return found;
}

async function inflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
	const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The contents of an entry, read from where its local header says the data starts. */
async function read(blob: Blob, entry: Entry): Promise<Uint8Array> {
	const head = await bytes(blob, entry.offset, entry.offset + 30);
	if (head.getUint32(0, true) !== LOCAL) throw new ZipError(`damaged zip entry ${entry.name}`);
	const start = entry.offset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
	const data = new Uint8Array(await blob.slice(start, start + entry.size).arrayBuffer());
	if (entry.method === STORED) return data;
	if (entry.method === DEFLATED) return inflate(data);
	throw new ZipError(`zip method ${entry.method} is not supported`);
}

/** The names of every file in the archive. */
export async function zipNames(blob: Blob): Promise<string[]> {
	return (await entries(blob)).map((e) => e.name);
}

/** The first of `names` that the archive holds, with its contents, or null if it holds none of them. */
export async function readFirst(blob: Blob, names: string[]): Promise<{ name: string; data: Uint8Array } | null> {
	const all = await entries(blob);
	for (const name of names) {
		const entry = all.find((e) => e.name === name);
		if (entry) return { name, data: await read(blob, entry) };
	}
	return null;
}
