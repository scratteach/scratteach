// 実機で出た「赤ブロック0だが見本を使えていない」出力を、ルールが弾けるか確かめる。
import { detectGenre } from '../src/prompts/genreTemplates.js';
import { checkGenreIdioms } from '../src/lib/genreIdiomCheck.js';
import { translateBlocksToJaIfEnglish } from '../src/lib/blocksEnToJa.js';

// 2026-08-20 の実機出力（PDF）を再現：文字ごとのキーイベント、離すまで待つ無し
const 実機の出力 = [
  { name: '入力管理', blocks: translateBlocksToJaIfEnglish(`when [a v] key pressed
if <(ゲーム中) = (1)> then
  if <(length of (入力文字)) < (length of (正解ローマ字))> then
    set [入力文字 v] to (join (入力文字) [a])
    change [スコア v] by (1)
    if <(入力文字) = (正解ローマ字)> then
      broadcast (次の問題 v)
    end
  end
end

when [b v] key pressed
if <(ゲーム中) = (1)> then
  if <(length of (入力文字)) < (length of (正解ローマ字))> then
    set [入力文字 v] to (join (入力文字) [b])
    change [スコア v] by (1)
  end
end

when [c v] key pressed
if <(ゲーム中) = (1)> then
  set [入力文字 v] to (join (入力文字) [c])
end`) },
];
const genre = detectGenre('タイピングゲーム');
const issues = checkGenreIdioms(genre, 実機の出力);
console.log('ジャンル:', genre.id);
console.log(issues.length ? '✅ 弾けた（自動で作り直しになる）' : '❌ 素通りした');
issues.forEach(i => console.log('   ・' + i));
