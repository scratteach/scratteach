import React from 'react';
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

const ScratchBlockPanel = ({ code, title = 'ブロック' }) => {
  const { ref, isRendered, renderError } = useScratchBlocks(code);

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
      <div
        ref={ref}
        className="w-full overflow-x-auto"
        style={{ display: isRendered ? 'block' : 'none' }}
      />
      {/* Fallback: show raw code */}
      {renderError && (
        <pre className="mt-2 text-xs bg-gray-100 rounded-lg p-3 overflow-x-auto text-gray-600 whitespace-pre-wrap">
          {code}
        </pre>
      )}
    </div>
  );
};

export default ScratchBlockPanel;
