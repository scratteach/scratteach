import React from 'react';
import { version as APP_VERSION } from '../../../package.json';

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ChatIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2l2 2 2-2h4a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"
      stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M11.5 3.5l-.667 7.333A1 1 0 0 1 9.84 12H4.16a1 1 0 0 1-.993-.167L2.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

const Sidebar = ({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  isOpen,
  onClose,
}) => {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative top-0 left-0 h-full z-30
          w-72 md:w-64 lg:w-72
          bg-gray-50 border-r border-gray-200
          flex flex-col
          transform transition-transform duration-200
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          no-print
        `}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <PlusIcon />
            新しいチャット
          </button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              <ChatIcon />
              <p className="mt-2">会話履歴がありません</p>
              <p className="mt-1 text-xs">新しいチャットを始めましょう</p>
            </div>
          ) : (
            <ul className="space-y-0.5 px-2">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onClose?.();
                    }}
                    className={`
                      w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-2 group
                      transition-colors
                      ${currentConversationId === conv.id
                        ? 'bg-orange-50 text-orange-700'
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <ChatIcon />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-snug">
                        {conv.title || '無題の会話'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(conv.updatedAt)}
                      </p>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('この会話を削除しますか？')) {
                          onDeleteConversation(conv.id);
                        }
                      }}
                      className={`
                        flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100
                        text-gray-400 hover:text-red-500 hover:bg-red-50
                        transition-all
                      `}
                      aria-label="会話を削除"
                    >
                      <TrashIcon />
                    </button>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Scratteach v{APP_VERSION}
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
