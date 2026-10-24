import { useState, useEffect, useRef } from 'react';
export default function ShortcutField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [recording, setRecording] = useState(false),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      void window.launcher?.captureShortcut(false).catch(() => {});
    },
    [],
  );
  async function stop() {
    setRecording(false);
    try {
      await window.launcher?.captureShortcut(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div>
      <div className="input-action">
        <input
          ref={input}
          value={value}
          readOnly={recording}
          onChange={(e) => onChange(e.target.value)}
          placeholder={recording ? 'Press your shortcut…' : 'Ctrl + Shift + Space'}
          onBlur={() => {
            if (recording) void stop();
          }}
          onKeyDown={(e) => {
            if (!recording) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') {
              void stop();
              return;
            }
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
            const mods = [
              e.ctrlKey ? 'Control' : '',
              e.altKey ? 'Alt' : '',
              e.shiftKey ? 'Shift' : '',
              e.metaKey ? 'Super' : '',
            ].filter(Boolean);
            const key =
              e.code === 'Space'
                ? 'Space'
                : e.key.startsWith('Arrow')
                  ? e.key.slice(5)
                  : e.key === '+'
                    ? 'Plus'
                    : e.key === '-'
                      ? 'Minus'
                      : e.key.length === 1
                        ? e.key.toUpperCase()
                        : e.key;
            if (!mods.length) {
              setError('Include Ctrl, Alt, Shift, or Windows with the key.');
              return;
            }
            onChange([...mods, key].join('+'));
            setError('');
            void stop();
          }}
        />
        <button
          className="button secondary"
          type="button"
          onClick={async () => {
            try {
              await window.launcher?.captureShortcut(true);
              setRecording(true);
              setError('');
              input.current?.focus();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {recording ? 'Press keys…' : 'Record keys'}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
