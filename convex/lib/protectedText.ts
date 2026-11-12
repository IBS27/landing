/**
 * Protected traits never reach a model and are never kept as evidence (the
 * brief's "never use protected traits" rule). `redactProtected` replaces what
 * a person says about who they are (age, religion, ethnicity or national
 * origin, gender or orientation, disability or health, pregnancy or family
 * status, veteran status, political affiliation) with `REDACTED`, so only the
 * rest of their words, the activities, places and plans, are read or quoted.
 *
 * It errs on the side of removing too much: a removed word costs one
 * suggestion, a kept one could leak a protected trait into a fact. Client-safe.
 */

export const REDACTED = "[removed]";

const DEMONYMS = [
  "afghan",
  "african",
  "albanian",
  "algerian",
  "american",
  "arab",
  "arabic",
  "argentin(?:e|ian)",
  "armenian",
  "asian",
  "australian",
  "austrian",
  "bangladeshi",
  "brazilian",
  "british",
  "bulgarian",
  "burmese",
  "cambodian",
  "canadian",
  "cantonese",
  "caribbean",
  "caucasian",
  "chilean",
  "chinese",
  "colombian",
  "congolese",
  "croatian",
  "cuban",
  "czech",
  "danish",
  "dominican",
  "dutch",
  "ecuadorian",
  "egyptian",
  "english",
  "eritrean",
  "ethiopian",
  "european",
  "filipin[ao]",
  "finnish",
  "french",
  "german",
  "ghanaian",
  "greek",
  "guatemalan",
  "haitian",
  "hispanic",
  "honduran",
  "hungarian",
  "indian",
  "indigenous",
  "indonesian",
  "iranian",
  "iraqi",
  "irish",
  "israeli",
  "italian",
  "jamaican",
  "japanese",
  "jordanian",
  "kenyan",
  "korean",
  "kurdish",
  "laotian",
  "latin[aoxe]",
  "lebanese",
  "malaysian",
  "mandarin",
  "mexican",
  "middle eastern",
  "mongolian",
  "moroccan",
  "native american",
  "nepali",
  "nicaraguan",
  "nigerian",
  "norwegian",
  "pacific islander",
  "pakistani",
  "palestinian",
  "persian",
  "peruvian",
  "polish",
  "portuguese",
  "puerto rican",
  "punjabi",
  "romanian",
  // Not "Russian Hill", a San Francisco neighborhood.
  "russian(?![\\s-]+hill)",
  "salvadoran",
  "samoan",
  "saudi",
  "scottish",
  "senegalese",
  "serbian",
  "sikh",
  "singaporean",
  "slovak",
  "somali",
  "south asian",
  "spanish",
  "sri lankan",
  "sudanese",
  "swedish",
  "swiss",
  "syrian",
  "taiwanese",
  "tamil",
  "thai",
  "tibetan",
  "tongan",
  "turkish",
  "ugandan",
  "ukrainian",
  "venezuelan",
  "vietnamese",
  "welsh",
  "yemeni",
];

const COUNTRIES = [
  "afghanistan",
  "africa",
  "argentina",
  "armenia",
  "asia",
  "australia",
  "bangladesh",
  "brazil",
  "burma",
  "cambodia",
  "canada",
  "central america",
  "chile",
  "china",
  "colombia",
  "cuba",
  "dominican republic",
  "ecuador",
  "egypt",
  "el salvador",
  "england",
  "eritrea",
  "ethiopia",
  "europe",
  "france",
  "germany",
  "ghana",
  "greece",
  "guatemala",
  "haiti",
  "honduras",
  "hong kong",
  "india",
  "indonesia",
  "iran",
  "iraq",
  "ireland",
  "israel",
  "italy",
  "jamaica",
  "japan",
  "kenya",
  "korea",
  "laos",
  "latin america",
  "lebanon",
  "malaysia",
  "mexico",
  "middle east",
  "mongolia",
  "morocco",
  "myanmar",
  "nepal",
  "netherlands",
  "new zealand",
  "nicaragua",
  "nigeria",
  "norway",
  "pakistan",
  "palestine",
  "peru",
  "philippines",
  "poland",
  "portugal",
  "puerto rico",
  "romania",
  "russia",
  "saudi arabia",
  "scotland",
  "singapore",
  "somalia",
  "south america",
  "spain",
  "sri lanka",
  "sudan",
  "sweden",
  "syria",
  "taiwan",
  "thailand",
  "the caribbean",
  "tibet",
  "turkey",
  "uganda",
  "ukraine",
  "venezuela",
  "vietnam",
];

/** Words that state a protected trait wherever they appear. */
const TERMS: string[] = [
  // Age
  "\\d{1,3}[\\s-]*(?:years?|yrs?)[\\s-]*old|\\d{1,3}\\s?(?:yo|y\\/o)",
  // "I'm 30", not "I'm 5 minutes away" or "I'm 2k short".
  "(?:i['’]?m|i am)\\s+\\d{1,3}(?!\\d|[.,]\\d|\\s*(?:k\\b|%|minutes?|mins?|blocks?|miles?|hours?|hrs?|days?|weeks?|months?|am\\b|pm\\b))",
  "(?:in (?:my|our) )?(?:early |mid[\\s-]?|late )?(?:teens|twenties|thirties|forties|fifties|sixties|seventies)",
  "(?:in (?:my|our) (?:early |mid[\\s-]?|late )?|early |mid[\\s-]?|late )[1-9]0'?s",
  "(?:twenty|thirty|forty|fifty|sixty|seventy)[\\s-]*something",
  "(?:turn(?:ed|ing)?|aged?) \\d{1,3}",
  "born in (?:19|20)\\d\\d",
  "retirees?|retired|senior citizens?|millennials?|gen[\\s-]?[zxy]|boomers?|teenagers?",
  // Religion
  "religio(?:n|ns|us)",
  "faith",
  "muslims?|islam(?:ic)?|christians?|christianity|catholics?|catholicism|protestants?|evangelicals?",
  "mormons?|lds|jews?|jewish|judaism|hindus?|hinduism|buddhists?|buddhism|sikhism",
  "jains?|jainism|atheists?|agnostics?|pagans?|wiccan|baptists?|methodists?|lutherans?|orthodox",
  "quakers?|scientologists?|baha'?is?|zoroastrian",
  "church(?:goer|es)?|mosques?|synagogues?|temples?|gurdwaras?|masjid",
  "bible|quran|koran|torah|ramadan|shabbat|sabbath|halal|kosher|pray(?:s|ed|ing|er|ers)?",
  // Ethnicity, race and national origin
  `(?:${DEMONYMS.join("|")})(?:[\\s-]+american)?`,
  "ethnicity|ethnic|racial|my race|nationality|citizenship|immigrants?|immigrated|refugees?|undocumented|green card",
  "h-?1b|(?:work|student) visa|on an? (?:\\w+ )?visa|visa status",
  "(?:people|persons?|folks?|wom[ae]n|m[ae]n|communit(?:y|ies)) of colou?r|poc|bipoc",
  // Countries and regions someone may come from (not "Russian Hill" or "Chinatown").
  `(?:${COUNTRIES.join("|")})`,
  // Gender and orientation
  "wom[ae]n|females?|males?|girls?|boys?|lad(?:y|ies)|gentlem[ae]n|gals?|guys?|dudes?",
  "non[\\s-]?binary|enby|trans(?:gender|man|woman)?|cis(?:gender)?|genderqueer|genderfluid|gender",
  "gay|lesbians?|bisexual|bi|queer|straight|heterosexual|homosexual|asexual|pansexual|lgbt\\w*|sexuality",
  "pronouns|she\\/her|he\\/him|they\\/them",
  // Disability and health
  "disabled|disabilit(?:y|ies)|handicapped|wheelchair|deaf|blind|hard of hearing|visually impaired",
  "autis(?:tic|m)|adhd|dyslexi[ac]|bipolar|schizophreni[ac]|depress(?:ed|ion)|anxiety|ptsd|ocd",
  "chronic(?: illness| pain| fatigue)?|diabet(?:ic|es)|cancer|hiv|aids|epilep(?:sy|tic)|asthma|celiac",
  "(?:multiple )?sclerosis|lupus|crohn['’]?s|arthritis|migraines?|seizures?|dementia|alzheimer['’]?s|parkinson['’]?s",
  "hepatitis|cerebral palsy|down syndrome|disease|disorder|syndrome|(?:medical|health|heart|chronic) condition",
  "neurodivergent|neurodiverse|hearing aids?|cochlear|prosthe\\w+|amputee|paraly[sz]ed|service (?:dog|animal)|guide dog",
  "mobility (?:issues?|aid|scooter)|cane",
  "sober|sobriety|in recovery|addict(?:ed|ion)?|alcoholic|mental health|therap(?:y|ist)|medications?",
  "immunocompromised|illness|chronically ill|surgery|injur(?:y|ed)|pregnan(?:t|cy)",
  "expecting (?:a baby|a child|twins|our first|my first)",
  // Family and relationship status
  "kids?|children|child|babies|baby|toddlers?|sons?|daughters?|moms?|mums?|mother|dads?|father",
  "parents?|parenting|stepparent|single (?:mom|dad|parent|mother|father)|newborn|infant",
  "married|divorced|widow(?:ed|er)?|husband|wife|spouse|fianc[eé]e?|engaged(?! (?:in|with))",
  "boyfriend|girlfriend|(?:my|our|with (?:a|my)|domestic) partner|(?:my|our|a young|with (?:my|our)) family",
  "family status|(?:i['’]?m|i am|we['’]?re|we are) single|single (?:mom|dad|parent|mother|father)",
  // More everyday ways people say the same things
  // "I'm thirty", "I'm over 50"; not "I'm about 20 minutes away" or "we are 2 people".
  "(?:i['’]?m|i am)\\s+(?:(?:over|under|almost|nearly)\\s+\\d{1,2}|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty)(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?)(?![\\w$%-]|[.,]\\d|\\s*(?:k\\b|%|minutes?|mins?|blocks?|miles?|hours?|hrs?|days?|weeks?|months?))",
  "(?:i['’]?m|i am|we['’]?re|we are)\\s+(?:a\\s+)?(?:young|old|older|younger|elderly|senior|vet|native)(?=\\s*(?:[,.;!?]|$|and\\b|but\\b))",
  "elderly|grand(?:mother|father|parents?|ma|pa|kids?|children|son|daughter)",
  "(?:i['’]?m|i am|we['’]?re|we are) expecting",
  "newlyweds?|same[\\s-]sex|on the spectrum|hearing impaired|antidepressants?|antipsychotics?|insulin",
  "mixed[\\s-]race|biracial|multiracial|desi|chican[aoxe]|pinoy|pinay|daca|dreamers?|citizens?",
  "(?:go|going|goes|attend|attending) (?:to )?mass",
  // Veteran status and politics
  "veterans?|military|army|marines?|(?<!old )navy|air force|coast guard|national guard|active[\\s-]duty|reservists?|served in the",
  "democrats?|republicans?|conservative|liberal|progressive|libertarian|socialist|maga|tor(?:y|ies)",
  "(?:left|right)[\\s-]wing|green party|politically \\w+|independent voter",
  // Relationship and family status, said other ways
  "single(?![\\s-]+(?:room|bed\\w*|famil\\w*|stor\\w*|occupancy|units?|studio|apartment|level|home|house|day|month|week))",
  "(?:i['’]?m|i am|we['’]?re|we are|as|part of)\\s+(?:an?\\s+)?(?:\\w+\\s+)?couple(?!\\s+of)",
  "(?:married|gay|lesbian|same[\\s-]sex|young|unmarried|engaged|older) couple",
  "in a (?:relationship|civil partnership|domestic partnership)|civil partnership|domestic partnership",
  "unmarried|unwed|separated|bachelor(?:ette)?|family of (?:\\d+|two|three|four|five|six)",
  "foster(?:ing| carer| parent)?|caregiver|carer|breastfeeding|nursing mother|maternity|paternity|parental leave",
  // Age, said other ways
  "\\d{1,2}\\s?[mf]\\b|\\b[mf]\\s?\\d{2}",
  "\\d0['’]?s?[\\s-]*something|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\\s-]\\w+)?[\\s-]years?[\\s-]old",
  "middle[\\s-]aged|pensioners?|an adult|eighties|nineties|turning (?:\\d+|twenty|thirty|forty|fifty|sixty|seventy|eighty)",
  // Health and disability, said other ways
  "(?:use|using|with) (?:a )?(?:walker|crutches|cane)|crutches|hearing[\\s-]impair\\w*|(?:vision|visually|mobility)[\\s-]impair\\w*",
  "partially sighted|low vision|dialysis|chemo\\w*|radiation|aa meetings|na meetings|alcoholics anonymous|narcotics anonymous",
  "fibromyalgia|endometriosis|long covid|covid|(?:with|have|has|due to) ms|asthmatic|dyspraxi\\w*|dyscalculi\\w*",
  "neuro\\s?(?:a)?typical|neuroatypical|bedbound|homebound|bed-bound|anaemic|anemic|immunosuppressed|disabled",
  // Religion, said other ways
  "lent|sunday school|(?:attend|go to|going to)\\s+(?:religious\\s+)?services|worship|shabbos|observant",
  "jehovah['’]?s?\\s+witness(?:es)?|pentecostal|episcopalian|presbyterian|(?:seventh[\\s-]day\\s+)?adventist",
  "unitarian(?: universalist)?|universalist|rastafarian|nonreligious|irreligious|secular",
  // Gender and orientation, said other ways
  "two[\\s-]spirit|intersex|demisexual|aromantic|agender|bigender|cishet|hetero",
  // Ethnicity, national origin and immigration, said other ways
  "kiwis?|m[aā]ori|new zealanders?|guamanian|chamorro|hmong|oromo|yoruba|igbo|uyghur|inuit|romani|navajo|cherokee|nepalese",
  "dual (?:national|citizen)|permanent resident|asylum(?: seekers?)?|naturali[sz]ed|expat(?:riate)?s?",
  "on (?:an? )?(?:f-?1|opt|h-?4|h-?1b|j-?1|l-?1|tn|o-?1)\\b(?: status| visa)?",
  "on an? [\\w-]+ visa|[\\w-]+ visa holder",
  // Patterns rather than words, for whole families of disclosures
  "(?:she|he|they|xe|ze|it)\\/(?:her|hers|him|his|them|theirs|they|she|he|xem|zir|it)",
  "afab|amab|trans\\w*|ace|aroace|\\w+romantic|polyamor\\w*|poly",
  "hubby|wifey|significant other|other half|partnered|custody|child(?:free|less)",
  "(?:we['’]?re|we are|as) a family",
  "(?:i['’]?m|i am|we['’]?re|we are)\\s+(?:half|part|mixed)\\s+\\w+|afro[\\s-]?\\w+",
  "allerg\\w*|intoleran\\w*|stutter\\w*|pacemaker|autoimmune|pcos|hrt|ivf|fertility|ssris?|rehab|survivors?",
  "(?:heart|health|medical|mental|back|knee|hip|lung|kidney|liver|thyroid) (?:problems?|issues?|conditions?)",
  "hard[\\s-]of[\\s-]hearing|(?:despite|because of|due to) ms|emotional support \\w+|support (?:animal|dog|cat)",
  "shinto|taoist|confucian|registered \\w+|\\w+ voter",
];

/**
 * Phrases that disclose a protected trait whatever words follow ("I was born
 * in …", "I have lupus", "my family is from …"). The cue and the rest of its
 * clause are removed, so no word list has to know every country or condition.
 */
const CLAUSE_END =
  "[^,;:.!?()\\n]*?(?=\\s*(?:[,;:.!?()\\n]|$|\\b(?:and|but|so|who|which|while|where|because|though|although|plus)\\b))";
const DISCLOSURE_CUES = [
  // Birthdays say someone's age
  "(?:my )?(?:birthday|birth ?date|date of birth|dob|b-?day)\\b",
  // Origin and identity
  "born\\b",
  "raised (?:in|by)\\b",
  "grew up\\b",
  "(?:i['’]?m|i am|we['’]?re|we are|originally|(?:my|our) (?:family|parents|folks)(?: (?:is|are|was|were|came))?|came here|came over|moved here|immigrated|emigrated) from\\b",
  "(?:citizen|native|national) of\\b",
  "(?:my |our )?(?:heritage|descent|ancestry|ancestors|roots)\\b",
  "(?:first|second|third)[\\s-]gen(?:eration)?\\b",
  "identify as\\b",
  "(?:native|first|mother) (?:language|tongue)\\b",
  "(?:grew up )?speak(?:s|ing)? \\w+ at home",
  // Health
  "(?:diagnosed with|living with|suffer(?:s|ing)? from|struggl(?:e|es|ing) with|recovering from|(?:being )?treated for|in treatment for|on (?:meds|medication) for)\\b",
  // "I have lupus", not "I have a car", "I have two cats" or "I have always loved hiking".
  "(?:i|we)(?: have| had| got|['’]ve got|['’]ve had| have got) (?!(?:a|an|the|my|our|no|some|any|two|three|four|five|\\d+|lots|plenty|been|to|always|never|just|also|really|still|already|recently|only|ever|time|fun|friends|roommates|experience|pets?|cats?|dogs?|bikes?|plans?|money|savings|enough|\\w+ed)\\b)",
];
const DISCLOSURE = new RegExp(`\\b(?:${DISCLOSURE_CUES.join("|")})${CLAUSE_END}`, "gi");

/** "I'm black", "a white woman": color words only when they describe a person. */
const CONTEXTUAL =
  "(?:(?:i['’]?m|i am|we['’]?re|we are|as an?|being)\\s+(?:an?\\s+)?(?:black|white|brown)\\b)|(?:\\b(?:black|white|brown)\\s+(?=(?:wom[ae]n|m[ae]n|person|people|folks?|family|community)\\b))|\\bm[ae]n\\b|\\bbah[aá]['’]?[ií]s?(?![a-z])";

const PROTECTED = new RegExp(`(?:\\b(?:${TERMS.join("|")})\\b)|${CONTEXTUAL}`, "gi");

/** "I'm a", "as a", "my" just before a removed trait go with it. */
const LEAD_IN =
  /\b(?:i['’]?m|i am|i was|i|we['’]?re|we are|we were|we|as|being|my|our)\s+(?:(?:an?|the|one|of)\s+)*(?=\[removed\])/gi;
/** Removed words next to each other ("a 30-year-old Muslim woman") collapse into one. */
const RUNS = /\[removed\](?:[\s,/-]+(?:(?:and|or|&|an?)\s+)*\[removed\])+/gi;

/**
 * "I'm Belgian", "we're Tunisian": a capitalized -ian/-ish/-ese/-i word right
 * after "I'm" is a nationality or ethnicity, whichever one it is.
 */
const NATIONALITY =
  /\b(?:[Ii]['’]?m|I am|[Ww]e['’]?re|[Ww]e are)\s+(?:(?:half|part)[\s-])?[A-Z][a-z]+(?:ian|ish|ese|ean|ic|i|an)\b(?:[\s-]American)?/g;

/** The text with every protected-trait statement replaced by `REDACTED`. */
export function redactProtected(text: string): string {
  return text
    .replace(NATIONALITY, REDACTED)
    .replace(DISCLOSURE, REDACTED)
    .replace(PROTECTED, REDACTED)
    .replace(LEAD_IN, "")
    .replace(RUNS, REDACTED);
}

/** Whether `text` says anything about a protected trait (or still carries a redaction). */
export function hasProtected(text: string): boolean {
  return text.includes(REDACTED) || redactProtected(text) !== text;
}
