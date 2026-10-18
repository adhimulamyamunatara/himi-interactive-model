export const SUBJECTS = [
  'Operating Systems',
  'Computer Networks',
  'DBMS',
  'Python',
  'Java',
  'C Programming',
  'Data Structures',
  'Algorithms',
  'AI',
  'Machine Learning'
];

export const QUICK_QUESTIONS = [
  'Explain Deadlock',
  'What is TCP?',
  'Difference between Process and Thread',
  'Explain Binary Search',
  'What is Normalization?'
];

export const DEFAULT_SUBJECT = SUBJECTS[0];

const SUBJECT_TONES = ['blue', 'purple', 'cyan', 'emerald', 'amber', 'rose'];

/**
 * Resolve a stable badge tone for a subject so the same subject is always the same colour.
 *
 * @param {string} subject
 * @returns {'blue' | 'purple' | 'cyan' | 'emerald' | 'amber' | 'rose'}
 */
export function getSubjectTone(subject) {
  const index = SUBJECTS.indexOf(subject);
  return SUBJECT_TONES[(index === -1 ? 0 : index) % SUBJECT_TONES.length];
}
