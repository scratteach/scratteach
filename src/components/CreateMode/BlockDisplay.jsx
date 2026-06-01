import React, { useState, useRef, useCallback, useEffect } from 'react';
import ScratchBlockPanel from '../Chat/ScratchBlockPanel.jsx';
import { captureElement } from '../../lib/pdfExport.js';

const ChevronIcon = ({ isOpen }) => (
  <svg
    width="16" height="16" viewBox="0 0 16 16" fill="none"
    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
  >
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SpriteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="3" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.8" />
    <rect x="3" y="7.5" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.6" />
  </svg>
);

// ブロックエリアのみPNGで保存（📄↓ボタン）
const exportBlockToPNG = async (spriteId, spriteName) => {
  const element = document.getElementById(`block-display-${spriteId}`);
  if (!element) return;
  const canvas = await captureElement(element);
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `scratteach-${spriteName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

const SpriteSection = ({ sprite, spriteId, defaultOpen = false, onSpriteInvalidBlocks }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPNG = async (e) => {
    e.stopPropagation();
    setIsExporting(true);
    await exportBlockToPNG(spriteId, sprite.name);
    setIsExporting(false);
  };

  const handleInvalidBlocks = useCallback((blocks) => {
    if (onSpriteInvalidBlocks) {
      onSpriteInvalidBlocks(sprite.name, blocks);
    }
  }, [sprite.name, onSpriteInvalidBlocks]);

  return (
    <div className="border border-sky-200 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center justify-between w-full px-4 py-3 bg-sky-50 hover:bg-sky-100 transition-colors text-sm font-medium text-sky-700 cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <SpriteIcon />
          【{sprite.name}】のブロック
        </span>
        <span className="flex items-center gap-2">
          <span
            onClick={handleExportPNG}
            className="text-xs px-2 py-0.5 rounded border border-sky-300 text-sky-600 bg-white hover:bg-sky-50 transition-colors cursor-pointer"
            title="このスプライトのブロックをPNG保存"
          >
            {isExporting ? '...' : '📄↓'}
          </span>
          <ChevronIcon isOpen={isOpen} />
        </span>
      </button>

      {isOpen && (
        <div id={`block-display-${spriteId}`} className="px-4 py-3 bg-white">
          <p className="text-xs text-sky-600 bg-sky-50 rounded-lg px-3 py-2 mb-3 border border-sky-100">
            📌 {sprite.description}
          </p>
          <ScratchBlockPanel
            code={sprite.blocks}
            onInvalidBlocks={handleInvalidBlocks}
          />
        </div>
      )}
    </div>
  );
};

const BlockDisplay = ({ sprites, spec, gameTitle, onModifySpec, onInvalidBlocks, onExportAll }) => {
  const [isExportingAll, setIsExportingAll] = useState(false);

  // スプライトが変わるたびに集計をリセット
  const pendingRef = useRef({});
  const timerRef = useRef(null);

  useEffect(() => {
    pendingRef.current = {};
    clearTimeout(timerRef.current);
  }, [sprites]);

  const handleSpriteInvalidBlocks = useCallback((spriteName, blocks) => {
    pendingRef.current[spriteName] = blocks;

    // 300ms待って全スプライトの報告をまとめてから親に通知
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!onInvalidBlocks) return;
      const invalidList = Object.entries(pendingRef.current)
        .filter(([, b]) => b.length > 0)
        .map(([spriteName, blocks]) => ({ spriteName, blocks }));
      if (invalidList.length > 0) {
        onInvalidBlocks(invalidList);
      }
    }, 300);
  }, [onInvalidBlocks]);

  if (!sprites || sprites.length === 0) return null;

  const title = gameTitle || spec?.['ゲームの種類'] || 'ゲーム';

  const handleExportAll = async () => {
    setIsExportingAll(true);
    try {
      // 親から onExportAll が渡されていれば会話+ブロック全体PDF
      // 渡されていなければブロックエリアのみPDF（フォールバック）
      if (onExportAll) {
        await onExportAll();
      }
    } finally {
      setIsExportingAll(false);
    }
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-sky-400 flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="text-sm font-semibold text-sky-700">
            生成されたブロック（{sprites.length}スプライト）
          </span>
        </div>
        {onModifySpec && (
          <button
            onClick={onModifySpec}
            className="text-xs px-3 py-1.5 rounded-lg border border-sky-200 text-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors"
          >
            仕様を修正する
          </button>
        )}
      </div>

      <div id="block-display-all" className="space-y-0">
        {sprites.map((sprite, i) => (
          <SpriteSection
            key={i}
            sprite={sprite}
            spriteId={i}
            defaultOpen={i === 0}
            onSpriteInvalidBlocks={handleSpriteInvalidBlocks}
          />
        ))}
      </div>

      <button
        onClick={handleExportAll}
        disabled={isExportingAll}
        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors text-sm font-medium disabled:opacity-50"
      >
        {isExportingAll ? '保存中...' : '📄 全部まとめてPDF保存'}
      </button>
    </div>
  );
};

export default BlockDisplay;
