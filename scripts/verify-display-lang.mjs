// 表示言語の切り替えが、見本11本で日本語↔英語のどちらでも正しく出ることを確かめる。
// 検査は常に日本語で行うので、切り替わるのは見せ方だけ。
import { GOLDEN_SAMPLES } from '../src/prompts/goldenSamples.js';
import { translateBlocksToJa, blocksForDisplay } from '../src/lib/blocksEnToJa.js';
let bad = 0, n = 0;
for (const [k, gs] of Object.entries(GOLDEN_SAMPLES)) {
  for (const sp of gs.sprites) {
    n++;
    const ja = translateBlocksToJa(sp.blocks);           // 保存・検査に使う形
    const showJa = blocksForDisplay(ja, 'ja');
    const showEn = blocksForDisplay(ja, 'en');
    if (showJa !== ja) { bad++; console.log(`❌ ${k}/${sp.name} 日本語表示で中身が変わった`); }
    // 英語表示は、元の見本（英語）と一致するはず
    const norm = t => t.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
    if (norm(showEn) !== norm(sp.blocks)) {
      bad++;
      console.log(`❌ ${k}/${sp.name} 英語表示が元と違う`);
      norm(sp.blocks).split('\n').forEach((l, i) => { const b = norm(showEn).split('\n')[i]; if (l !== b) console.log(`   元 ${l}\n   表 ${b}`); });
    }
  }
}
console.log(bad ? `\n${bad}件 NG` : `✅ ${n}スプライト：日本語表示・英語表示とも正しい`);
if (bad) process.exit(1);
