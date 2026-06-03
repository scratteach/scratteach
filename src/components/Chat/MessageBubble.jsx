import React, { useState } from 'react';
import ScratchBlockPanel from './ScratchBlockPanel.jsx';

const ChevronIcon = ({ isOpen }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
  >
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BlocksIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="3" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.8" />
    <rect x="3" y="7.5" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.6" />
  </svg>
);

const ReasonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
    <path d="M7 6v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const HintIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 1a5 5 0 0 1 2.6 9.3V12H4.4v-1.7A5 5 0 0 1 7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M5 12.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const Accordion = ({ icon, label, children, defaultOpen = false, accentColor = 'gray' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colors = {
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  return (
    <div className="accordion-panel">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="accordion-header"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>
      {isOpen && (
        <div className="accordion-content">
          {children}
        </div>
      )}
    </div>
  );
};

const formatText = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, i) => (
    <React.Fragment key={i}>
      {line}
      {i < text.split('\n').length - 1 && <br />}
    </React.Fragment>
  ));
};

const UserMessage = ({ content, image }) => (
  <div className="flex justify-end mb-4">
    <div className="max-w-[80%]">
      {image && (
        <div className="flex justify-end mb-1">
          <img
            src={image.preview || `data:${image.mimeType};base64,${image.data}`}
            alt="添付画像"
            className="max-h-48 rounded-xl object-contain border border-gray-200"
          />
        </div>
      )}
      {content && (
        <div className="bg-orange-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
          {content}
        </div>
      )}
    </div>
  </div>
);

const AIMessage = ({ message, messageIndex, activeIndex, onSetActiveIndex, isDesktop }) => {
  const parsed = message.parsed || { explanation: message.content, blocks: null, reason: null, hint: null };
  const isActive = messageIndex === activeIndex;

  return (
    <div className="flex justify-start mb-4">
      <div className="w-full max-w-[90%] min-w-0">
        {/* Avatar + name */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="text-xs font-medium text-gray-500">スクラッティーチ</span>
        </div>

        {/* Main explanation */}
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-gray-800 mb-2">
          {formatText(parsed.explanation)}
        </div>

        {/* Desktop: ブロック切り替えボタン / Mobile: アコーディオン */}
        {parsed.blocks && isDesktop && (
          <button
            onClick={() => onSetActiveIndex(messageIndex)}
            className={`
              flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all mb-1
              ${isActive
                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                : 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50'
              }
            `}
          >
            <BlocksIcon />
            {isActive ? '右パネルに表示中' : 'ブロックを右パネルで見る'}
          </button>
        )}

        {parsed.blocks && !isDesktop && (
          <Accordion
            icon={<BlocksIcon />}
            label="ブロックを見る"
            defaultOpen={true}
            accentColor="orange"
          >
            <ScratchBlockPanel code={parsed.blocks} />
          </Accordion>
        )}

        {/* Reason accordion */}
        {parsed.reason && (
          <Accordion
            icon={<ReasonIcon />}
            label="なぜこう書くの？"
            defaultOpen={false}
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              {formatText(parsed.reason)}
            </p>
          </Accordion>
        )}

        {/* Hint accordion */}
        {parsed.hint && (
          <Accordion
            icon={<HintIcon />}
            label="子供への伝え方ヒント"
            defaultOpen={false}
          >
            <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800 leading-relaxed">
              {formatText(parsed.hint)}
            </div>
          </Accordion>
        )}
      </div>
    </div>
  );
};

const MessageBubble = ({ message, messageIndex, activeIndex, onSetActiveIndex, isDesktop }) => {
  if (message.role === 'user') {
    return <UserMessage content={message.content} image={message.image} />;
  }
  return (
    <AIMessage
      message={message}
      messageIndex={messageIndex}
      activeIndex={activeIndex}
      onSetActiveIndex={onSetActiveIndex}
      isDesktop={isDesktop}
    />
  );
};

export default MessageBubble;
