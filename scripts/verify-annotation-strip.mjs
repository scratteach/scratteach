// AIがブロックの行に書き込んでしまった注釈を落とせるか確かめる（実機のPDFに出た形）。
import { translateBlocksToJaIfEnglish } from '../src/lib/blocksEnToJa.js';
import { correctScratchBlocks, stripBlockAnnotations } from '../src/lib/scratchBlocksCorrector.js';
import { parse, loadLanguages } from 'scratchblocks/syntax/index.js';
import ja from 'scratchblocks/locales/ja.json' with { type: 'json' };
loadLanguages({ ja });
const reds = code => { const d=parse(code,{languages:['ja','en']}); let n=0;
  for(const s of d.scripts){const w=bl=>{for(const b of bl){if(b.info&&/obsolete/i.test(b.info.category||''))n++;for(const c of b.children??[]){if(c.isScript)w(c.blocks);else if(c.isBlock)w([c]);}}};w(s.blocks);} return n; };

// 実機で出た4個の赤ブロックを再現した英語（Geminiが書いたと思われる形）
const bad = `when green flag clicked
set [入力文字 v] to []
※キー入力はScratchの「聞いて待つ」ではなく、キーイベントで制御します
when [a v] key pressed ※Scratchのキーイベントを各文字分作成してください
if <(残り時間) > (0)> then
  set [入力文字 v] to (join (入力文字) [a]) ←各キーに対応
  change [スコア v] by (1)
end
say [※ちゅうい] for (2) seconds`;

console.log('=== AIが書いた形（注釈まみれ）===\n' + bad);
console.log('\n赤ブロック（そのまま日本語化した場合）:', reds(bad));
const out = correctScratchBlocks(translateBlocksToJaIfEnglish(bad));
console.log('\n=== 注釈を落として日本語化 ===\n' + out);
console.log('\n赤ブロック:', reds(out) === 0 ? '✅ 0' : '❌ ' + reds(out));
console.log('[※ちゅうい] は残っているか:', out.includes('※ちゅうい') ? '✅ 残っている（文字列の中なので触らない）' : '❌ 消してしまった');
