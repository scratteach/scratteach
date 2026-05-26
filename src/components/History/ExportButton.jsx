import React, { useState } from 'react';
import { shareOrDownload, printConversation, exportToHTML, downloadAsHTML } from '../../lib/export.js';

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="3" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 7l5-3M5 9l5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PrintIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 5V2h8v3M1 5h14v7H1V5zM4 9h8M4 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ExportButton = ({ conversation }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!conversation || !conversation.messages?.length) return null;

  const handleExportHTML = async () => {
    setIsExporting(true);
    try {
      const html = exportToHTML(conversation);
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeTitle = (conversation.title || 'conversation')
        .replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龥]/g, '-')
        .slice(0, 30);
      downloadAsHTML(html, `scratteach-${safeTitle}-${dateStr}.html`);
    } catch (e) {
      console.error('Export failed:', e);
      alert('エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
      setIsMenuOpen(false);
    }
  };

  const handleShare = async () => {
    setIsExporting(true);
    try {
      await shareOrDownload(conversation);
    } catch (e) {
      console.error('Share failed:', e);
    } finally {
      setIsExporting(false);
      setIsMenuOpen(false);
    }
  };

  const handlePrint = () => {
    setIsMenuOpen(false);
    printConversation();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsMenuOpen((v) => !v)}
        disabled={isExporting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <DownloadIcon />
        エクスポート
      </button>

      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
            <button
              onClick={handleExportHTML}
              className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <DownloadIcon />
              HTMLで保存
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ShareIcon />
              共有する
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <PrintIcon />
              印刷・PDF保存
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportButton;
