import { useEffect, useRef, useState } from 'react';
import { FiImage, FiTrash2 } from 'react-icons/fi';
import { useToast } from '../../context/ToastContext';
import { useUser } from '../../context/UserContext';
import { AVATAR_ALLOWED_TYPES, AVATAR_COLORS, getAvatarColorClasses, normalizeAvatarColor } from '../../utils/avatar';
import { AvatarImageError, prepareAvatarImage } from '../../utils/avatarImage';
import Button from '../common/Button';
import UserAvatar from '../common/UserAvatar';

/** Photo upload, removal and fallback colour. Lives in the profile card; changes apply immediately. */
export default function AvatarEditor() {
  const { user, setAvatarImage, removeAvatarImage, setAvatarColor } = useUser();
  const toast = useToast();
  const inputRef = useRef(null);
  const requestRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A photo that is still being processed must not be applied after the student leaves this page.
  useEffect(() => {
    return () => {
      requestRef.current += 1;
    };
  }, []);

  const handleFile = async (event) => {
    const input = event.target;
    const [file] = input.files ?? [];
    input.value = '';

    if (!file) {
      return;
    }

    requestRef.current += 1;
    const requestId = requestRef.current;
    setBusy(true);
    setError('');

    try {
      const dataUrl = await prepareAvatarImage(file);

      if (requestId !== requestRef.current) {
        return;
      }

      const result = setAvatarImage(dataUrl);

      if (result.ok) {
        toast.success('Photo updated', 'It now shows across HIMI on this device.');
      } else {
        setError(result.error);
      }
    } catch (failure) {
      if (requestId === requestRef.current) {
        setError(failure instanceof AvatarImageError ? failure.message : 'That image could not be used. Try another one.');
      }
    } finally {
      if (requestId === requestRef.current) {
        setBusy(false);
      }
    }
  };

  const handleRemove = () => {
    requestRef.current += 1;
    setBusy(false);
    const result = removeAvatarImage();

    if (result.ok) {
      setError('');
      toast.success('Photo removed', 'Your initials are shown instead.');
    } else {
      setError(result.error);
    }
  };

  const handleColor = (key) => {
    const result = setAvatarColor(key);

    if (!result.ok) {
      setError(result.error);
    }
  };

  const activeColor = normalizeAvatarColor(user?.avatarColor);

  return (
    <div className="flex w-full flex-col items-center">
      <UserAvatar size="xl" />

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy} aria-busy={busy}>
          <FiImage aria-hidden="true" /> {busy ? 'Processing…' : user?.avatarImage ? 'Change photo' : 'Upload photo'}
        </Button>
        {user?.avatarImage ? (
          <Button variant="ghost" size="sm" onClick={handleRemove} disabled={busy}>
            <FiTrash2 aria-hidden="true" /> Remove photo
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ALLOWED_TYPES.join(',')}
          onChange={handleFile}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a profile photo"
          data-testid="avatar-file-input"
        />
      </div>

      <p className="mt-2 max-w-[16rem] text-xs leading-5 text-slate-500">
        JPEG, PNG or WebP up to 2 MB. The photo is cropped and shrunk, then kept only in this browser. It is never uploaded and is removed when you log out.
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <fieldset className="mt-5 w-full">
        <legend className="mx-auto text-sm font-semibold text-slate-800">
          Avatar colour
        </legend>
        <p className="mt-1 text-xs text-slate-500">Used for your initials when there is no photo.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {AVATAR_COLORS.map((color) => (
            <label key={color.key} className="relative cursor-pointer">
              <input
                type="radio"
                name="avatar-color"
                value={color.key}
                checked={activeColor === color.key}
                onChange={() => handleColor(color.key)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`block h-9 w-9 rounded-full bg-gradient-to-br ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-slate-900 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-300 ${getAvatarColorClasses(color.key)}`}
              />
              <span className="sr-only">{color.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
