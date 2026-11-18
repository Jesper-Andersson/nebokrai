// Which case a verb or an adjective asks of the noun after it: its
// government. дякувати asks кому? (дякую мамі), користуватися asks чим?
// (користуюся телефоном), чекати на asks на кого? на що? (чекаю на автобус).
// An English speaker cannot guess these, since "thank", "use" and "wait for"
// take no case at all, and Wiktionary notes them on only about one common
// verb in ten. So the patterns are listed here by hand, each as a whole: the
// verb with its preposition and the question its noun answers.
//
// The list is written once, in GOVERNMENT_LIST below, and read twice:
//
// - here, for the practice page (each pattern is a grammar point, points.ts,
//   practised as the prepositions are) and for the word page ("takes кому?");
// - by data/import_wiktionary.py (add_government), which finds sentences for
//   each pattern in Tatoeba and makes the rest up to twenty from the nouns
//   named here ("frames": Я дякую мамі.).
//
// A pattern whose preposition takes only one case (думати про, залежати від)
// is shown on the word page and not practised: the preposition would give the
// answer away. Patterns that are only sometimes right were left out (дзвонити
// кому?, вчитися чого?), as were verbs whose noun is usually a second object
// (давати, казати, пояснювати: дати мамі книгу).
//
// Nothing here imports from Svelte or reads the database, so `npm test` runs
// it.

import { nationalTranslit } from '../search/normalize.ts';

/** The cases a pattern can ask for, by the short names the point ids end in. */
export type GovernmentCase = 'gen' | 'dat' | 'acc' | 'ins' | 'loc';

export interface Pattern {
	/** The grammar point's id, and the name a learner's progress is kept under: never changed once shipped. */
	id: string;
	/** The imperfective first, then its perfective where the dictionary pairs them: дякувати, подякувати. */
	lemmas: readonly string[];
	/** The preposition, in its first spelling (у, not в), or '' for none. */
	prep: string;
	case: GovernmentCase;
	/** Whether its noun is a person (кому?), a thing (чому?) or either. */
	asks: 'who' | 'what' | 'both';
	/** What it says in English, with {} for the noun: "thank {}". "be" stands for am, is and are. */
	en: string;
	/** The nouns its made-up sentences use: names of NOUN_SETS. Empty for a pattern not practised. */
	nouns: readonly string[];
	/** A short phrase that shows it, as /learn's table prints it: дякую мамі. */
	example: string;
	/** The noun stands before the verb (Мені подобається), and the sentences made say Це подобається мамі. */
	before: boolean;
	/** The noun names what the subject is (працюю лікарем), so the sentences made have one person: я, ти, він. */
	single: boolean;
	/** Found sentences count only with one of its own nouns: грати у футбол, not грати у неділю. */
	listed: boolean;
	/** The lesson it is practised in (lessons.ts), or '' for one shown only on the word page. */
	lesson: string;
}

// One pattern a line: lemmas | preposition (- for none) | case | asks | English | nouns | example | flags.
// A line in brackets starts a lesson, in the order the lessons are met: by the
// commonest verb in each (entries.freq), a lesson to a question. [page] holds
// the patterns shown only on the word page. The nouns are sets, named with @
// and listed in NOUN_SETS below.
export const GOVERNMENT_LIST = `
[gov-na-acc]
дивитися подивитися | на | acc | both | look at {} | @views | дивлюся на море
чекати почекати | на | acc | both | wait for {} | @waited | чекаю на автобус
сподіватися | на | acc | what | hope for {} | @hopes | сподіваюся на допомогу
відповідати відповісти | на | acc | what | answer {} | @questions | відповідаю на питання
розраховувати | на | acc | both | count on {} | @people | розраховую на брата
хворіти захворіти | на | acc | what | be ill with {} | @illnesses | хворію на грип
[gov-ins]
працювати | - | ins | who | work as {} | @jobs | працюю лікарем | single
їхати поїхати | - | ins | what | go by {} | @transport | їду автобусом
займатися зайнятися | - | ins | what | do {} | @pastimes | займаюся спортом
пишатися | - | ins | both | be proud of {} | @kin | пишаюся сином
користуватися скористатися | - | ins | what | use {} | @tools | користуюся телефоном
цікавитися | - | ins | both | be interested in {} | @subjects | цікавлюся музикою
[gov-gen]
боятися | - | gen | both | be afraid of {} | @fears | боюся темряви
вимагати | - | gen | what | demand {} | @demands | вимагаю правди
потребувати | - | gen | what | need {} | @needs | потребую допомоги
дотримуватися дотриматися | - | gen | what | keep to {} | @rules | дотримуюся правил
уникати уникнути | - | gen | both | avoid {} | @troubles | уникаю конфлікту
досягати досягти | - | gen | what | reach {} | @goals | досягаю мети
[gov-dat]
подобатися сподобатися | - | dat | who | {} like it | @people | мені подобається | before
дякувати подякувати | - | dat | who | thank {} | @people | дякую мамі
вірити повірити | - | dat | who | believe {} | @people | вірю другові
писати написати | - | dat | who | write to {} | @people | пишу братові
відповідати відповісти | - | dat | who | answer {} | @people | відповідаю вчителеві
допомагати допомогти | - | dat | who | help {} | @people | допомагаю сусідові
[gov-za-acc]
дякувати подякувати | за | acc | what | say thank you for {} | @favours | дякую за допомогу
хвилюватися | за | acc | who | worry about {} | @kin | хвилююся за сина
платити заплатити | за | acc | what | pay for {} | @bought | плачу за квиток
голосувати проголосувати | за | acc | both | vote for {} | @votes | голосую за закон
[gov-u-na]
вірити повірити | у | acc | what | believe in {} | @beliefs | вірю в перемогу
грати зіграти | у | acc | what | play {} | @games | граю у футбол | listed
грати зіграти | на | loc | what | play {} | @instruments | граю на гітарі | listed
зосереджуватися зосередитися | на | loc | what | concentrate on {} | @tasks | зосереджуюся на роботі
наполягати наполягти | на | loc | what | insist on {} | @insisted | наполягаю на зустрічі
[gov-na-who]
схожий | на | acc | who | look like {} | @kin | схожий на маму
сердитися розсердитися | на | acc | who | be angry with {} | @people | серджуся на брата
скаржитися поскаржитися | на | acc | both | complain about {} | @complaints | скаржуся на шум
ображатися образитися | на | acc | who | be hurt by {} | @people | ображаюся на друга
покладатися покластися | на | acc | both | rely on {} | @people | покладаюся на друга
[gov-z-ins]
розмовляти | з | ins | who | talk to {} | @people | розмовляю з мамою
зустрічатися зустрітися | з | ins | who | meet {} | @people | зустрічаюся з другом
погоджуватися погодитися | з | ins | who | agree with {} | @people | погоджуюся з братом
сваритися посваритися | з | ins | who | quarrel with {} | @people | сварюся з сестрою
прощатися | з | ins | who | say goodbye to {} | @people | прощаюся з другом
знайомитися познайомитися | з | ins | who | get to know {} | @people | знайомлюся з сусідом
[gov-dat-more]
довіряти довірити | - | dat | who | trust {} | @people | довіряю лікареві
вдячний | - | dat | who | be grateful to {} | @people | вдячний мамі
заважати завадити | - | dat | who | disturb {} | @people | заважаю сусідові
телефонувати зателефонувати | - | dat | who | phone {} | @people | телефоную мамі
радіти зрадіти | - | dat | both | be happy about {} | @gifts | радію подарунку
заздрити позаздрити | - | dat | who | envy {} | @people | заздрю братові
[gov-za-ins]
сумувати | за | ins | both | miss {} | @missed | сумую за домом
стежити | за | ins | both | keep an eye on {} | @watched | стежу за погодою
наглядати | за | ins | both | look after {} | @cared | наглядаю за дитиною
[page]
думати подумати | про | acc | both | think about {} | - | думаю про маму
мріяти | про | acc | both | dream of {} | - | мрію про море
піклуватися | про | acc | both | take care of {} | - | піклуюся про маму
звертатися звернутися | до | gen | who | turn to {} | - | звертаюся до лікаря
готуватися | до | gen | what | prepare for {} | - | готуюся до іспиту
звикати звикнути | до | gen | both | get used to {} | - | звикаю до міста
ставитися поставитися | до | gen | both | treat {} | - | добре ставлюся до нього
залежати | від | gen | both | depend on {} | - | залежить від погоди
відрізнятися відрізнитися | від | gen | both | differ from {} | - | відрізняється від брата
готовий | до | gen | what | be ready for {} | - | готовий до роботи
`;

// The nouns of the made-up sentences, with the English each is said with. A
// noun named in the plural (шахи) has no singular in use.
export const NOUN_SETS = `
@people = мама: my mother, тато: my father, брат: my brother, сестра: my sister, друг: my friend,
  подруга: my friend, лікар: the doctor, учитель: the teacher, сусід: the neighbour, бабуся: my grandmother,
  дідусь: my grandfather, син: my son, дочка: my daughter, колега: my colleague
@kin = мама: my mother, тато: my father, брат: my brother, сестра: my sister, син: my son, дочка: my daughter,
  бабуся: my grandmother, дідусь: my grandfather
@views = море: the sea, небо: the sky, гора: the mountain, картина: the picture, сонце: the sun,
  місто: the town, годинник: the clock, дорога: the road, мама: my mother, річка: the river
@waited = автобус: the bus, потяг: the train, відповідь: an answer, лист: a letter, мама: my mother,
  друг: my friend, сестра: my sister, лікар: the doctor, весна: spring, трамвай: the tram
@hopes = допомога: help, перемога: victory, успіх: success, мир: peace, підтримка: support,
  відповідь: an answer, диво: a miracle, удача: luck
@questions = питання: the question, запитання: the question, лист: the letter, повідомлення: the message,
  дзвінок: the call, запит: the request
@illnesses = грип: flu, застуда: a cold, ангіна: tonsillitis, діабет: diabetes, пневмонія: pneumonia, бронхіт: bronchitis
@jobs = лікар: a doctor, учитель: a teacher, інженер: an engineer, водій: a driver, кухар: a cook,
  журналіст: a journalist, програміст: a programmer, перекладач: a translator, офіціант: a waiter,
  бухгалтер: an accountant
@transport = автобус: bus, потяг: train, поїзд: train, трамвай: tram, тролейбус: trolleybus, машина: car
@pastimes = спорт: sport, музика: music, йога: yoga, плавання: swimming, бокс: boxing, теніс: tennis,
  бізнес: business, танці: dancing
@tools = телефон: the phone, комп'ютер: the computer, словник: a dictionary, ліфт: the lift, карта: the map,
  інтернет: the internet, ніж: a knife, ключ: a key, калькулятор: a calculator
@subjects = музика: music, історія: history, спорт: sport, політика: politics, мистецтво: art, наука: science,
  література: literature, мода: fashion, архітектура: architecture
@fears = темрява: the dark, висота: heights, гроза: the storm, блискавка: lightning, собака: the dog,
  самотність: loneliness, смерть: death, війна: war
@demands = правда: the truth, справедливість: justice, відповідь: an answer, пояснення: an explanation,
  повага: respect, увага: attention, тиша: silence
@needs = допомога: help, порада: advice, відпочинок: rest, підтримка: support, увага: attention, час: time,
  лікування: treatment, гроші: money
@rules = правило: the rule, закон: the law, дієта: a diet, план: the plan, порада: the advice,
  традиція: tradition, розклад: the timetable
@troubles = конфлікт: conflict, помилка: a mistake, ризик: risk, сусід: the neighbour, розмова: the conversation,
  суперечка: an argument, спека: the heat
@goals = мета: the goal, успіх: success, результат: a result, вершина: the summit, мир: peace, згода: agreement,
  перемога: victory
@favours = допомога: the help, подарунок: the present, порада: the advice, увага: your attention,
  вечеря: dinner, підтримка: the support, запрошення: the invitation, квіти: the flowers
@bought = квиток: the ticket, кава: the coffee, обід: lunch, квартира: the flat, світло: electricity,
  вода: water, газ: gas, навчання: tuition
@votes = кандидат: the candidate, закон: the law, план: the plan, партія: the party, президент: the president,
  зміни: change
@beliefs = любов: love, перемога: victory, успіх: success, доля: fate, справедливість: justice,
  дружба: friendship
@games = футбол: football, теніс: tennis, шахи: chess, карти: cards, хокей: hockey, баскетбол: basketball,
  волейбол: volleyball, гольф: golf
@instruments = гітара: the guitar, скрипка: the violin, барабан: the drum, флейта: the flute,
  бандура: the bandura, труба: the trumpet, віолончель: the cello, акордеон: the accordion,
  саксофон: the saxophone, арфа: the harp
@tasks = робота: my work, навчання: my studies, мета: the goal, завдання: the task, проблема: the problem,
  розмова: the conversation, текст: the text
@insisted = зустріч: a meeting, відповідь: an answer, пояснення: an explanation, перевірка: a check,
  правда: the truth, лікування: treatment
@complaints = шум: the noise, погода: the weather, сусід: the neighbour, біль: pain, холод: the cold,
  спека: the heat, лікар: the doctor
@gifts = подарунок: the present, весна: spring, сонце: the sun, сніг: the snow, перемога: the victory,
  новина: the news, зустріч: the meeting
@missed = мама: my mother, дім: home, брат: my brother, друг: my friend, сестра: my sister, море: the sea,
  літо: summer, село: the village, батьківщина: my homeland
@watched = дитина: the child, погода: the weather, новини: the news, здоров'я: my health, час: the time,
  політика: politics, дорога: the road
@cared = дитина: the child, будинок: the house, собака: the dog, сад: the garden, брат: my brother, кіт: the cat,
  порядок: order
`;

/** The questions of each case: who (a person) and what (a thing), as Ukrainian schools teach them. */
const QUESTIONS: Record<GovernmentCase, readonly [who: string, what: string]> = {
	gen: ['кого', 'чого'],
	dat: ['кому', 'чому'],
	acc: ['кого', 'що'],
	ins: ['ким', 'чим'],
	loc: ['кому', 'чому']
};

/** The prepositions after which the noun could be in either of two cases, so practice can ask which. */
const TWO_CASES = new Set(['на', 'у', 'з', 'за', 'під']);

function parse(): Pattern[] {
	const out: Pattern[] = [];
	let lesson = '';
	for (const raw of GOVERNMENT_LIST.split('\n')) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith('[')) {
			lesson = line.slice(1, -1);
			continue;
		}
		const [lemmas, prep, kase, asks, en, nouns, example, flags = ''] = line.split('|').map((part) => part.trim());
		const words = lemmas.split(' ');
		const p = prep === '-' ? '' : prep;
		out.push({
			id: [nationalTranslit(words[0]), ...(p ? [nationalTranslit(p)] : []), kase].join('-'),
			lemmas: words,
			prep: p,
			case: kase as GovernmentCase,
			asks: asks as Pattern['asks'],
			en,
			nouns: nouns === '-' ? [] : nouns.split(' ').map((name) => name.slice(1)),
			example,
			before: flags.split(' ').includes('before'),
			single: flags.split(' ').includes('single'),
			listed: flags.split(' ').includes('listed'),
			lesson: lesson === 'page' ? '' : lesson
		});
	}
	return out;
}

/** Every pattern, practised or not, in the order of the list. */
export const GOVERNMENT: readonly Pattern[] = parse();

/** The patterns practised on /practice, in the order of their lessons. */
export const PRACTISED: readonly Pattern[] = GOVERNMENT.filter((pattern) => pattern.lesson);

/** The lessons of the practised patterns, in order: id and its patterns' ids. */
export const GOVERNMENT_LESSONS: readonly { id: string; points: readonly string[] }[] = [
	...new Set(PRACTISED.map((pattern) => pattern.lesson))
].map((id) => ({ id, points: PRACTISED.filter((pattern) => pattern.lesson === id).map((pattern) => pattern.id) }));

/** Whether a pattern can be practised: its preposition, if any, takes more than one case. */
export const isPractisable = (pattern: Pattern): boolean => !pattern.prep || TWO_CASES.has(pattern.prep);

/**
 * The question the noun answers, with the preposition: кому?, на кого? на що?
 * Made from the case, the preposition and `asks`, so no Ukrainian is written by hand.
 */
export function askOf(pattern: Pattern): string {
	const [who, what] = QUESTIONS[pattern.case];
	const words = pattern.asks === 'who' ? [who] : pattern.asks === 'what' ? [what] : [who, what];
	const prep = pattern.prep === 'у' ? 'у' : pattern.prep;
	return words.map((word) => `${prep ? prep + ' ' : ''}${word}?`).join(' ');
}

/** What comes before the question: the verb, with its preposition (чекати на), as the rule card prints it. */
export const cueOfPattern = (pattern: Pattern): string => pattern.lemmas[0];

/** What it says in English, the noun as "someone" or "something": to thank someone. */
export function meaningOf(pattern: Pattern): string {
	const noun = pattern.asks === 'who' ? 'someone' : pattern.asks === 'what' ? 'something' : 'someone or something';
	const said = pattern.en.replace('{}', noun);
	return pattern.before ? said.replace(' like it', ' likes it') : `to ${said}`;
}

const BY_ID = new Map(GOVERNMENT.map((pattern) => [pattern.id, pattern]));

export const patternOf = (id: string): Pattern | undefined => BY_ID.get(id);

/** Whether a point's id is a government pattern's. */
export const isGovernmentPoint = (id: string): boolean => BY_ID.has(id);

/**
 * The patterns a word takes part in, by its dictionary form, either aspect:
 * подякувати finds дякувати + кому? and дякувати за + що?
 */
export function governmentOf(word: string): Pattern[] {
	return GOVERNMENT.filter((pattern) => pattern.lemmas.includes(word));
}

/**
 * у or в, з, із or зі, as the sounds around it ask: в between vowels (граю в
 * теніс), у between consonants and before в or ф (граємо у футбол); зі before
 * з, с, ш, ж, ч, щ and a consonant (зі школи), із between two such sounds,
 * else з. The same rule is in data/import_wiktionary.py, which makes the
 * sentences; a test checks them against this.
 */
export function euphonic(before: string, prep: string, after: string): string {
	const vowel = (ch: string) => 'аеєиіїоуюя'.includes(ch);
	const end = [...before.toLowerCase()].at(-1) ?? '';
	const [first = '', second = ''] = [...after.toLowerCase()];
	if (prep === 'у' || prep === 'в') {
		if ('вф'.includes(first) || second === 'в') return 'у';
		if (!vowel(end) && !vowel(first)) return 'у';
		return 'в';
	}
	if (prep === 'з' || prep === 'із' || prep === 'зі') {
		const hiss = (ch: string) => 'зсцчшжщ'.includes(ch);
		if (hiss(first) && second && !vowel(second)) return 'зі';
		if (hiss(first) || (!vowel(end) && !vowel(first))) return 'із';
		return 'з';
	}
	return prep;
}
