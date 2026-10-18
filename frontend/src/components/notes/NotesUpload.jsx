import { useId, useState } from 'react';
import { FiFileText, FiUploadCloud } from 'react-icons/fi';
import { MAX_PDF_BYTES, MAX_PDF_PAGES, formatFileSize } from '../../utils/notes';

/**
 * PDF picker with drag and drop. The native file input stays in the page (visually hidden), so the keyboard,
 * screen readers and the browser's own file dialog all work.
 */
export default function NotesUpload({ onFile, error, disabled = false }) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];

    if (file) {
      onFile(file);
    }
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-200 ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50'
        } ${error ? 'border-rose-300' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span className="rounded-2xl bg-blue-50 p-4 text-3xl text-blue-600">
          <FiUploadCloud aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold text-slate-900">Choose a PDF, or drop it here</span>
        <span id={hintId} className="max-w-md text-sm text-slate-600">
          <FiFileText className="mr-1 inline" aria-hidden="true" />
          PDF only, up to {formatFileSize(MAX_PDF_BYTES)} and {MAX_PDF_PAGES} pages. The PDF needs real, selectable text:
          scanned pages cannot be read yet.
        </span>
        <input
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={disabled}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = ''; // picking the same file again must trigger a new upload
          }}
        />
      </label>
      {error ? (
        <p id={errorId} className="mt-3 text-sm font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
