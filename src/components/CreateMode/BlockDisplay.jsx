import React, { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ScratchBlockPanel from '../Chat/ScratchBlockPanel.jsx';

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

const exportBlockToPNG = async (spriteId, spriteName) => {
  const element = document.getElementById(`block-display-${spriteId}`);
  if (!element) return;
  const canvas = await html2canvas(element, { scale: 0.6 });
  const link = document.createElement('a');
  link.download = `scratteach-${spriteName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

const exportAllToPDF = async (gameTitle, spec) => {
  const element = document.getElementById('block-display-all');
  if (!element) return;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Page 1: text summary
  pdf.setFontSize(16);
  pdf.text(`ゲーム名：${gameTitle}`, 15, 20);
  pdf.setFontSize(10);
  pdf.text(`作成日：${new Date().toLocaleDateString('ja-JP')}`, 15, 30);
  pdf.line(15, 35, pageWidth - 15, 35);
  pdf.setFontSize(12);
  pdf.text('【決定した仕様】', 15, 45);
  pdf.setFontSize(10);
  let y = 55;
  if (spec) {
    Object.entries(spec).forEach(([key, value]) => {
      const line = `・${key}：${value}`;
      const lines = pdf.splitTextToSize(line, pageWidth - 30);
      lines.forEach(l => {
        if (y > pageHeight - 20) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(l, 15, y);
        y += 7;
      });
    });
  }

  // Page 2+: block canvas
  pdf.addPage();

  const canvas = await html2canvas(element, { scale: 0.6 });
  const imgWidth = pageWidth - 20;
  const totalImgHeight = (canvas.height * imgWidth) / canvas.width;
  const pageContentHeight = pageHeight - 20;

  let heightLeft = totalImgHeight;
  let position = 10;

  pdf.addImage(canvas, 'PNG', 10, position, imgWidth, totalImgHeight, '', 'FAST');
  heightLeft -= pageContentHeight;

  while (heightLeft > 0) {
    pdf.addPage();
    position -= pageContentHeight;
    pdf.addImage(canvas, 'PNG', 10, position, imgWidth, totalImgHeight, '', 'FAST');
    heightLeft -= pageContentHeight;
  }

  pdf.save(`scratteach-${gameTitle}.pdf`);
};

const SpriteSection = ({ sprite, spriteId, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPNG = async (e) => {
    e.stopPropagation();
    setIsExporting(true);
    await exportBlockToPNG(spriteId, sprite.name);
    setIsExporting(false);
  };

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
          <ScratchBlockPanel code={sprite.blocks} />
        </div>
      )}
    </div>
  );
};

const BlockDisplay = ({ sprites, spec, gameTitle, onModifySpec }) => {
  const [isExportingAll, setIsExportingAll] = useState(false);

  if (!sprites || sprites.length === 0) return null;

  const title = gameTitle || spec?.['ゲームの種類'] || 'ゲーム';

  const handleExportAll = async () => {
    setIsExportingAll(true);
    await exportAllToPDF(title, spec);
    setIsExportingAll(false);
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
