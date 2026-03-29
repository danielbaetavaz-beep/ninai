'use client';
import { useRef, useEffect } from 'react';

interface ExpandingInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ExpandingInput({ value, onChange, onSend, disabled, placeholder }: ExpandingInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-gray-100 bg-white">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Digite sua resposta...'}
        disabled={disabled}
        rows={1}
        className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 resize-none overflow-hidden leading-relaxed min-h-[42px]"
        style={{ maxHeight: '150px' }}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="px-5 py-2.5 rounded-full bg-teal-400 text-white text-sm font-medium disabled:opacity-50 shrink-0"
      >
        Enviar
      </button>
    </div>
  );
}
