// ジャンルごとの必須イディオムのルールが、自分のゴールデンサンプルを通ることを確かめる。
// 通らないルールは間違ったルール（本物を弾いてしまう）。ずれたら失敗で止まる。
//   実行: node scripts/verify-genre-idioms.mjs
import { GENRE_TEMPLATES } from '../src/prompts/genreTemplates.js';
import { GOLDEN_SAMPLES } from '../src/prompts/goldenSamples.js';
import { translateBlocksToJa } from '../src/lib/blocksEnToJa.js';
import { checkGenreIdioms } from '../src/lib/genreIdiomCheck.js';
let bad = 0, withRules = 0;
for (const g of GENRE_TEMPLATES) {
  const gs = GOLDEN_SAMPLES[g.id];
  if (!g.idiomChecks) { console.log(`   ${g.id.padEnd(11)} ルールなし`); continue; }
  withRules++;
  if (!gs) { bad++; console.log(`❌ ${g.id} 見本が無いのにルールがある`); continue; }
  const sprites = gs.sprites.map(s => ({ name: s.name, blocks: translateBlocksToJa(s.blocks) }));
  const issues = checkGenreIdioms(g, sprites);
  if (issues.length) { bad++; console.log(`❌ ${g.id.padEnd(11)} 自分の見本を弾いた:`); issues.forEach(i => console.log('     ' + i)); }
  else console.log(`✅ ${g.id.padEnd(11)} 必須${(g.idiomChecks.required||[]).length}件 / 禁止${(g.idiomChecks.forbidden||[]).length}件 → 見本を通過`);
}
console.log(bad ? `\n${bad}件 NG` : `\n✅ ルールのある${withRules}ジャンルすべてが自分の見本を通過`);
if (bad) process.exit(1);
