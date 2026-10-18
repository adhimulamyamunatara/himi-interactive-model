import { useState } from 'react';
import { FiPlus, FiX } from 'react-icons/fi';
import { MAX_DIFFICULT_TOPICS, MAX_TOPIC_LENGTH, addDifficultTopic } from '../../utils/learningProfile';
import { SUBJECTS } from '../../utils/subjects';
import { SubjectBadge } from '../common/Badge';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';

/** Topics the student explicitly marked as difficult, optionally tied to one of the supported subjects. */
export default function DifficultTopicsEditor({ topics, onChange }) {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState(null);

  const add = () => {
    const result = addDifficultTopic(topics, { subject, topic });

    if (result.error) {
      setError(result.error);
      return;
    }

    onChange(result.list);
    setTopic('');
    setError(null);
  };

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-start">
        <Select label="Subject (optional)" value={subject} onChange={(event) => setSubject(event.target.value)}>
          <option value="">Any subject</option>
          {SUBJECTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Input
          label="Topic you find difficult"
          value={topic}
          maxLength={MAX_TOPIC_LENGTH}
          placeholder="e.g. Deadlock avoidance"
          error={error ?? undefined}
          hint={error ? undefined : `Up to ${MAX_DIFFICULT_TOPICS} topics.`}
          onChange={(event) => {
            setTopic(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" onClick={add} disabled={topics.length >= MAX_DIFFICULT_TOPICS} aria-label="Add difficult topic" className="sm:mt-7">
          <FiPlus aria-hidden="true" /> Add
        </Button>
      </div>

      {topics.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-label="Topics you marked as difficult">
          {topics.map((item, index) => (
            <li key={`${item.subject ?? ''}|${item.topic}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-2">
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-800">
                {item.subject ? <SubjectBadge subject={item.subject} /> : null}
                <span className="min-w-0 break-words">{item.topic}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(topics.filter((_, position) => position !== index))}
                className="shrink-0 rounded-full p-2 text-slate-600 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label={`Remove difficult topic: ${item.topic}`}
              >
                <FiX aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
