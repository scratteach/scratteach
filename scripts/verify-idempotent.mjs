// 翻訳を何度かけても結果が変わらないこと（表示のたびに通るため）。
import { GOLDEN_SAMPLES } from '../src/prompts/goldenSamples.js';
import { translateBlocksToJaIfEnglish } from '../src/lib/blocksEnToJa.js';
let bad = 0, n = 0;
for (const [k, gs] of Object.entries(GOLDEN_SAMPLES)) {
  for (const sp of gs.sprites) {
    n++;
    const a = translateBlocksToJaIfEnglish(sp.blocks);
    const b = translateBlocksToJaIfEnglish(a);
    const c = translateBlocksToJaIfEnglish(b);
    if (a !== b || b !== c) {
      bad++;
      console.log(`❌ ${k}/${sp.name} 2回目・3回目で変わる`);
      a.split('\n').forEach((l, i) => { if (l !== b.split('\n')[i]) console.log(`   1回目 ${l}\n   2回目 ${b.split('\n')[i]}`); });
    }
  }
}
console.log(bad ? `\n${bad}/${n} NG` : `✅ ${n}スプライト：何度翻訳しても結果が変わらない`);
if (bad) process.exit(1);
