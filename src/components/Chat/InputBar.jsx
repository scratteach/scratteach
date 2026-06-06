import React, { useState, useRef, useEffect } from 'react';
import ImageAttachment from '../ImageAttachment.jsx';

const SendIcon = ({ isLoading }) => {
  if (isLoading) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-spin">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 10L3 3l3 7-3 7 15-7z" fill="currentColor" />
    </svg>
  );
};

const QUICK_QUESTIONS = [
  'ネコを動かすには？',
  'スプライトを増やすには？',
  '繰り返し処理をするには？',
  '音を鳴らすには？',
];

const InputBar = ({ onSend, isLoading, isEmpty, mode = 'question', placeholder, quickItems }) => {
  const textareaRef = useRef(null);
  const [value, setValue] = useState('');
  const [imageData, setImageData] = useState(null);
  const isComposingRef = useRef(false);

  const isCreate = mode === 'create';
  const sendBtnClass = isCreate
    ? 'bg-sky-400 hover:bg-sky-500 text-white'
    : 'bg-orange-500 hover:bg-orange-600 text-white';
  const attachAccentClass = isCreate
    ? 'text-sky-500 hover:bg-sky-50'
    : 'text-orange-500 hover:bg-orange-50';
  const focusRingClass = isCreate
    ? 'focus-within:border-sky-400 focus-within:ring-sky-400'
    : 'focus-within:border-orange-400 focus-within:ring-orange-400';
  const quickBtnClass = isCreate
    ? 'border-sky-200 text-sky-600 bg-sky-50 hover:bg-sky-100'
    : 'border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100';

  const defaultPlaceholder = isCreate
    ? 'ゲームの説明を入力してください... (Enterで送信)'
    : 'Scratchについて質問してください... (Enterで送信)';

  const displayQuickItems = quickItems || (isCreate ? [] : QUICK_QUESTIONS);

  const handleSubmit = () => {
    const text = value.trim();
    if ((!text && !imageData) || isLoading) return;
    onSend(text, imageData);
    setValue('');
    setImageData(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e) => {
    setValue(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  };

  useEffect(() => {
    if (textareaRef.current && !isLoading) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  const canSend = (value.trim().length > 0 || imageData !== null) && !isLoading;

  return (
    <div className="border-t border-gray-200 bg-white p-3 md:p-4 no-print">
      {isEmpty && displayQuickItems.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-2">よくある質問</p>
          <div className="flex flex-wrap gap-2">
            {displayQuickItems.map((q) => (
              <button
                key={q}
                onClick={() => onSend(q, null)}
                disabled={isLoading}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${quickBtnClass}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:ring-1 transition-all ${focusRingClass}`}>
        <ImageAttachment
          imageData={imageData}
          onImageSelect={setImageData}
          onImageRemove={() => setImageData(null)}
          accentClass={attachAccentClass}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          placeholder={placeholder || defaultPlaceholder}
          disabled={isLoading}
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-base md:text-sm text-gray-800 placeholder-gray-400 max-h-40 py-1"
          style={{ minHeight: '24px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={`
            flex-shrink-0 p-2 rounded-lg transition-colors
            ${canSend ? sendBtnClass : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
          `}
          aria-label="送信"
        >
          <SendIcon isLoading={isLoading} />
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 mt-2">
        Shift+Enterで改行 · Enterで送信
      </p>
    </div>
  );
};

export default InputBar;
