import React, { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble.jsx';
import InputBar from './InputBar.jsx';
import ScratchBlockPanel from './ScratchBlockPanel.jsx';

const LoadingMessage = () => (
  <div className="flex justify-start mb-4">
    <div className="max-w-[90%]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <span className="text-xs font-medium text-gray-500">スクラッティーチ</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      </div>
    </div>
  </div>
);

const WelcomeScreen = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
    <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center mb-4 shadow-lg">
      <span className="text-white text-3xl font-bold">S</span>
    </div>
    <h2 className="text-xl font-bold text-gray-800 mb-2">
      スクラッティーチへようこそ！
    </h2>
    <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-6">
      子供にScratchを教える親のためのAIアシスタントです。
      Scratchに関する質問を何でもどうぞ。
      ブロックの使い方から思考の仕方まで、わかりやすく説明します。
    </p>
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
      {[
        { emoji: '🐱', text: 'キャラクターを動かしたい' },
        { emoji: '🔁', text: '繰り返し処理を覚えたい' },
        { emoji: '🎵', text: '音や効果を追加したい' },
        { emoji: '💬', text: '変数って何？' },
      ].map(({ emoji, text }) => (
        <div
          key={text}
          className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-600"
        >
          <span>{emoji}</span>
          <span>{text}</span>
        </div>
      ))}
    </div>
  </div>
);

const ErrorBanner = ({ error, onDismiss }) => {
  if (!error) return null;
  return (
    <div className="mx-4 my-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-red-500 flex-shrink-0 mt-0.5">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <p className="text-sm text-red-700 flex-1 whitespace-pre-wrap">{error}</p>
      <button
        onClick={onDismiss}
        className="text-red-400 hover:text-red-600 flex-shrink-0"
        aria-label="エラーを閉じる"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
};

const ChatWindow = ({
  messages,
  isLoading,
  error,
  onSendMessage,
  onClearError,
}) => {
  const messagesEndRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // 新しいAIメッセージが来たら自動的にそのブロックをアクティブにする
  useEffect(() => {
    const lastAIIndex = [...messages].map((m, i) => ({ m, i }))
      .filter(({ m }) => m.role === 'assistant' && m.parsed?.blocks)
      .at(-1)?.i ?? null;
    setActiveIndex(lastAIIndex);
  }, [messages]);

  const activeBlock = activeIndex !== null ? messages[activeIndex]?.parsed?.blocks : null;
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Chat column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div id="question-mode-messages" className="flex-1 overflow-y-auto px-4 py-4">
          {isEmpty && !isLoading ? (
            <WelcomeScreen />
          ) : (
            <>
              {messages.map((message, index) => (
                <MessageBubble
                  key={index}
                  message={message}
                  messageIndex={index}
                  activeIndex={activeIndex}
                  onSetActiveIndex={setActiveIndex}
                  isDesktop={isDesktop}
                />
              ))}
              {isLoading && <LoadingMessage />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <ErrorBanner error={error} onDismiss={onClearError} />

        <InputBar
          onSend={onSendMessage}
          isLoading={isLoading}
          isEmpty={isEmpty}
          mode="question"
        />
      </div>

      {/* Block panel (desktop only) */}
      {isDesktop && (
        <div className="w-80 lg:w-96 flex-shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">ブロック表示</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeBlock ? 'クリックで他のメッセージのブロックを表示' : 'scratchblocksプレビュー'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ScratchBlockPanel code={activeBlock} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
