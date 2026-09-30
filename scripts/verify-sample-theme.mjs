// 見本の題材が残ったまま出てこないかの検査（checkSampleThemeLeak）が、
// 「本物の漏れ」を必ず捕まえ、「その子が選んだ題材」は捕まえないことを確かめる。
//   実行: node scripts/verify-sample-theme.mjs
//
// ① 見本そのもの＋ユーザーが何も題材語を言っていない → 必ず指摘が出る
//    （出ないなら themeWords が実際の見本と食い違っている＝検査が空振りしている）
// ② 同じ見本でも、ユーザー自身がその言葉を言っていたら → 指摘は出ない
//    （その子が「カニを出して」と決めた題材まで作り直させないため）
import { GOLDEN_SAMPLES } from '../src/prompts/goldenSamples.js';
import { translateBlocksToJa } from '../src/lib/blocksEnToJa.js';
import { checkSampleThemeLeak, findSampleThemeLeak } from '../src/lib/sampleThemeCheck.js';

let bad = 0, withWords = 0;
for (const [id, gs] of Object.entries(GOLDEN_SAMPLES)) {
  const words = gs.themeWords || [];
  const sprites = gs.sprites.map(s => ({ name: s.name, blocks: translateBlocksToJa(s.blocks) }));

  if (!words.length) {
    // 題材語なし＝役割の言葉だけで出来ている見本。どんな会話でも指摘は出ないはず。
    if (checkSampleThemeLeak(id, sprites, '').length) {
      bad++; console.log(`❌ ${id.padEnd(11)} themeWordsが空なのに指摘が出た`);
    } else {
      console.log(`   ${id.padEnd(11)} 題材語なし`);
    }
    continue;
  }
  withWords++;

  const leaked = checkSampleThemeLeak(id, sprites, 'パックマンみたいなゲームを作りたい');
  if (!leaked.length) {
    bad++;
    console.log(`❌ ${id.padEnd(11)} 見本そのものを見逃した（themeWordsが見本と食い違っている）: ${words.join('・')}`);
    continue;
  }

  // 見本のどこにも出てこない語は検査に効いていない（書き間違い・表記ゆれの置き土産）
  const found = findSampleThemeLeak(id, sprites, '');
  const dead = words.filter(w => !found.includes(w));
  if (dead.length) {
    bad++;
    console.log(`❌ ${id.padEnd(11)} 見本のどこにも無い題材語: ${dead.join('・')}`);
    continue;
  }

  const said = checkSampleThemeLeak(id, sprites, words.join(' '));
  if (said.length) {
    bad++;
    console.log(`❌ ${id.padEnd(11)} ユーザーが自分で言った題材まで指摘した`);
    continue;
  }

  console.log(`✅ ${id.padEnd(11)} 題材語${words.length}件すべてが見本で見つかり、本人が言えば通る`);
}

console.log(bad ? `\n${bad}件 NG` : `\n✅ 題材語のある${withWords}ジャンルすべてで、漏れは捕まえ本人の題材は通す`);
if (bad) process.exit(1);
