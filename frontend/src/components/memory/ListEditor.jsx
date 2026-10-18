import { useId, useState } from 'react';
import { FiPlus, FiX } from 'react-icons/fi';
import Button from '../common/Button';
import Input from '../common/Input';

/**
 * Add / remove editor for a short list of text items (goals, interests).
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.noun Singular word used in messages ("goal").
 * @param {string[]} props.items
 * @param {(items: string[]) => void} props.onChange
 * @param {(items: string[], text: string) => {list: string[], error: string | null}} props.onAdd Pure add rule.
 * @param {number} props.maxItems
 * @param {number} props.maxLength
 */
export default function ListEditor({ label, noun, hint, placeholder, items, onChange, onAdd, maxItems, maxLength }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const listId = useId();

  const add = () => {
    const result = onAdd(items, text);

    if (result.error) {
      setError(result.error);
      return;
    }

    onChange(result.list);
    setText('');
    setError(null);
  };

  return (
    <div>
      <div className="flex items-start gap-2">
        <Input
          label={label}
          value={text}
          maxLength={maxLength}
          placeholder={placeholder}
          hint={error ? undefined : hint}
          error={error ?? undefined}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault(); // Enter adds the item instead of submitting the whole form
              add();
            }
          }}
        />
        <Button variant="secondary" onClick={add} disabled={items.length >= maxItems} aria-label={`Add ${noun}`} className="mt-7 shrink-0">
          <FiPlus aria-hidden="true" /> Add
        </Button>
      </div>

      {items.length > 0 ? (
        <ul id={listId} className="mt-3 flex flex-wrap gap-2" aria-label={`Your ${noun}s`}>
          {items.map((item, index) => (
            <li
              key={item}
              className="flex max-w-full items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1 text-sm text-blue-800 ring-1 ring-inset ring-blue-100"
            >
              <span className="min-w-0 break-words">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, position) => position !== index))}
                className="rounded-full p-1.5 text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label={`Remove ${noun}: ${item}`}
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
