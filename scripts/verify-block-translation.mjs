// ブロックの英日翻訳が、実機検証済みのゴールデンサンプルを一字一句壊さないことを確かめる。
// 見本は英語で持っているので「英語 → 日本語 → 英語」で元に戻るかを見る。
// ずれたら失敗で止まる（見本の重みが変換で失われていないことの門番）。
//   実行: node scripts/verify-block-translation.mjs
import { GOLDEN_SAMPLES } from '../src/prompts/goldenSamples.js';
import { translateBlocksToJa, translateBlocksToEn } from '../src/lib/blocksEnToJa.js';
const norm = s => s.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
let lines = 0, bad = 0; const shown = [];
for (const [k, gs] of Object.entries(GOLDEN_SAMPLES)) {
  for (const sp of gs.sprites) {
    const back = translateBlocksToEn(translateBlocksToJa(sp.blocks));
    const A = norm(sp.blocks).split('\n'), B = norm(back).split('\n');
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      lines++;
      if ((A[i] ?? '') !== (B[i] ?? '')) {
        bad++;
        if (shown.length < 14) shown.push(`${k}/${sp.name}:${i + 1}\n     元 ${A[i]}\n     戻 ${B[i]}`);
      }
    }
  }
}
console.log(`往復した行: ${lines}`);
console.log(`元と一致  : ${lines - bad}  (${((lines - bad) / lines * 100).toFixed(2)}%)`);
console.log(`ずれ      : ${bad}`);
if (bad) { console.log(); shown.forEach(s => console.log('   ' + s)); process.exit(1); }
