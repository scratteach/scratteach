import React, { useEffect } from 'react';
import { useScratchBlocks } from '../../hooks/useScratchBlocks.js';

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-8">
    <div className="flex gap-1.5">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </div>
  </div>
);

const InvalidBlockWarning = ({ invalidBlocks, onRebuild, isRebuilding }) => {
  if (!invalidBlocks?.length) return null;
  return (
    <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="text-red-500 flex-shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-700">
            赤いブロックが {invalidBlocks.length} 個あります
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            {onRebuild
              ? 'このままではブロック定義で作れないかもしれません。再構築しますか？'
              : 'Scratchに存在しないブロックです。実際には組めません。'}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {invalidBlocks.map((name, i) => (
              <li key={i} className="text-xs text-red-700 bg-red-100 rounded px-2 py-0.5 font-mono truncate">
                {name}
              </li>
            ))}
          </ul>
          {onRebuild && (
            <button
              onClick={onRebuild}
              disabled={isRebuilding}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-60"
            >
              {isRebuilding ? (
                <>🔧 再構築中...</>
              ) : (
                <>🔄 再構築する</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ScratchBlockPanel = ({ code, title = 'ブロック', onInvalidBlocks, onRebuild, isRebuilding }) => {
  const { ref, isRendered, renderError, invalidBlocks } = useScratchBlocks(code);

  useEffect(() => {
    if (isRendered && onInvalidBlocks) {
      onInvalidBlocks(invalidBlocks);
    }
  }, [isRendered, invalidBlocks, onInvalidBlocks]);

  if (!code) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="12" width="40" height="8" rx="4" fill="#e5e7eb" />
          <rect x="12" y="24" width="32" height="8" rx="4" fill="#e5e7eb" />
          <rect x="4" y="36" width="24" height="8" rx="4" fill="#e5e7eb" />
        </svg>
        <p className="mt-3 text-sm">ブロックは右側に表示されます</p>
      </div>
    );
  }

  return (
    <div className="scratch-block-container w-full">
      {!isRendered && !renderError && <LoadingSpinner />}
      {renderError && (
        <div className="text-sm text-red-500 bg-red-50 rounded-lg p-3 mb-3">
          {renderError}
        </div>
      )}
      <InvalidBlockWarning invalidBlocks={invalidBlocks} onRebuild={onRebuild} isRebuilding={isRebuilding} />
      <div
        ref={ref}
        className="w-full overflow-x-auto"
        style={{ display: isRendered ? 'block' : 'none' }}
      />
      {renderError && (
        <pre className="mt-2 text-xs bg-gray-100 rounded-lg p-3 overflow-x-auto text-gray-600 whitespace-pre-wrap">
          {code}
        </pre>
      )}
    </div>
  );
};

export default ScratchBlockPanel;
