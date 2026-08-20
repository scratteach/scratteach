// 「リストの n番目に使う変数が一度も変わらない」検査。
// 見本11本を誤検知しないこと＋実機のバグを捕まえることの両方を確かめる。
import { GOLDEN_SAMPLES } from '../src/prompts/goldenSamples.js';
import { translateBlocksToJa } from '../src/lib/blocksEnToJa.js';
import { checkBlockLogic } from '../src/lib/blockLogicCheck.js';
let bad = 0;
for (const [k, gs] of Object.entries(GOLDEN_SAMPLES)) {
  const sprites = gs.sprites.map(s => ({ name: s.name, blocks: translateBlocksToJa(s.blocks) }));
  const issues = checkBlockLogic(sprites);
  if (issues.length) { bad++; console.log(`❌ ${k} 見本を弾いた:`); issues.forEach(i => console.log('   ' + i.message)); }
}
console.log(bad ? `${bad}ジャンルで誤検知` : '✅ 見本11本すべて誤検知なし');

// 実機のバグ（問題番号が0のまま増えない）を再現
const bug = [{ name: 'お題管理', blocks: translateBlocksToJa(`when green flag clicked
set [問題番号 v] to (0)

define 次の問題を出す
change [スコア v] by (1)
set [今のお題 v] to (item (item (問題番号) of [出題順リスト v]) of [お題リスト v])`) }];
const found = checkBlockLogic(bug);
console.log(found.length ? '✅ 実機のバグを捕まえた' : '❌ 実機のバグを見逃した');
found.forEach(i => console.log('   ・' + i.message));

// 値を入れ忘れた場合
const unset = [{ name: 'お題管理', blocks: translateBlocksToJa(`when green flag clicked
set [今のお題 v] to (item (問題番号) of [お題リスト v])`) }];
const f2 = checkBlockLogic(unset);
console.log(f2.length ? '✅ 値を入れ忘れた場合も捕まえた' : '❌ 見逃した');
if (bad || !found.length || !f2.length) process.exit(1);
