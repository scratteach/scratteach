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

// 「([リスト v] の長さ)」をリスト（オレンジ）として描く。
// 日本語版は OPERATORS_LENGTH（文字数・緑）と DATA_LENGTHOFLIST（リストの項目数・オレンジ）が
// どちらも「%1 の長さ」で、ハッシュまで同一のため衝突する。scratchblocks は先に登録されている
// stringLength（演算・緑）として解釈するので、リストの項目数を出すつもりで書いても
// 緑の「文字数」ブロックの絵になってしまう。
// 子どもはその絵のとおりに組むため、演算パレットの緑ブロックにリストを入れた別物ができあがり、
// 「県名リストの長さ」が10ではなく連結文字列の文字数（40超）になって終了判定が働かない。
// 引数がドロップダウン（[〇〇 v]）のときだけリスト版と確定できるので、カテゴリを list に直す。
function recolorListLength(node) {
  if (!node || typeof node !== 'object') return;
  if (node.info?.selector === 'stringLength:') {
    const first = Array.isArray(node.children) ? node.children[0] : null;
    if (first?.isInput && first.shape === 'dropdown') {
      node.info.category = 'list';
    }
  }
  for (const key of ['scripts', 'blocks', 'children', 'contents']) {
    if (Array.isArray(node[key])) node[key].forEach(recolorListLength);
  }
}

// ブロックコードを補正して scratchblocks の SVG 要素を返す（画面・PDF共通）。
export const renderScratchSVG = (code, scale = 1) => {
  const corrected = correctScratchBlocks(code);
  const doc = scratchblocks.parse(corrected, { languages: ['ja', 'en'] });
  recolorMathOf(doc);
  recolorListLength(doc);
  return scratchblocks.render(doc, { style: 'scratch3', scale });
};

export default scratchblocks;
