import React from 'react';

const ModeSelector = ({ currentMode, onModeChange }) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white no-print">
      <button
        onClick={() => onModeChange('question')}
        className={`
          flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all
          ${currentMode === 'question'
            ? 'bg-orange-500 text-white shadow-sm'
            : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 border border-gray-200'
          }
        `}
      >
        <span>💬</span>
        <span>質問モード</span>
      </button>

      <button
        onClick={() => onModeChange('create')}
        className={`
          flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all
          ${currentMode === 'create'
            ? 'bg-sky-400 text-white shadow-sm'
            : 'text-gray-500 hover:bg-sky-50 hover:text-sky-600 border border-gray-200'
          }
        `}
      >
        <span>🛠</span>
        <span>いっしょにつくる</span>
      </button>
    </div>
  );
};

export default ModeSelector;
