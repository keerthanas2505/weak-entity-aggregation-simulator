
import { QUIZ_BANK, pickQuiz, applyQuizResult, emptyQuizStats, abilityLevel, topicBreakdown, QUIZ_TOPICS, QUIZ_LENGTH } from './src/lib/quizBank.js';
// sanity: bank integrity
const ids = new Set();
let bad = 0;
for (const q of QUIZ_BANK) {
  if (ids.has(q.id)) { console.log('DUP ID', q.id); bad++; }
  ids.add(q.id);
  if (!QUIZ_TOPICS[q.topic]) { console.log('BAD TOPIC', q.id, q.topic); bad++; }
  if (q.correct < 0 || q.correct >= q.options.length) { console.log('BAD CORRECT IDX', q.id); bad++; }
  if (![1,2,3].includes(q.diff)) { console.log('BAD DIFF', q.id); bad++; }
  if (q.options.length !== 4) { console.log('BAD OPTS', q.id); bad++; }
}
console.log('bank size:', QUIZ_BANK.length, 'errors:', bad);
console.log('per-topic:', Object.keys(QUIZ_TOPICS).map(t => t + '=' + QUIZ_BANK.filter(q => q.topic === t).length).join(' '));
console.log('per-diff:', [1,2,3].map(d => 'd' + d + '=' + QUIZ_BANK.filter(q => q.diff === d).length).join(' '));

// test 1: first-time user (no stats)
let stats = emptyQuizStats();
let s1 = pickQuiz(stats);
console.log('\nfirst session len:', s1.length, 'ids:', s1.map(q => q.id).join(','));

// test 2: simulate a user who struggles with weak/aggregation, strong elsewhere
for (let round = 0; round < 4; round++) {
  const session = pickQuiz(stats);
  const records = session.map(q => ({ id: q.id, topic: q.topic, correct: (q.topic === 'weak' || q.topic === 'aggregation') ? false : true }));
  stats = applyQuizResult(stats, records);
}
console.log('\nafter 4 weak-topic rounds -> ability level:', abilityLevel(stats));
console.log('topic breakdown:', topicBreakdown(stats).map(r => r.label + ':' + (r.acc == null ? '?' : Math.round(r.acc * 100) + '%')).join(' | '));
let s2 = pickQuiz(stats);
console.log('adapted session:', s2.map(q => q.topic + '(d' + q.diff + ')').join(', '));
console.log('no repeats from last:', !s2.some(q => stats.lastIds.includes(q.id)));

// test 3: strong user gets harder questions
let strong = emptyQuizStats();
for (let round = 0; round < 3; round++) {
  const session = pickQuiz(strong);
  strong = applyQuizResult(strong, session.map(q => ({ id: q.id, topic: q.topic, correct: true })));
}
console.log('\nstrong user level:', abilityLevel(strong));
let s3 = pickQuiz(strong);
const d3count = s3.filter(q => q.diff === 3).length;
console.log('strong session diffs:', s3.map(q => 'd' + q.diff).join(','), '-> d3 count:', d3count);

// test 4: two consecutive sessions share no question
const s4a = pickQuiz(emptyQuizStats());
const mid = applyQuizResult(emptyQuizStats(), s4a.map(q => ({ id: q.id, topic: q.topic, correct: true })));
const s4b = pickQuiz(mid);
const overlap = s4a.filter(q => s4b.some(x => x.id === q.id)).length;
console.log('\nconsecutive-session overlap:', overlap, '(expect 0)');
console.log('\nALL_ENGINE_TESTS_DONE');
