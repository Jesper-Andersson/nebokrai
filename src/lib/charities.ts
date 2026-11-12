// The funds on /support, grouped by what they do. Kept apart from the page so
// that the list can be shown elsewhere later (one fund on the home page, say).
//
// To add a fund: it must work for Ukraine only, so that a gift cannot go
// elsewhere (World Central Kitchen was left out for this: its donations pay
// for its work worldwide). It must have a site of its own that takes
// donations, and the link goes there, never to a collector in between.
// Fraudsters copy funds' sites (Voices of Children warns of a look-alike
// address), so take the address from the fund itself, then set CHECKED to
// the day you looked.
//
// A logo is the icon the fund's own site gives browsers, saved as it came
// into static/funds/. Come Back Alive's and the Prytula Foundation's were
// saved by hand (user, 2026-11-12): their sites refuse automated requests.
// A fund without a logo is shown with its first letter.

export interface Charity {
	name: string;
	/** The name Ukrainians know it by, when that differs: Повернись живим */
	nameUk?: string;
	/** The English version of the site where there is one */
	url: string;
	/** The Ukrainian version, when it has another address */
	urlUk?: string;
	/** A file in static/funds/ */
	logo?: string;
	/** For a logo drawn in white (savED's bird): it is set on a dark tile, not a white one */
	logoOnDark?: boolean;
	en: string;
	uk: string;
}

export interface Area {
	/** The dictionary entry the heading links to: тварина for «тварини» */
	word: string;
	/** The heading, set as a headword: lower case, with its stress marked */
	heading: string;
	/** What the heading means, shown beside it in the English interface */
	en: string;
	items: Charity[];
}

/** The day the list was last gone through, as the page prints it. */
export const CHECKED = { en: '12 November 2026', uk: '12 листопада 2026 року' };

export const AREAS: Area[] = [
	{
		word: 'держава',
		heading: 'держа́ва',
		en: 'The state',
		items: [
			{
				name: 'United24',
				logo: 'united24.png',
				url: 'https://u24.gov.ua/',
				en: 'Ukraine’s official fundraising platform, started by the President: defence, demining, medical aid, rebuilding, education and science.',
				uk: 'Офіційна фандрейзингова платформа України, започаткована Президентом: оборона, розмінування, медична допомога, відбудова, освіта й наука.'
			}
		]
	},
	{
		word: 'оборона',
		heading: 'оборо́на',
		en: 'Defence',
		items: [
			{
				name: 'Come Back Alive',
				nameUk: 'Повернись живим',
				logo: 'come-back-alive.png',
				url: 'https://savelife.in.ua/en/',
				urlUk: 'https://savelife.in.ua/',
				en: 'Buys equipment for Ukraine’s defence forces, from thermal optics to drones and vehicles. Working since 2014.',
				uk: 'Закуповує спорядження для Сил оборони: від тепловізорів до дронів і автомобілів. Працює з 2014 року.'
			},
			{
				name: 'Serhiy Prytula Charity Foundation',
				nameUk: 'Фонд Сергія Притули',
				logo: 'prytula.png',
				url: 'https://prytulafoundation.org/en',
				urlUk: 'https://prytulafoundation.org/',
				en: 'Supplies the army with drones, vehicles and communications, and runs humanitarian projects for civilians.',
				uk: 'Забезпечує військо дронами, автомобілями та зв’язком і веде гуманітарні проєкти для цивільних.'
			},
			{
				// The link is to the fund's standing fundraiser, not its front page (user, 2026-11-12)
				name: 'Sternenko Community',
				nameUk: 'Спільнота Стерненка',
				logo: 'sternenko.png',
				url: 'https://www.sternenkofund.org/en/fundraisings/rusoriz',
				urlUk: 'https://www.sternenkofund.org/fundraisings/rusoriz',
				en: 'Its standing fundraiser, Rusoriz, supplies Ukraine’s defence forces with FPV drones every day.',
				uk: 'Постійний збір «Русоріз»: щодня забезпечує Сили оборони FPV-дронами.'
			}
		]
	},
	{
		word: 'медицина',
		heading: 'медици́на',
		en: 'Medicine',
		items: [
			{
				name: 'Hospitallers',
				nameUk: 'Госпітальєри',
				logo: 'hospitallers.png',
				url: 'https://www.hospitallers.life/',
				en: 'Volunteer paramedics who give first aid at the front and evacuate the wounded.',
				uk: 'Добровольчий медичний батальйон: перша допомога на фронті й евакуація поранених.'
			},
			{
				name: 'Superhumans Center',
				logo: 'superhumans.png',
				url: 'https://superhumans.com/en/',
				urlUk: 'https://superhumans.com/',
				en: 'Free prosthetics, reconstructive surgery, rehabilitation and psychological support for people injured in the war.',
				uk: 'Безплатне протезування, реконструктивна хірургія, реабілітація та психологічна підтримка для постраждалих від війни.'
			}
		]
	},
	{
		word: 'допомога',
		heading: 'допомо́га',
		en: 'Aid',
		items: [
			{
				name: 'East SOS',
				nameUk: 'Схід SOS',
				logo: 'east-sos.png',
				url: 'https://east-sos.org/en/',
				urlUk: 'https://east-sos.org/',
				en: 'Helps people affected by the war and those forced to leave their homes.',
				uk: 'Допомагає постраждалим від війни та людям, які мусили покинути свої домівки.'
			},
			{
				name: 'Razom for Ukraine',
				logo: 'razom.png',
				url: 'https://www.razomforukraine.org/',
				en: 'A charity registered in the United States that sends medical supplies and supports Ukrainian volunteer groups.',
				uk: 'Благодійна організація зі США: передає медичне приладдя й підтримує українські волонтерські ініціативи.'
			},
			{
				name: 'Nova Ukraine',
				logo: 'nova-ukraine.png',
				url: 'https://novaukraine.org/',
				en: 'A charity registered in the United States, a 501(c)(3), that delivers humanitarian aid to Ukraine.',
				uk: 'Благодійна організація зі США (501(c)(3)), що доставляє гуманітарну допомогу в Україну.'
			}
		]
	},
	{
		word: 'діти',
		heading: 'ді́ти',
		en: 'Children',
		items: [
			{
				name: 'Voices of Children',
				nameUk: 'Голоси дітей',
				logo: 'voices-of-children.png',
				url: 'https://voices.org.ua/en/',
				urlUk: 'https://voices.org.ua/',
				en: 'Psychological support for children affected by the war, in centres across Ukraine.',
				uk: 'Психологічна підтримка дітей, які постраждали від війни, у центрах по всій Україні.'
			},
			{
				name: 'Tabletochki',
				nameUk: 'Таблеточки',
				logo: 'tabletochki.png',
				url: 'https://tabletochki.org/en/',
				urlUk: 'https://tabletochki.org/',
				en: 'Helps children with cancer and their families at every stage of the illness.',
				uk: 'Допомагає дітям з онкологічними захворюваннями та їхнім родинам на кожному етапі хвороби.'
			}
		]
	},
	{
		word: 'освіта',
		heading: 'осві́та',
		en: 'Education',
		items: [
			{
				name: 'savED',
				logo: 'saved.png',
				logoOnDark: true,
				url: 'https://saved.foundation/en/',
				urlUk: 'https://saved.foundation/',
				en: 'Brings schooling back to communities where the war damaged or destroyed schools.',
				uk: 'Повертає навчання в громади, де війна пошкодила чи зруйнувала школи.'
			},
			{
				name: 'KSE Foundation',
				logo: 'kse-foundation.png',
				url: 'https://foundation.kse.ua/en/',
				urlUk: 'https://foundation.kse.ua/',
				en: 'The Kyiv School of Economics’ charity: help for people affected by the war and support for education and research.',
				uk: 'Благодійний фонд Київської школи економіки: допомога постраждалим від війни й підтримка освіти та науки.'
			}
		]
	},
	{
		word: 'тварина',
		heading: 'твари́ни',
		en: 'Animals',
		items: [
			{
				name: 'UAnimals',
				logo: 'uanimals.png',
				url: 'https://uanimals.org/en/',
				urlUk: 'https://uanimals.org/',
				en: 'Rescues animals from front-line areas and supports shelters.',
				uk: 'Рятує тварин із прифронтових територій і підтримує притулки.'
			},
			{
				name: 'Happy Paw',
				logo: 'happy-paw.png',
				url: 'https://happypaw.ua/en',
				urlUk: 'https://happypaw.ua/',
				en: 'Helps homeless cats and dogs and the shelters that look after them.',
				uk: 'Допомагає безпритульним котам і собакам та притулкам, які про них дбають.'
			}
		]
	},
	{
		word: 'відбудова',
		heading: 'відбудо́ва',
		en: 'Rebuilding',
		items: [
			{
				name: 'Dobrobat',
				nameUk: 'Добробат',
				logo: 'dobrobat.png',
				url: 'https://www.dobrobat.in.ua/en/',
				urlUk: 'https://www.dobrobat.in.ua/',
				en: 'A volunteer construction battalion that makes urgent repairs to homes and public buildings damaged by the war.',
				uk: 'Добровольчий будівельний батальйон: терміново відновлює житло й соціальні об’єкти, пошкоджені війною.'
			}
		]
	},
	{
		word: 'культура',
		heading: 'культу́ра',
		en: 'Culture',
		items: [
			{
				name: 'PEN Ukraine',
				nameUk: 'Український ПЕН',
				logo: 'pen-ukraine.png',
				url: 'https://pen.org.ua/en',
				urlUk: 'https://pen.org.ua/',
				en: 'The writers’ association: discussions, literary awards, authors’ trips to the regions and books.',
				uk: 'Об’єднання письменників: дискусії, літературні премії, поїздки авторів у регіони та книжки.'
			}
		]
	},
	{
		word: 'ветеран',
		heading: 'ветера́ни',
		en: 'Veterans',
		items: [
			{
				name: 'Veteran Hub',
				logo: 'veteran-hub.png',
				url: 'https://veteranhub.com.ua/',
				en: 'Free legal, psychological and career support for soldiers, veterans and their families. The site is in Ukrainian.',
				uk: 'Безплатна юридична, психологічна та кар’єрна підтримка для військових, ветеранів та їхніх родин.'
			}
		]
	}
];
