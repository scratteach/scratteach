// ゴールデンサンプル（英語）を日本語に変換したうえで、赤ブロック・補正器素通り・
// ロジックゲートを確かめる。実行: node scripts/verify-golden-samples.mjs
import fs from 'fs';
import { GOLDEN_SAMPLES } from '../src/prompts/goldenSamples.js';
import { GENRE_TEMPLATES } from '../src/prompts/genreTemplates.js';
import { translateBlocksToJa } from '../src/lib/blocksEnToJa.js';
import { correctScratchBlocks } from '../src/lib/scratchBlocksCorrector.js';
import { checkBlockLogic } from '../src/lib/blockLogicCheck.js';
import { parse, loadLanguages } from 'scratchblocks/syntax/index.js';
import ja from 'scratchblocks/locales/ja.json' with { type: 'json' };
loadLanguages({ ja });
const reds = code => { const d=parse(code,{languages:['ja','en']}); const o=[];
  for(const s of d.scripts){const w=bl=>{for(const b of bl){if(b.info&&/obsolete/i.test(b.info.category||''))o.push(b.stringify?.());for(const c of b.children??[]){if(c.isScript)w(c.blocks);else if(c.isBlock)w([c]);}}};w(s.blocks);} return o; };
let bad = 0;
for (const [k, gs] of Object.entries(GOLDEN_SAMPLES)) {
  const jaSprites = gs.sprites.map(sp => ({ name: sp.name, blocks: translateBlocksToJa(sp.blocks) }));
  for (const sp of jaSprites) {
    const r = reds(sp.blocks);
    if (r.length) { bad++; console.log(`❌ ${k}/${sp.name} 赤ブロック`, r); }
    const a = sp.blocks.split('\n').map(l=>l.trim()).join('\n');
    const b = correctScratchBlocks(sp.blocks).split('\n').map(l=>l.trim()).join('\n');
    if (a !== b) { bad++; console.log(`❌ ${k}/${sp.name} 補正器が書き換え`);
      a.split('\n').forEach((l,i)=>{ if(l!==b.split('\n')[i]) console.log(`   - ${l}\n   + ${b.split('\n')[i]}`); }); }
  }
  const iss = checkBlockLogic(jaSprites);
  if (iss?.length) { bad++; console.log(`❌ ${k} ロジックゲート`, JSON.stringify(iss)); }
}
console.log(bad ? `\n${bad}件` : `✅ 全${Object.keys(GOLDEN_SAMPLES).length}ジャンル：日本語化して赤0・補正器素通り・ロジックゲート通過`);
const noSample = GENRE_TEMPLATES.filter(t => !GOLDEN_SAMPLES[t.id]).map(t => t.id);
console.log('見本の無いジャンル:', noSample.length ? noSample : 'なし');
