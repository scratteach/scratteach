import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { renderScratchSVG } from './scratchRender.js';

const MARGIN = 10; // mm
const A4_W = 210;  // mm
const CONTENT_W = A4_W - MARGIN * 2; // 190mm
const MM_PER_PX = 25.4 / 96; // CSSピクセル→mm（96dpi）
const CONTENT_W_PX = Math.round(CONTENT_W / MM_PER_PX);
const RASTER = 2; // html2canvasの解像度倍率

// ブロックのPDF描画スケール（scratchblocksのscale値）。
// 値を上げるほどブロックが大きくなる。標準ブロックがA4本文幅の約2割（横に4〜5個）になる
// 1.1前後を採用（現状表示の約5〜6割の大きさ感）。横長スクリプトは fitBlockWidth で縮小する。
const BLOCK_SCALE = 1.1;
// 横幅オーバー時、A4本文幅へ縮小してよい下限比率。これ未満になるならページ自体を広げる。
const MIN_FIT_RATIO = 0.6;
// PDF1ページの最大高さ(mm)。これを超える会話ログはA4複数ページへ分割（保険）。
const MAX_PAGE_MM = 4800;

// iOS（iPhone/iPad）判定。iOS SafariはjsPDFのsave()がダウンロードにならず、
// 同じ画面内のPDFビューアでドキュメントを置き換えてしまう（戻るとPWAがリロードされ状態が消える）。
const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ はデスクトップSafariを名乗るためタッチ数で補正
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

// PDFを保存する。iOSではSPA自体を置き換えないよう、Blobを別タブで開く方式にする。
// （別タブ＝Safari側でPDFが開き、元のPWA画面はそのまま残る）。それ以外は従来どおりダウンロード。
const savePdf = (pdf, filename) => {
  if (isIOS()) {
    try {
      const url = pdf.output('bloburl');
      const win = window.open(url, '_blank');
      if (win) return;
      // ポップアップが塞がれた場合は同タブで開く（最低限PDFは見られる）
      window.location.href = url;
      return;
    } catch {
      // 失敗時は従来のsave()にフォールバック
    }
  }
  pdf.save(filename);
};

// ===== 既存：DOMキャプチャ系（質問モードの会話PDF等で使用） =====

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
      scale: RASTER,
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

// 会話ログなど既存DOMを「画面幅に依存しない固定幅」でキャンバス化する。
// 画面のDOMをそのまま測ると、PC(横広レイアウト)とiPhone(縦長・狭い1カラム)で
// テキストの折り返し幅が変わり、PDFの縦横比・改ページ挙動が食い違う
// （長い会話ではA4分割の保険が働き、メッセージ途中で切れる）。
// オフスクリーンの固定幅コンテナへ複製して描くことで、どの端末でも同じ結果にする。
// 戻り値: { canvas, cssW, cssH }（cssWは実際に描かれた幅＝ブロックSVGが広ければ固定幅を超える）
const captureElementAtWidth = async (element, cssWidth) => {
  if (!element) return { canvas: null, cssW: 0, cssH: 0 };

  const clone = element.cloneNode(true);
  Object.assign(clone.style, {
    overflow: 'visible',
    maxHeight: 'none',
    height: 'auto',
    width: '100%',
    margin: '0',
  });

  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '-99999px',
    top: '0',
    width: `${cssWidth}px`,
    boxSizing: 'border-box',
    background: '#ffffff',
    margin: '0',
    padding: '0',
    overflow: 'visible',
  });
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  try {
    const cssW = Math.max(cssWidth, wrapper.scrollWidth);
    const cssH = wrapper.scrollHeight;
    const canvas = await html2canvas(wrapper, {
      scale: RASTER,
      backgroundColor: '#ffffff',
      logging: false,
      width: cssW,
      height: cssH,
      windowWidth: cssW,
      windowHeight: cssH,
    });
    return { canvas, cssW, cssH };
  } finally {
    document.body.removeChild(wrapper);
  }
};

// 日本語を含むHTMLを画面外でレンダリングしてキャンバス化する。
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
      scale: RASTER,
      backgroundColor: '#ffffff',
      logging: false,
    });
  } finally {
    document.body.removeChild(container);
  }
};

// HTMLエスケープ
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// キャンバスをPDFの現在ページから複数A4ページに分割して描画（会話ログの保険用）
export const addCanvasToMultiPagePDF = (pdf, canvas, startY = MARGIN) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth - MARGIN * 2;
  const imgHeight = (canvas.height / canvas.width) * imgWidth;
  const visiblePerPage = pageHeight - MARGIN;

  pdf.addImage(canvas, 'PNG', MARGIN, startY, imgWidth, imgHeight, '', 'FAST');

  let remaining = imgHeight - (visiblePerPage - startY);
  if (remaining <= 0) {
    return startY + imgHeight;
  }
  while (remaining > 0) {
    pdf.addPage();
    const yPos = -(imgHeight - remaining);
    pdf.addImage(canvas, 'PNG', MARGIN, yPos, imgWidth, imgHeight, '', 'FAST');
    const thisPageEnd = yPos + imgHeight;
    remaining -= visiblePerPage;
    if (remaining <= 0) return thisPageEnd;
  }
  return MARGIN;
};

// 単一要素をPDFに書き出す（質問モードの会話ログ等）
export const exportElementToPDF = async (elementId, filename, pageTitle = null) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const pdf = new jsPDF('p', 'mm', 'a4');

  let startY = MARGIN;
  if (pageTitle) {
    const headerCanvas = await htmlToCanvas(
      `<div style="font-size:20px;font-weight:700;">${esc(pageTitle)}</div>` +
        `<div style="font-size:11px;margin-top:6px;">${esc(new Date().toLocaleDateString('ja-JP'))}</div>` +
        `<hr style="border:none;border-top:1px solid #000;margin:8px 0 0;"/>`,
      CONTENT_W_PX
    );
    startY = addCanvasToMultiPagePDF(pdf, headerCanvas, MARGIN) + 4;
  }

  const canvas = await captureElement(element);
  if (!canvas) return;

  addCanvasToMultiPagePDF(pdf, canvas, startY);
  savePdf(pdf, filename);
};

// ===== 新方式：セクションごとに1枚の長尺ページを作る =====

// 横幅に応じて、ブロック画像の描画幅とページ幅を決める。
// ・本文幅に収まる → そのまま、ページはA4
// ・はみ出すが MIN_FIT_RATIO まで縮めれば収まる → 本文幅へ縮小、ページはA4
// ・それでも収まらない → 縮小は下限で止め、そのページだけ横幅を広げる
const fitBlockWidth = (naturalWidthMm) => {
  if (naturalWidthMm <= CONTENT_W) return { drawW: naturalWidthMm, pageW: A4_W };
  const ratio = CONTENT_W / naturalWidthMm;
  if (ratio >= MIN_FIT_RATIO) return { drawW: CONTENT_W, pageW: A4_W };
  const drawW = naturalWidthMm * MIN_FIT_RATIO;
  return { drawW, pageW: drawW + MARGIN * 2 };
};

// スプライトのブロックコードを画面外で描き直してキャンバス化する。
// 戻り値: { canvas, cssW, cssH }（cssはBLOCK_SCALE適用後のCSSピクセル寸法）
const renderBlocksCanvas = async (blocksCode) => {
  const svg = renderScratchSVG(blocksCode, BLOCK_SCALE);
  const cssW = parseFloat(svg.getAttribute('width')) || 0;
  const cssH = parseFloat(svg.getAttribute('height')) || 0;
  svg.style.display = 'block';

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: '-99999px',
    top: '0',
    background: '#ffffff',
    margin: '0',
    padding: '0',
    width: `${cssW}px`,
    height: `${cssH}px`,
  });
  container.appendChild(svg);
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, {
      scale: RASTER,
      backgroundColor: '#ffffff',
      logging: false,
      width: Math.ceil(cssW),
      height: Math.ceil(cssH),
    });
    return { canvas, cssW, cssH };
  } finally {
    document.body.removeChild(container);
  }
};

// 1スプライト分のページ記述子（見出し＋説明＋ブロック）を組み立てる
const buildSpriteSection = async (sprite, index) => {
  const headingHtml =
    `<div style="font-size:16px;font-weight:700;">【スプライト：${esc(sprite.name)}】</div>` +
    (sprite.description
      ? `<div style="font-size:12px;line-height:1.6;color:#333;margin-top:4px;">📌 ${esc(sprite.description)}</div>`
      : '');
  const headingCanvas = await htmlToCanvas(headingHtml, CONTENT_W_PX);
  const headingH = (headingCanvas.height / headingCanvas.width) * CONTENT_W;

  const { canvas: blockCanvas, cssW, cssH } = await renderBlocksCanvas(sprite.blocks);
  const naturalW = cssW * MM_PER_PX;
  const { drawW, pageW } = fitBlockWidth(naturalW);
  const drawH = cssW > 0 ? drawW * (cssH / cssW) : 0;

  const items = [];
  let y = MARGIN;
  items.push({ canvas: headingCanvas, x: MARGIN, y, w: CONTENT_W, h: headingH });
  y += headingH + 4;
  items.push({ canvas: blockCanvas, x: MARGIN, y, w: drawW, h: drawH });
  y += drawH + MARGIN;

  return { pageW: Math.max(A4_W, pageW), pageH: y, items };
};

// 会話ログのページ記述子を組み立てる（タイトル・仕様・会話キャプチャ）
const buildConversationSection = async (chatEl, gameTitle, spec) => {
  const specRows =
    spec && Object.keys(spec).length > 0
      ? `<div style="font-size:14px;font-weight:700;margin:14px 0 6px;">【決めた仕様】</div>` +
        Object.entries(spec)
          .map(
            ([key, value]) =>
              `<div style="font-size:12px;line-height:1.6;margin:2px 0;">・${esc(key)}：${esc(value)}</div>`
          )
          .join('')
      : '';
  const headingHtml =
    `<div style="font-size:22px;font-weight:700;">${esc(gameTitle || 'ゲーム')}</div>` +
    `<div style="font-size:11px;margin-top:6px;">作成日：${esc(new Date().toLocaleDateString('ja-JP'))}</div>` +
    `<hr style="border:none;border-top:1px solid #000;margin:8px 0;"/>` +
    specRows +
    `<div style="font-size:16px;font-weight:700;margin-top:14px;">【会話ログ】</div>`;
  const headingCanvas = await htmlToCanvas(headingHtml, CONTENT_W_PX);
  const headingH = (headingCanvas.height / headingCanvas.width) * CONTENT_W;

  let chatCanvas = null;
  let chatDrawW = 0;
  let chatDrawH = 0;
  if (chatEl) {
    // 画面幅ではなくA4本文幅相当の固定幅で描き直す（PC/iPhoneで同じ縦横比＝同じ長尺ページに）。
    // 本文幅いっぱいに描くことで、狭い幅で無用に縦長になり分割保険が働くのも防ぐ。
    const { canvas, cssW, cssH } = await captureElementAtWidth(chatEl, CONTENT_W_PX);
    chatCanvas = canvas;
    if (chatCanvas && cssW > 0) {
      const naturalW = cssW * MM_PER_PX;
      chatDrawW = Math.min(naturalW, CONTENT_W); // 拡大はしない（文字の巨大化防止）
      chatDrawH = chatDrawW * (cssH / cssW);
    }
  }

  const items = [];
  let y = MARGIN;
  items.push({ canvas: headingCanvas, x: MARGIN, y, w: CONTENT_W, h: headingH });
  y += headingH + 4;
  if (chatCanvas) {
    items.push({ canvas: chatCanvas, x: MARGIN, y, w: chatDrawW, h: chatDrawH });
    y += chatDrawH + MARGIN;
  }

  return { pageW: A4_W, pageH: y, items, tooTall: y > MAX_PAGE_MM, headingCanvas, headingH, chatCanvas };
};

// jsPDFにページを追加してセクションを描画
const drawSection = (pdf, section) => {
  for (const it of section.items) {
    pdf.addImage(it.canvas, 'PNG', it.x, it.y, it.w, it.h, '', 'FAST');
  }
};

const newOrAddPage = (pdf, pageW, pageH) => {
  const orientation = pageW >= pageH ? 'l' : 'p';
  if (!pdf) {
    return new jsPDF({ orientation, unit: 'mm', format: [pageW, pageH] });
  }
  pdf.addPage([pageW, pageH], orientation);
  return pdf;
};

const sanitize = (s) =>
  String(s ?? 'ゲーム')
    .replace(/[\\/:*?"<>|\n\r]+/g, '-')
    .slice(0, 40) || 'ゲーム';

// 1スプライトだけを単体PDFに書き出す（折りたたみ状態に関係なくソースから描き直す）
export const exportSpriteToPDF = async (sprite, { gameTitle } = {}) => {
  if (!sprite || !sprite.blocks) return;
  const section = await buildSpriteSection(sprite, 0);
  const pdf = newOrAddPage(null, section.pageW, section.pageH);
  drawSection(pdf, section);
  const name = sanitize(gameTitle ? `${gameTitle}-${sprite.name}` : sprite.name);
  savePdf(pdf, `scratteach-${name}.pdf`);
};

// 会話＋全スプライトを、セクションごとの長尺ページとして1つのPDFに書き出す
export const exportSessionToPDF = async ({
  chatElementId,
  sprites = [],
  spec,
  gameTitle,
  filename,
}) => {
  const chatEl = chatElementId ? document.getElementById(chatElementId) : null;

  let pdf = null;

  // ページ1：会話ログ
  const conv = await buildConversationSection(chatEl, gameTitle, spec);
  if (conv.tooTall) {
    // 保険：会話が極端に長い場合はA4複数ページへ分割
    pdf = new jsPDF('p', 'mm', 'a4');
    let y = addCanvasToMultiPagePDF(pdf, conv.headingCanvas, MARGIN) + 4;
    if (conv.chatCanvas) addCanvasToMultiPagePDF(pdf, conv.chatCanvas, y);
  } else {
    pdf = newOrAddPage(null, conv.pageW, conv.pageH);
    drawSection(pdf, conv);
  }

  // ページ2以降：各スプライト
  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i];
    if (!sprite || !sprite.blocks) continue;
    const section = await buildSpriteSection(sprite, i);
    pdf = newOrAddPage(pdf, section.pageW, section.pageH);
    drawSection(pdf, section);
  }

  savePdf(pdf, filename || `scratteach-${sanitize(gameTitle)}.pdf`);
};
