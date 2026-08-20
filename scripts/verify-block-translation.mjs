// 英語↔日本語のブロック翻訳が、実機検証済みのゴールデンサンプルを一字一句壊さないことを確かめる。
// 「日本語 → 英語 → 日本語」で元に戻れば、見本を英語版に移しても検証済みの重みは失われない。
//   実行: node scripts/verify-block-translation.mjs
import { GOLDEN_SAMPLES } from '../src/prompts/goldenSamples.js';
import { translateBlocksToJa, translateBlocksToEn } from '../src/lib/blocksEnToJa.js';
const norm = s => s.split('\n').map(l => l.replace(/\s+$/,'')).join('\n').replace(/\n+$/,'');
let lines = 0, bad = 0; const samples = [];
for (const [k, gs] of Object.entries(GOLDEN_SAMPLES)) {
  for (const sp of gs.sprites) {
    const en = translateBlocksToEn(sp.blocks);
    const back = translateBlocksToJa(en);
    const A = norm(sp.blocks).split('\n'), B = norm(back).split('\n');
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      lines++;
      if ((A[i]??'') !== (B[i]??'')) { bad++; if (samples.length < 14) samples.push(`${k}/${sp.name}:${i+1}\n     元 ${A[i]}\n     戻 ${B[i]}`); }
    }
  }
}
console.log(`往復した行: ${lines}`);
console.log(`元と一致  : ${lines-bad}  (${((lines-bad)/lines*100).toFixed(2)}%)`);
console.log(`ずれ      : ${bad}\n`);
samples.forEach(s => console.log('   ' + s));
