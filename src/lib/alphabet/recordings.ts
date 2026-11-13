// The recordings of the letters on the alphabet page (/alphabet): one of each
// letter but ь, by one speaker. The files in static/audio/letters/ are made
// from recordings on Wikimedia Commons, with the silence cut from both ends
// and the hiss taken down; each letter names the Commons page of its original.
//
// Made by data/letter_recordings.py; do not edit by hand.

/** Who recorded them and under which licence: said once, beside the letters. */
export const RECORDINGS_CREDIT = {
	author: 'Tabrus',
	licence: 'CC BY-SA 4.0',
	licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
	category: 'https://commons.wikimedia.org/wiki/Category:Ukrainian_pronunciation_of_letters_by_a_young_male_uploaded_by_Tabrus'
};

/** By the letter in lower case: the mp3, and the Commons page of the recording it was made from. */
export const RECORDINGS: Record<string, { src: string; page: string }> = {
	а: { src: '/audio/letters/01-a.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%90%D0%B0_%E2%80%93_ukrainian.ogg' },
	б: { src: '/audio/letters/02-b.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%91%D0%B1_%E2%80%93_ukrainian.ogg' },
	в: { src: '/audio/letters/03-v.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%92%D0%B2_%E2%80%93_ukrainian.ogg' },
	г: { src: '/audio/letters/04-h.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%93%D0%B3_%E2%80%93_ukrainian.ogg' },
	ґ: { src: '/audio/letters/05-g.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D2%90%D2%91_%E2%80%93_ukrainian.ogg' },
	д: { src: '/audio/letters/06-d.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%94%D0%B4_%E2%80%93_ukrainian.ogg' },
	е: { src: '/audio/letters/07-e.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%95%D0%B5_%E2%80%93_ukrainian.ogg' },
	є: { src: '/audio/letters/08-ye.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%84%D1%94_%E2%80%93_ukrainian.ogg' },
	ж: { src: '/audio/letters/09-zh.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%96%D0%B6_%E2%80%93_ukrainian.ogg' },
	з: { src: '/audio/letters/10-z.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%97%D0%B7_%E2%80%93_ukrainian.ogg' },
	и: { src: '/audio/letters/11-y.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%98%D0%B8_%E2%80%93_ukrainian.ogg' },
	і: { src: '/audio/letters/12-i.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%86%D1%96_%E2%80%93_ukrainian.ogg' },
	ї: { src: '/audio/letters/13-yi.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%87%D1%97_%E2%80%93_ukrainian.ogg' },
	й: { src: '/audio/letters/14-y.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%99%D0%B9_%E2%80%93_ukrainian.ogg' },
	к: { src: '/audio/letters/15-k.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%9A%D0%BA_%E2%80%93_ukrainian.ogg' },
	л: { src: '/audio/letters/16-l.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%9B%D0%BB_%E2%80%93_ukrainian.ogg' },
	м: { src: '/audio/letters/17-m.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%9C%D0%BC_%E2%80%93_ukrainian.ogg' },
	н: { src: '/audio/letters/18-n.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%9D%D0%BD_%E2%80%93_ukrainian.ogg' },
	о: { src: '/audio/letters/19-o.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%9E%D0%BE_%E2%80%93_ukrainian.ogg' },
	п: { src: '/audio/letters/20-p.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%9F%D0%BF_%E2%80%93_ukrainian.ogg' },
	р: { src: '/audio/letters/21-r.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A0%D1%80_%E2%80%93_ukrainian.ogg' },
	с: { src: '/audio/letters/22-s.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A1%D1%81_%E2%80%93_ukrainian.ogg' },
	т: { src: '/audio/letters/23-t.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A2%D1%82_%E2%80%93_ukrainian.ogg' },
	у: { src: '/audio/letters/24-u.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A3%D1%83_%E2%80%93_ukrainian.ogg' },
	ф: { src: '/audio/letters/25-f.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A4%D1%84_%E2%80%93_ukrainian.ogg' },
	х: { src: '/audio/letters/26-kh.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A5%D1%85_%E2%80%93_ukrainian.ogg' },
	ц: { src: '/audio/letters/27-ts.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A6%D1%86_%E2%80%93_ukrainian.ogg' },
	ч: { src: '/audio/letters/28-ch.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A7%D1%87_%E2%80%93_ukrainian.ogg' },
	ш: { src: '/audio/letters/29-sh.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A8%D1%88_%E2%80%93_ukrainian.ogg' },
	щ: { src: '/audio/letters/30-shch.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%A9%D1%89_%E2%80%93_ukrainian.ogg' },
	ю: { src: '/audio/letters/32-yu.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%AE%D1%8E_%E2%80%93_ukrainian.ogg' },
	я: { src: '/audio/letters/33-ya.mp3', page: 'https://commons.wikimedia.org/wiki/File:%D0%AF%D1%8F_%E2%80%93_ukrainian.ogg' }
};
