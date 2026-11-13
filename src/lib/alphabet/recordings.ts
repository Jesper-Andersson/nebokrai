// The recordings of the letters on the alphabet page (/alphabet): one of each
// letter but ь, by one speaker, on Wikimedia Commons, played from there.
//
// Made by data/letter_recordings.py; do not edit by hand.

/** Who recorded them and under which licence: said once, beside the letters. */
export const RECORDINGS_CREDIT = {
	author: 'Tabrus',
	licence: 'CC BY-SA 4.0',
	licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
	category: 'https://commons.wikimedia.org/wiki/Category:Ukrainian_pronunciation_of_letters_by_a_young_male_uploaded_by_Tabrus'
};

/** The mp3 of each letter, by the letter in lower case. */
export const RECORDINGS: Record<string, string> = {
	а: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c6/%D0%90%D0%B0_%E2%80%93_ukrainian.ogg/%D0%90%D0%B0_%E2%80%93_ukrainian.ogg.mp3',
	б: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/fb/%D0%91%D0%B1_%E2%80%93_ukrainian.ogg/%D0%91%D0%B1_%E2%80%93_ukrainian.ogg.mp3',
	в: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b4/%D0%92%D0%B2_%E2%80%93_ukrainian.ogg/%D0%92%D0%B2_%E2%80%93_ukrainian.ogg.mp3',
	г: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/d/dd/%D0%93%D0%B3_%E2%80%93_ukrainian.ogg/%D0%93%D0%B3_%E2%80%93_ukrainian.ogg.mp3',
	ґ: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/e/eb/%D2%90%D2%91_%E2%80%93_ukrainian.ogg/%D2%90%D2%91_%E2%80%93_ukrainian.ogg.mp3',
	д: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3a/%D0%94%D0%B4_%E2%80%93_ukrainian.ogg/%D0%94%D0%B4_%E2%80%93_ukrainian.ogg.mp3',
	е: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/42/%D0%95%D0%B5_%E2%80%93_ukrainian.ogg/%D0%95%D0%B5_%E2%80%93_ukrainian.ogg.mp3',
	є: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/7/78/%D0%84%D1%94_%E2%80%93_ukrainian.ogg/%D0%84%D1%94_%E2%80%93_ukrainian.ogg.mp3',
	ж: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/3/38/%D0%96%D0%B6_%E2%80%93_ukrainian.ogg/%D0%96%D0%B6_%E2%80%93_ukrainian.ogg.mp3',
	з: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/7/76/%D0%97%D0%B7_%E2%80%93_ukrainian.ogg/%D0%97%D0%B7_%E2%80%93_ukrainian.ogg.mp3',
	и: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/13/%D0%98%D0%B8_%E2%80%93_ukrainian.ogg/%D0%98%D0%B8_%E2%80%93_ukrainian.ogg.mp3',
	і: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/26/%D0%86%D1%96_%E2%80%93_ukrainian.ogg/%D0%86%D1%96_%E2%80%93_ukrainian.ogg.mp3',
	ї: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/%D0%87%D1%97_%E2%80%93_ukrainian.ogg/%D0%87%D1%97_%E2%80%93_ukrainian.ogg.mp3',
	й: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/7/71/%D0%99%D0%B9_%E2%80%93_ukrainian.ogg/%D0%99%D0%B9_%E2%80%93_ukrainian.ogg.mp3',
	к: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a4/%D0%9A%D0%BA_%E2%80%93_ukrainian.ogg/%D0%9A%D0%BA_%E2%80%93_ukrainian.ogg.mp3',
	л: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cf/%D0%9B%D0%BB_%E2%80%93_ukrainian.ogg/%D0%9B%D0%BB_%E2%80%93_ukrainian.ogg.mp3',
	м: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/25/%D0%9C%D0%BC_%E2%80%93_ukrainian.ogg/%D0%9C%D0%BC_%E2%80%93_ukrainian.ogg.mp3',
	н: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/48/%D0%9D%D0%BD_%E2%80%93_ukrainian.ogg/%D0%9D%D0%BD_%E2%80%93_ukrainian.ogg.mp3',
	о: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/6/63/%D0%9E%D0%BE_%E2%80%93_ukrainian.ogg/%D0%9E%D0%BE_%E2%80%93_ukrainian.ogg.mp3',
	п: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2a/%D0%9F%D0%BF_%E2%80%93_ukrainian.ogg/%D0%9F%D0%BF_%E2%80%93_ukrainian.ogg.mp3',
	р: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/49/%D0%A0%D1%80_%E2%80%93_ukrainian.ogg/%D0%A0%D1%80_%E2%80%93_ukrainian.ogg.mp3',
	с: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a3/%D0%A1%D1%81_%E2%80%93_ukrainian.ogg/%D0%A1%D1%81_%E2%80%93_ukrainian.ogg.mp3',
	т: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/5/51/%D0%A2%D1%82_%E2%80%93_ukrainian.ogg/%D0%A2%D1%82_%E2%80%93_ukrainian.ogg.mp3',
	у: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/40/%D0%A3%D1%83_%E2%80%93_ukrainian.ogg/%D0%A3%D1%83_%E2%80%93_ukrainian.ogg.mp3',
	ф: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c8/%D0%A4%D1%84_%E2%80%93_ukrainian.ogg/%D0%A4%D1%84_%E2%80%93_ukrainian.ogg.mp3',
	х: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d0/%D0%A5%D1%85_%E2%80%93_ukrainian.ogg/%D0%A5%D1%85_%E2%80%93_ukrainian.ogg.mp3',
	ц: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/0/01/%D0%A6%D1%86_%E2%80%93_ukrainian.ogg/%D0%A6%D1%86_%E2%80%93_ukrainian.ogg.mp3',
	ч: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/19/%D0%A7%D1%87_%E2%80%93_ukrainian.ogg/%D0%A7%D1%87_%E2%80%93_ukrainian.ogg.mp3',
	ш: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/29/%D0%A8%D1%88_%E2%80%93_ukrainian.ogg/%D0%A8%D1%88_%E2%80%93_ukrainian.ogg.mp3',
	щ: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/d/dd/%D0%A9%D1%89_%E2%80%93_ukrainian.ogg/%D0%A9%D1%89_%E2%80%93_ukrainian.ogg.mp3',
	ю: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d9/%D0%AE%D1%8E_%E2%80%93_ukrainian.ogg/%D0%AE%D1%8E_%E2%80%93_ukrainian.ogg.mp3',
	я: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a4/%D0%AF%D1%8F_%E2%80%93_ukrainian.ogg/%D0%AF%D1%8F_%E2%80%93_ukrainian.ogg.mp3'
};
