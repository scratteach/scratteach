import { useState, useRef, useEffect } from 'react';
import MONTHLY_PASSWORD_HASHES from '../data/passwords.js';

const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const saveSession = () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  localStorage.setItem('scratteach_auth', JSON.stringify({
    authenticated: true,
    month: currentMonth,
  }));
};

const PasswordGate = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (isLoading || !password) return;
    setIsLoading(true);
    setShowError(false);

    const currentMonth = new Date().getMonth() + 1;
    const expectedHash = MONTHLY_PASSWORD_HASHES[currentMonth];
    const inputHash = await hashPassword(password);

    if (inputHash === expectedHash) {
      saveSession();
      setFadeOut(true);
      setTimeout(() => onSuccess(), 500);
    } else {
      setShowError(true);
      setPassword('');
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 transition-opacity duration-500"
      style={{
        background: 'linear-gradient(135deg, #FF8C00 0%, #FFCBA4 100%)',
        opacity: fadeOut ? 0 : 1,
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center gap-4">
        {/* Icon */}
        <img
          src="/icons/icon-192.png"
          alt="Scratteach"
          className="w-20 h-20 rounded-2xl shadow"
        />

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: '#FF8C00' }}>
            Scratteach
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">スクラッティーチ</p>
        </div>

        {/* Form */}
        <div className="w-full flex flex-col gap-3">
          <label className="text-sm text-gray-600 text-center">
            今月のパスワードを入力してください
          </label>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-300 transition"
            placeholder="パスワード"
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !password}
            className="w-full py-3 rounded-xl text-white font-semibold text-base transition disabled:opacity-50"
            style={{ backgroundColor: '#FF8C00' }}
          >
            {isLoading ? '確認中...' : 'はじめる'}
          </button>
        </div>

        {/* Error */}
        {showError && (
          <div className="w-full text-center">
            <p className="text-sm font-medium" style={{ color: '#E53E3E' }}>
              パスワードが違います
            </p>
            <p className="text-xs text-gray-500 mt-2">
              NOTEメンバーシップに加入するとパスワードを受け取れます
            </p>
            <a
              href="https://note.com/scratteach/membership"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline mt-1 inline-block"
              style={{ color: '#FF8C00' }}
            >
              NOTEメンバーシップはこちら →
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordGate;
