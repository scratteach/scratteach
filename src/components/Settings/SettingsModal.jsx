import React, { useState, useEffect } from 'react';

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9.5 2.5H13.5V6.5M13 3L7.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
    className={`transition-transform ${open ? 'rotate-180' : ''}`}>
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = ({ show }) => (
  show ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2l14 14M7.5 7.6A2.5 2.5 0 0 0 11.4 11.4M4.7 4.7C2.8 6 1 9 1 9s3 6 8 6c1.5 0 2.9-.5 4.1-1.3M8 3.1c.3 0 .7-.1 1-.1 5 0 8 6 8 6s-.7 1.4-2 2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
);

const MODELS = [
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    description: '推奨・高速・無料枠あり',
    badge: '推奨',
  },
  {
    id: 'gemma-4-27b-it',
    label: 'Gemma 4 27B',
    description: '高精度（レート制限に達した際の代替）',
    badge: null,
  },
];

const SettingsModal = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3.1-flash-lite');
  const [blockLang, setBlockLang] = useState('ja');
  const [showKey, setShowKey] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem('scratteach_api_key') || '';
      const storedModel = localStorage.getItem('scratteach_model') || 'gemini-3.1-flash-lite';
      const storedBlockLang = localStorage.getItem('scratteach_block_lang') || 'ja';
      setApiKey(storedKey);
      setModel(storedModel);
      setBlockLang(storedBlockLang);
      setSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('scratteach_api_key', apiKey.trim());
    localStorage.setItem('scratteach_model', model);
    localStorage.setItem('scratteach_block_lang', blockLang);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">設定</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            aria-label="閉じる"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Gemini APIキー
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showKey ? 'APIキーを隠す' : 'APIキーを表示'}
              >
                <EyeIcon show={showKey} />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              APIキーはGoogleが<span className="font-medium text-gray-600">無料</span>で発行できます（クレジットカード不要）。
            </p>

            {/* APIキー取得ボタン */}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors text-sm font-medium"
            >
              Google AI StudioでAPIキーを取得
              <ExternalLinkIcon />
            </a>

            {/* 取得手順（開閉式） */}
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="mt-2 flex items-center justify-between w-full text-xs text-gray-500 hover:text-gray-700 transition-colors"
              aria-expanded={showGuide}
            >
              <span>APIキーの取得方法（手順）を見る</span>
              <ChevronIcon open={showGuide} />
            </button>
            {showGuide && (
              <ol className="mt-2 space-y-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 list-decimal list-inside">
                <li>上の「Google AI StudioでAPIキーを取得」ボタンを押す</li>
                <li>Googleアカウントでログインする</li>
                <li>「APIキーを作成（Create API key）」をクリックする</li>
                <li><span className="font-mono">AIza…</span> で始まるキーが表示されたらコピーする</li>
                <li>この画面の入力欄に貼り付けて「保存する」を押す</li>
              </ol>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              使用モデル
            </label>
            <div className="space-y-2">
              {MODELS.map((m) => (
                <label
                  key={m.id}
                  className={`
                    flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors
                    ${model === m.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={model === m.id}
                    onChange={() => setModel(m.id)}
                    className="mt-0.5 accent-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{m.label}</span>
                      {m.badge && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Block Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ブロック表記言語
            </label>
            <div className="flex gap-2">
              {[
                { value: 'ja', label: '日本語', sub: '（例：緑の旗が押されたとき）' },
                { value: 'en', label: 'English', sub: '(e.g. when green flag clicked)' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`
                    flex-1 flex flex-col gap-0.5 p-3 rounded-xl border-2 cursor-pointer transition-colors
                    ${blockLang === opt.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="blockLang"
                      value={opt.value}
                      checked={blockLang === opt.value}
                      onChange={() => setBlockLang(opt.value)}
                      className="accent-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 pl-5">{opt.sub}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <p className="font-medium mb-1">セキュリティについて</p>
            <p>APIキーはこのデバイスのローカルストレージにのみ保存され、外部サーバーには送信されません。</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className={`
              flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors
              ${saved
                ? 'bg-green-500'
                : 'bg-orange-500 hover:bg-orange-600'
              }
            `}
          >
            {saved ? '保存しました ✓' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
