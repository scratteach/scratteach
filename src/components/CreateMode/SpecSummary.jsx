import React from 'react';

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="7" fill="#5BB8F5" />
    <path d="M4.5 8l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SpecSummary = ({ spec, onApprove, onModify, isLatest = true }) => {
  const specEntries = spec ? Object.entries(spec) : [];

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-sky-400 flex items-center justify-center">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <span className="text-sm font-semibold text-sky-700">決定した仕様</span>
      </div>

      <div className="space-y-1.5 mb-4">
        {specEntries.length > 0 ? (
          specEntries.map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 text-sm">
              <CheckIcon />
              <span className="text-gray-700">
                <span className="font-medium text-sky-700">{key}：</span>
                {String(value)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">仕様を確認中...</p>
        )}
      </div>

      {isLatest && (
        <div className="flex gap-2 pt-2 border-t border-sky-200">
          <button
            onClick={onApprove}
            className="flex-1 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            はい、作って！
          </button>
          <button
            onClick={onModify}
            className="flex-1 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium px-4 py-2.5 rounded-xl border border-gray-200 transition-colors"
          >
            仕様を修正する
          </button>
        </div>
      )}
    </div>
  );
};

export default SpecSummary;
