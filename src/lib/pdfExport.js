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

// 日本語を含むHTMLを画面外でレンダリングしてキャンバス化する。
// jsPDFの標準フォントは日本語非対応で pdf.text() だと文字化けするため、
// テキストはすべてブラウザの日本語フォントで描画してから画像として貼る。
const htmlToCanvas = async (html, cssWidth) => {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: '-99999px',
    top: '0',
    width: `${cssWidth}px`,
    boxSizing: 'border-box',
    background: '#ffffff',
    color: '#111111',
    margin: '0',
    padding: '0',
    fontFamily:
      '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
  });
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    return await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });
  } finally {
    document.body.removeChild(container);
  }
};

// HTMLエスケープ（タイトルや仕様値にHTML特殊文字が含まれても安全に）
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
  if (remaining <= 0) {
    return startY + imgHeight; // 単一ページに収まった
  }
  while (remaining > 0) {
    pdf.addPage();
    const yPos = -(imgHeight - remaining);
    pdf.addImage(canvas, 'PNG', MARGIN, yPos, imgWidth, imgHeight, '', 'FAST');
    const thisPageEnd = yPos + imgHeight; // このページでの画像下端
    remaining -= visiblePerPage;
    if (remaining <= 0) return thisPageEnd;
  }
  return MARGIN;
};

// A4の本文幅（pageWidth - 余白*2）をCSSピクセルに換算（96dpi: 1mm≒3.7795px）
const contentPx = (pdf) =>
  Math.round((pdf.internal.pageSize.getWidth() - MARGIN * 2) * 3.7795);

// 日本語見出しを画像として現在位置に描画し、続きのy座標を返す
const addHeading = async (pdf, text, startY = MARGIN) => {
  const canvas = await htmlToCanvas(
    `<div style="font-size:18px;font-weight:700;">${esc(text)}</div>`,
    contentPx(pdf)
  );
  return addCanvasToMultiPagePDF(pdf, canvas, startY);
};

// 単一要素をPDFに書き出す
export const exportElementToPDF = async (elementId, filename, pageTitle = null) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const pdf = new jsPDF('p', 'mm', 'a4');

  let startY = MARGIN;
  if (pageTitle) {
    // 日本語タイトル＋日付を画像化して描画（pdf.text は日本語非対応で文字化けする）
    const headerCanvas = await htmlToCanvas(
      `<div style="font-size:20px;font-weight:700;">${esc(pageTitle)}</div>` +
        `<div style="font-size:11px;margin-top:6px;">${esc(new Date().toLocaleDateString('ja-JP'))}</div>` +
        `<hr style="border:none;border-top:1px solid #000;margin:8px 0 0;"/>`,
      contentPx(pdf)
    );
    startY = addCanvasToMultiPagePDF(pdf, headerCanvas, MARGIN) + 4;
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
  let hasContent = false;

  // ページ1: タイトル + 仕様（日本語はHTMLを画像化して描画）
  if (gameTitle) {
    const specRows =
      spec && Object.keys(spec).length > 0
        ? `<div style="font-size:16px;font-weight:700;margin:18px 0 8px;">【決定した仕様】</div>` +
          Object.entries(spec)
            .map(
              ([key, value]) =>
                `<div style="font-size:13px;line-height:1.6;margin:2px 0;">・${esc(key)}：${esc(value)}</div>`
            )
            .join('')
        : '';
    const coverCanvas = await htmlToCanvas(
      `<div style="font-size:24px;font-weight:700;">ゲーム名：${esc(gameTitle)}</div>` +
        `<div style="font-size:13px;margin-top:10px;">作成日：${esc(new Date().toLocaleDateString('ja-JP'))}</div>` +
        `<hr style="border:none;border-top:1px solid #000;margin:10px 0 0;"/>` +
        specRows,
      contentPx(pdf)
    );
    addCanvasToMultiPagePDF(pdf, coverCanvas, MARGIN);
    hasContent = true;
  }

  // 会話エリアのキャプチャ
  const chatEl = chatElementId ? document.getElementById(chatElementId) : null;
  if (chatEl) {
    if (hasContent) pdf.addPage();
    const y = await addHeading(pdf, '【会話ログ】', MARGIN);
    const chatCanvas = await captureElement(chatEl);
    if (chatCanvas) {
      addCanvasToMultiPagePDF(pdf, chatCanvas, y + 3);
    }
    hasContent = true;
  }

  // ブロックエリアのキャプチャ
  const blocksEl = blocksElementId ? document.getElementById(blocksElementId) : null;
  if (blocksEl) {
    if (hasContent) pdf.addPage();
    const y = await addHeading(pdf, '【Scratchブロック】', MARGIN);
    const blocksCanvas = await captureElement(blocksEl);
    if (blocksCanvas) {
      addCanvasToMultiPagePDF(pdf, blocksCanvas, y + 3);
    }
  }

  pdf.save(filename);
};
