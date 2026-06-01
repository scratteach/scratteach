import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MARGIN = 10; // mm

// スクロール可能な要素を含む全コンテンツをhtml2canvasでキャプチャ
export const captureElement = async (element) => {
  if (!element) return null;

  const origOverflow = element.style.overflow;
  const origMaxHeight = element.style.maxHeight;
  const origHeight = element.style.height;

  element.style.overflow = 'visible';
  element.style.maxHeight = 'none';
  element.style.height = 'auto';

  try {
    return await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(document.documentElement.clientWidth, element.scrollWidth),
      windowHeight: element.scrollHeight,
    });
  } finally {
    element.style.overflow = origOverflow;
    element.style.maxHeight = origMaxHeight;
    element.style.height = origHeight;
  }
};

// キャンバスをPDFの現在ページから複数ページに分割して描画
// 戻り値: 最終ページで使用したy座標の末尾（続けてテキストを追加する際に使用）
export const addCanvasToMultiPagePDF = (pdf, canvas, startY = MARGIN) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth - MARGIN * 2;
  // scale:2 のキャンバスはピクセルが2倍のため、実際の表示サイズで計算
  const imgHeight = (canvas.height / canvas.width) * imgWidth;
  const visiblePerPage = pageHeight - MARGIN;

  pdf.addImage(canvas, 'PNG', MARGIN, startY, imgWidth, imgHeight, '', 'FAST');

  let remaining = imgHeight - (visiblePerPage - startY);
  while (remaining > 0) {
    pdf.addPage();
    const yPos = -(imgHeight - remaining);
    pdf.addImage(canvas, 'PNG', MARGIN, yPos, imgWidth, imgHeight, '', 'FAST');
    remaining -= visiblePerPage;
  }
};

// 単一要素をPDFに書き出す
export const exportElementToPDF = async (elementId, filename, pageTitle = null) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();

  let startY = MARGIN;
  if (pageTitle) {
    pdf.setFontSize(14);
    pdf.text(pageTitle, MARGIN, startY + 5);
    pdf.setFontSize(8);
    pdf.text(new Date().toLocaleDateString('ja-JP'), MARGIN, startY + 11);
    pdf.line(MARGIN, startY + 14, pageWidth - MARGIN, startY + 14);
    startY += 18;
  }

  const canvas = await captureElement(element);
  if (!canvas) return;

  addCanvasToMultiPagePDF(pdf, canvas, startY);
  pdf.save(filename);
};

// 会話エリアとブロックエリアを1つのPDFに保存
export const exportChatAndBlocksToPDF = async ({
  chatElementId,
  blocksElementId,
  filename,
  gameTitle,
  spec,
}) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let hasContent = false;

  // ページ1: タイトル + 仕様
  if (gameTitle) {
    pdf.setFontSize(16);
    pdf.text(`ゲーム名：${gameTitle}`, MARGIN, 20);
    pdf.setFontSize(10);
    pdf.text(`作成日：${new Date().toLocaleDateString('ja-JP')}`, MARGIN, 30);
    pdf.line(MARGIN, 35, pageWidth - MARGIN, 35);

    if (spec && Object.keys(spec).length > 0) {
      pdf.setFontSize(12);
      pdf.text('【決定した仕様】', MARGIN, 45);
      pdf.setFontSize(10);
      let y = 55;
      Object.entries(spec).forEach(([key, value]) => {
        const line = `・${key}：${value}`;
        const lines = pdf.splitTextToSize(line, pageWidth - MARGIN * 2);
        lines.forEach(l => {
          if (y > pageHeight - 20) { pdf.addPage(); y = 20; }
          pdf.text(l, MARGIN, y);
          y += 7;
        });
      });
    }
    hasContent = true;
  }

  // 会話エリアのキャプチャ
  const chatEl = chatElementId ? document.getElementById(chatElementId) : null;
  if (chatEl) {
    if (hasContent) pdf.addPage();
    pdf.setFontSize(12);
    pdf.text('【会話ログ】', MARGIN, 15);
    const chatCanvas = await captureElement(chatEl);
    if (chatCanvas) {
      addCanvasToMultiPagePDF(pdf, chatCanvas, 20);
    }
    hasContent = true;
  }

  // ブロックエリアのキャプチャ
  const blocksEl = blocksElementId ? document.getElementById(blocksElementId) : null;
  if (blocksEl) {
    pdf.addPage();
    pdf.setFontSize(12);
    pdf.text('【Scratchブロック】', MARGIN, 15);
    const blocksCanvas = await captureElement(blocksEl);
    if (blocksCanvas) {
      addCanvasToMultiPagePDF(pdf, blocksCanvas, 20);
    }
  }

  pdf.save(filename);
};
