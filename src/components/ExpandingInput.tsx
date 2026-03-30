'use client';
import { useRef, useEffect, useState } from 'react';

interface ExpandingInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ExpandingInput({ value, onChange, onSend, disabled, placeholder }: ExpandingInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

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

  function toggleRecording() {
    if (isRecording) {
      stopRecording();
      return;
    }
    startRecording();
  }

  function startRecording() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta reconhecimento de voz. Use o Chrome ou Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = value;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript;
        } else {
          interim = transcript;
        }
      }
      onChange(finalTranscript + (interim ? ' ' + interim : ''));
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-gray-100 bg-white">
      <button
        onClick={toggleRecording}
        disabled={disabled}
        className={`p-2.5 rounded-full shrink-0 transition-all ${
          isRecording 
            ? 'bg-red-400 text-white animate-pulse' 
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        } disabled:opacity-50`}
        title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
      >
        {isRecording ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Digite ou grave sua resposta...'}
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
