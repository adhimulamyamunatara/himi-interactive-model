/**
 * HIMI's "basic mode": a small, honest fallback for when the AI (Gemini, through the backend) cannot answer.
 *
 * It is NOT a model and does not pretend to be one. It recognises a handful of everyday phrases (greetings,
 * thanks, "what can you do", feeling stuck) and answers them from fixed text, in English or Telugu. For
 * anything that needs real knowledge it says plainly that the AI is not reachable and points to things that
 * still work offline (the quiz and notes pages, the whiteboard) instead of making up an explanation.
 *
 * Pure and framework-free so it is unit tested. It never invents subject facts.
 */

const TELUGU_SCRIPT = /[\u0C00-\u0C7F]/;

const norm = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const has = (text, words) => words.some((word) => new RegExp(`(^|\\s)${word}(\\s|$)`).test(text));

// `words` match anywhere in a short message; `exact` only when they are the whole message; `maxWords` keeps a
// polite opener ("thanks, now explain deadlock") from being mistaken for the whole request.
const INTENTS = [
  { id: 'bye', maxWords: 3, words: ['bye', 'goodbye', 'good night', 'see you', 'see you later', 'talk later', 'cya', 'veltunna', 'velthunna'] },
  { id: 'thanks', maxWords: 3, words: ['thanks', 'thank you', 'thankyou', 'thx', 'dhanyavadalu', 'danyavadalu'], exact: ['thank you so much', 'thank you very much', 'thanks a lot', 'thanks so much'] },
  { id: 'how', maxWords: 6, words: ['how are you', 'how r u', 'how are you doing', 'ela unnav', 'ela unnavu', 'ela unnaru', 'ela vunnav', 'em chestunnav', 'whats up', 'what s up'] },
  { id: 'who', maxWords: 7, words: ['who are you', 'what are you', 'your name', 'what is your name', 'who is himi', 'what is himi', 'nuvvu evaru', 'nee peru enti'] },
  { id: 'can', maxWords: 8, words: ['what can you do', 'what do you do', 'how can you help', 'how do you help', 'what can i ask', 'nuvvu em chestav', 'em chestav'], exact: ['help', 'help me', 'features'] },
  {
    id: 'stuck',
    maxWords: 8,
    words: ['i am tired', 'im tired', 'i am stressed', 'stressed', 'i am bored', 'bored', 'cant focus', 'cannot focus', 'i give up', 'too hard', 'i dont understand', 'i am stuck', 'stuck', 'confused', 'demotivated', 'exam fear', 'scared of exams']
  },
  { id: 'tip', maxWords: 8, words: ['study tip', 'study tips', 'how to study', 'how should i study', 'how do i study', 'how to revise', 'time management'], exact: ['tip', 'tips', 'revise'] },
  {
    id: 'hello',
    maxWords: 4,
    words: ['hi', 'hello', 'hey', 'hii', 'hiii', 'hai', 'namaste', 'namaskaram', 'good morning', 'good afternoon', 'good evening', 'yo']
  }
];

function detect(text) {
  const count = text ? text.split(' ').length : 0;

  for (const intent of INTENTS) {
    if ((count <= intent.maxWords && has(text, intent.words)) || intent.exact?.includes(text)) {
      return intent.id;
    }
  }

  return 'unknown';
}

const STUDY_TIPS = {
  en: [
    'Try the 25-5 rhythm: study for 25 minutes, then take a 5 minute break.',
    'Test yourself before you re-read. A short quiz on the Quiz page shows what you really know.',
    'Teach it out loud in your own words. If you get stuck, that is the exact part to revise.',
    'Start with the topic you like least while you are fresh, and finish with something easy.'
  ],
  te: [
    '25-5 పద్ధతి ప్రయత్నించండి: 25 నిమిషాలు చదివి, 5 నిమిషాలు విరామం తీసుకోండి.',
    'మళ్ళీ చదివే ముందు మీరే పరీక్షించుకోండి. Quiz పేజీలోని చిన్న క్విజ్ మీకు నిజంగా ఏం తెలుసో చూపిస్తుంది.',
    'పెద్దగా మీ సొంత మాటల్లో చెప్పుకోండి. ఎక్కడ ఆగిపోతారో, అదే మీరు మళ్ళీ చదవాల్సిన భాగం.',
    'మీకు తక్కువ ఇష్టమైన టాపిక్‌తో ఉత్సాహంగా ఉన్నప్పుడే మొదలుపెట్టండి, సులభమైనదానితో ముగించండి.'
  ]
};

const TEXT = {
  en: {
    hello: ({ name }) => `Hi ${name}! I'm HIMI. What would you like to work on?`,
    thanks: () => "You're welcome! Tell me whenever you want to study something else.",
    bye: ({ name }) => `Bye ${name}! Come back whenever you want to study. You've got this.`,
    how: () => "I'm a program, so I don't have feelings, but I'm ready to help. What shall we study?",
    who: () => "I'm HIMI, your AI learning companion. I help you study: explanations, quizzes, study plans, notes, code and diagrams.",
    can: () =>
      'I can explain a topic, make a quiz, build a study plan, summarise notes, help with code and draw diagrams. You can also say "open the quiz" or "open the whiteboard".',
    stuck: () =>
      "That's okay. Let's make it smaller. Pick one tiny topic, give it ten minutes, and then take a break. I'm not able to tell how you feel, but I'm here to help you start.",
    tip: ({ tip }) => tip,
    unknown: () =>
      "I'm in basic mode right now because my AI brain can't be reached, so I can't explain that properly and I won't guess. You can say \"open the quiz\" or \"open the whiteboard\", or try asking me again in a moment."
  },
  te: {
    hello: ({ name }) => `హాయ్ ${name}! నేను HIMI. ఈ రోజు మీరు ఏం చదవాలనుకుంటున్నారు?`,
    thanks: () => 'ఫర్వాలేదు! మరో టాపిక్ చదవాలనుకున్నప్పుడు నాకు చెప్పండి.',
    bye: ({ name }) => `బై ${name}! చదవాలనిపించినప్పుడు మళ్ళీ రండి. మీరు చేయగలరు.`,
    how: () => 'నేను ఒక ప్రోగ్రామ్‌ని, కాబట్టి నాకు భావాలు ఉండవు, కానీ సహాయం చేయడానికి సిద్ధంగా ఉన్నాను. ఏం చదువుదాం?',
    who: () => 'నేను HIMI, మీ AI లెర్నింగ్ కంపానియన్‌ని. వివరణలు, క్విజ్‌లు, స్టడీ ప్లాన్లు, నోట్స్, కోడ్, డయాగ్రామ్‌లతో చదువులో సహాయం చేస్తాను.',
    can: () =>
      'నేను టాపిక్ వివరించగలను, క్విజ్ తయారు చేయగలను, స్టడీ ప్లాన్ వేయగలను, నోట్స్ సారాంశం చెప్పగలను, కోడ్‌కి సహాయం చేసి డయాగ్రామ్‌లు గీయగలను. "open the quiz" లేదా "open the whiteboard" అని కూడా చెప్పవచ్చు.',
    stuck: () =>
      'పర్వాలేదు. దాన్ని చిన్నగా చేద్దాం. ఒక చిన్న టాపిక్ ఎంచుకుని పది నిమిషాలు చదవండి, తర్వాత విరామం తీసుకోండి. మీకు ఎలా అనిపిస్తోందో నేను చెప్పలేను, కానీ మొదలుపెట్టడానికి తోడుగా ఉంటాను.',
    tip: ({ tip }) => tip,
    unknown: () =>
      'ప్రస్తుతం నా AI అందుబాటులో లేదు, అందుకే బేసిక్ మోడ్‌లో ఉన్నాను. దాన్ని సరిగా వివరించలేను, ఊహించి చెప్పను. "open the quiz" లేదా "open the whiteboard" అని చెప్పండి, లేదా కాసేపటి తర్వాత మళ్ళీ అడగండి.'
  }
};

/**
 * @param {string} message what the student said
 * @param {{ language?: 'en' | 'te', name?: string, random?: () => number }} [options]
 * @returns {{ text: string, language: 'en' | 'te', intent: string }}
 */
export function basicReply(message, { language = 'en', name = '', random = Math.random } = {}) {
  const raw = String(message ?? '');
  // Replying in the script the student used is the polite default; otherwise follow their explanation language.
  const lang = TELUGU_SCRIPT.test(raw) ? 'te' : language === 'te' ? 'te' : 'en';
  const intent = detect(norm(raw));
  const tips = STUDY_TIPS[lang];
  const tip = tips[Math.min(tips.length - 1, Math.floor(random() * tips.length))];
  const friendly = String(name ?? '').trim().split(/\s+/)[0] || (lang === 'te' ? 'మిత్రమా' : 'friend');

  return { text: TEXT[lang][intent]({ name: friendly, tip }), language: lang, intent };
}

const LINES = {
  en: {
    greeting: ({ name }) => `Hi ${name}! I'm listening. Ask me anything, or say "open the quiz".`,
    'handoff.quiz': () => 'That sounds like a quiz. Tap the button on screen and I will take you to the Quiz Generator.',
    'handoff.planner': () => 'That sounds like a study plan. Tap the button on screen and I will take you to the Study Planner.',
    'handoff.code': () => 'That is a job for the Code Assistant. Tap the button on screen to go there.',
    'handoff.diagram': () => 'That is a drawing job. Tap the button on screen to open Diagrams.',
    clarify: () => 'I need a little more detail. Which topic or question should we work on?',
    tooLong: () => 'That was a bit long for me. Could you say it in a shorter way?',
    error: () => "Sorry, I couldn't answer that. Say it again, or type it."
  },
  te: {
    greeting: ({ name }) => `హాయ్ ${name}! నేను వింటున్నాను. ఏదైనా అడగండి, లేదా "open the quiz" అని చెప్పండి.`,
    'handoff.quiz': () => 'ఇది క్విజ్‌లా ఉంది. స్క్రీన్ మీద బటన్ నొక్కండి, క్విజ్ జనరేటర్‌కి తీసుకెళ్తాను.',
    'handoff.planner': () => 'ఇది స్టడీ ప్లాన్‌లా ఉంది. స్క్రీన్ మీద బటన్ నొక్కండి, స్టడీ ప్లానర్‌కి తీసుకెళ్తాను.',
    'handoff.code': () => 'ఇది కోడ్ అసిస్టెంట్ పని. స్క్రీన్ మీద బటన్ నొక్కి అక్కడికి వెళ్ళండి.',
    'handoff.diagram': () => 'ఇది బొమ్మ గీసే పని. స్క్రీన్ మీద బటన్ నొక్కి డయాగ్రామ్స్ తెరవండి.',
    clarify: () => 'ఇంకొంచెం వివరం కావాలి. ఏ టాపిక్ లేదా ప్రశ్న మీద పని చేద్దాం?',
    tooLong: () => 'ఇది నాకు కొంచెం పెద్దది. కొంచెం చిన్నగా చెప్పగలరా?',
    error: () => 'క్షమించండి, దీనికి సమాధానం చెప్పలేకపోయాను. మళ్ళీ చెప్పండి, లేదా టైప్ చేయండి.'
  }
};

/**
 * The short sentences HIMI speaks in a live conversation that are not tutor answers (greeting, "tap the
 * button", "say that again"), in the student's explanation language.
 *
 * @param {keyof typeof LINES.en} key
 * @param {'en' | 'te'} language
 * @param {{ name?: string }} [params]
 */
export function liveLine(key, language, { name = '' } = {}) {
  const lang = language === 'te' ? 'te' : 'en';
  const friendly = String(name ?? '').trim().split(/\s+/)[0] || (lang === 'te' ? 'మిత్రమా' : 'friend');
  const line = LINES[lang][key] ?? LINES[lang].error;

  return line({ name: friendly });
}
