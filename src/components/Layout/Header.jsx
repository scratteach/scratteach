import React from 'react';

const ScratchIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="28" height="28" rx="6" fill="#FF6600" />
    <text x="14" y="20" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="sans-serif">S</text>
  </svg>
);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8.325 2.317a1.75 1.75 0 0 1 3.35 0A1.75 1.75 0 0 0 13.96 3.4a1.75 1.75 0 0 1 2.371 2.37 1.75 1.75 0 0 0 1.084 2.286 1.75 1.75 0 0 1 0 3.35 1.75 1.75 0 0 0-1.083 2.285 1.75 1.75 0 0 1-2.371 2.371 1.75 1.75 0 0 0-2.286 1.084 1.75 1.75 0 0 1-3.35 0 1.75 1.75 0 0 0-2.285-1.083 1.75 1.75 0 0 1-2.371-2.371 1.75 1.75 0 0 0-1.084-2.286 1.75 1.75 0 0 1 0-3.35A1.75 1.75 0 0 0 3.4 6.04a1.75 1.75 0 0 1 2.37-2.371 1.75 1.75 0 0 0 2.556-1.352z"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    />
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const Header = ({ onOpenSettings, onToggleSidebar, isSidebarOpen, currentMode = 'question' }) => {
  const isCreate = currentMode === 'create';
  const accentColor = isCreate ? 'text-sky-500' : 'text-orange-500';
  const badgeBg = isCreate ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-orange-50 text-orange-600 border-orange-200';

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm no-print">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="履歴を開く"
        >
          <MenuIcon />
        </button>

        <div className="flex items-center gap-2">
          <ScratchIcon />
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">
              <span className={accentColor}>Scrat</span>teach
            </h1>
            <p className="text-xs text-gray-500 leading-none hidden sm:block">スクラッティーチ</p>
          </div>
        </div>

        <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full border font-medium ${badgeBg}`}>
          {isCreate ? '🛠 いっしょにつくる' : '💬 質問モード'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm"
          aria-label="設定を開く"
        >
          <SettingsIcon />
          <span className="hidden sm:inline">設定</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
