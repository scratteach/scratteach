import React from 'react';

const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return '昨日';
  } else if (diffDays < 7) {
    return `${diffDays}日前`;
  } else {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }
};

const HistoryList = ({
  conversations,
  currentConversationId,
  onSelect,
  onDelete,
}) => {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        <p>会話履歴がありません</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {conversations.map((conv) => (
        <li key={conv.id}>
          <button
            onClick={() => onSelect(conv.id)}
            className={`
              w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-2 group
              transition-colors
              ${currentConversationId === conv.id
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {conv.title || '無題の会話'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(conv.updatedAt)} · {conv.messages?.length || 0}件
              </p>
            </div>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('この会話を削除しますか？')) {
                    onDelete(conv.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition-all"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1.5 3h10M4.5 3V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M11 3l-.6 7a1 1 0 0 1-1 .9H3.6a1 1 0 0 1-1-.9L2 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default HistoryList;
