import scratchblocks from 'scratchblocks';
import ja from 'scratchblocks/locales/ja.json';
import jaHira from 'scratchblocks/locales/ja-Hira.json';
import { correctScratchBlocks } from './scratchBlocksCorrector.js';

scratchblocks.loadLanguages({ ja, 'ja-Hira': jaHira });

// Fix: Japanese CONTROL_STOP locale template is ' %1' (hash: '_'),
// but the block list notation '[すべて v] を止める' hashes to '_ を止める'.
// このエイリアスが無いとパーサがブロックを見つけられず obsolete(赤) に落ちる。
for (const code of ['ja', 'ja-Hira']) {
  const lang = scratchblocks.allLanguages[code];
  if (lang?.blocksByHash?.['_']) {
    lang.blocksByHash['_ を止める'] = lang.blocksByHash['_'];
  }
}

// 数学関数ブロック「((値) の [絶対値 v])」の描画カテゴリを演算（緑）に直す。
// 日本語版は OPERATORS_MATHOP と SENSING_OF がどちらも「%2 の %1」＝ハッシュ「_ の _」で
// 衝突しており、scratchblocks は sensing_of（調べる・青）として解釈してしまう。
// 本物の Scratch では緑の演算ブロックなので、末尾ドロップダウンが数学関数名のものだけ
// パース後にカテゴリを operators へ書き換える（色は描画時に info.category から決まる）。
const MATH_FUNC_MENU = new Set([
  '絶対値', '切り下げ', '切り上げ', '平方根',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'e ^', '10 ^',
]);

function recolorMathOf(node) {
  if (!node || typeof node !== 'object') return;
  if (node.info?.selector === 'getAttribute:of:') {
    const last = Array.isArray(node.children) ? node.children[node.children.length - 1] : null;
    if (last?.isInput && MATH_FUNC_MENU.has(String(last.value).trim())) {
      node.info.category = 'operators';
    }
  }
  for (const key of ['scripts', 'blocks', 'children', 'contents']) {
    if (Array.isArray(node[key])) node[key].forEach(recolorMathOf);
  }
}

// ブロックコードを補正して scratchblocks の SVG 要素を返す（画面・PDF共通）。
export const renderScratchSVG = (code, scale = 1) => {
  const corrected = correctScratchBlocks(code);
  const doc = scratchblocks.parse(corrected, { languages: ['ja', 'en'] });
  recolorMathOf(doc);
  return scratchblocks.render(doc, { style: 'scratch3', scale });
};

export default scratchblocks;
