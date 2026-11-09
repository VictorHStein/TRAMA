import { useEffect, useRef, useState } from 'react';

/**
 * Small numeric input that commits on Enter or blur and reverts on Escape.
 * Accepts a decimal comma. Typed as text so the browser never blocks
 * intermediate values; validation happens in the model.
 */
export function NumberField({ value, onCommit, ariaLabel, className, placeholder }: {
  value: number | null;
  onCommit: (v: number) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
}) {
  const asText = (v: number | null) => (v === null || !Number.isFinite(v) ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(asText(value));
  const cancelled = useRef(false);
  useEffect(() => { setText(asText(value)); }, [value]);

  const commit = () => {
    if (cancelled.current) { cancelled.current = false; setText(asText(value)); return; }
    const v = Number(text.trim().replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(v)) { setText(asText(value)); return; }
    if (v !== value) onCommit(v);
  };

  return (
    <input
      className={`num-field mono${className ? ` ${className}` : ''}`}
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        else if (e.key === 'Escape') { cancelled.current = true; (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}
