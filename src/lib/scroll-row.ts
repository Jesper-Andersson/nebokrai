// A row of chips that scrolls sideways on a phone (`ui-scroll-row`, app.css)
// opens with its chosen item in the middle, so 701–800 on Common words or
// the letter П is not left off the right edge. Nothing moves when the row
// fits, as it does on a wider screen.
import type { Attachment } from 'svelte/attachments';

/**
 * `{@attach showCurrent(data.page)}` on the row: the argument is what makes it
 * run again when a link inside the row goes to another of its items.
 */
export function showCurrent(current: unknown): Attachment<HTMLElement> {
	return (row) => {
		void current;
		const centre = () => {
			const item = row.querySelector<HTMLElement>('[aria-current]');
			if (!item || row.scrollWidth <= row.clientWidth) return;
			const r = row.getBoundingClientRect();
			const i = item.getBoundingClientRect();
			row.scrollLeft += i.left + i.width / 2 - (r.left + r.width / 2);
		};
		// After the first layout, and again once the web fonts have come, as
		// they change how wide each chip is
		const frame = requestAnimationFrame(centre);
		let live = true;
		void document.fonts?.ready.then(() => live && centre());
		return () => {
			live = false;
			cancelAnimationFrame(frame);
		};
	};
}
