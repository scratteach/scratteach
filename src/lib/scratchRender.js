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

// ブロックコードを補正して scratchblocks の SVG 要素を返す（画面・PDF共通）。
export const renderScratchSVG = (code, scale = 1) => {
  const corrected = correctScratchBlocks(code);
  const doc = scratchblocks.parse(corrected, { languages: ['ja', 'en'] });
  return scratchblocks.render(doc, { style: 'scratch3', scale });
};

export default scratchblocks;
