// カスタムブロック（名前は日本語・括弧なし）を含む出力が、ちゃんと日本語に変換されるか。
// 実機（2026-08-20 タイピング）で、ここを取り違えて英語のまま画面に出た。
import { translateBlocksToJaIfEnglish } from '../src/lib/blocksEnToJa.js';
const 実機の出力 = `define データを作る
delete all of [お題リスト v]
add [りんご] to [お題リスト v]

define 出題順を作る
delete all of [出題順リスト v]
set [番号 v] to (1)
repeat (length of [お題リスト v])
  set [入れる場所 v] to (pick random (1) to ((length of [出題順リスト v]) + (1)))
  insert (番号) at (入れる場所) of [出題順リスト v]
  change [番号 v] by (1)
end

when green flag clicked
hide
set [スコア v] to (0)
データを作る
出題順を作る
set [今のお題 v] to [スペースキーでスタート！]
wait until <key (space v) pressed?>
wait until <not <key (space v) pressed?>>
reset timer
broadcast (ゲーム開始 v)

when I receive [ゲーム開始 v]
forever
  set [次の文字 v] to (letter ((打った数) + (1)) of (打つ文字))
  if <key (次の文字) pressed?> then
    change [打った数 v] by (1)
    set [打った分 v] to (join (打った分) (次の文字))
    wait until <not <key (次の文字) pressed?>>
  else
    if <key (any v) pressed?> then
      wait until <not <key (any v) pressed?>>
    end
  end
end`;
const out = translateBlocksToJaIfEnglish(実機の出力);
console.log(out);
const stillEn = out.split('\n').filter(l => /^\s*(define|delete|add|set|when|repeat|insert|change|wait|reset|broadcast|forever|if|else)\b/.test(l));
console.log('\n英語のまま残った行:', stillEn.length ? '❌ ' + stillEn.length + '行\n   ' + stillEn.join('\n   ') : '✅ なし');
if (stillEn.length) process.exit(1);

// 引数のある自作ブロック（2026-11-24）
//  ・「:: custom-arg」の目印が残ると、作り方の案内に「jump (height :: custom-arg)」と出て、
//    子どもがそのまま打ち込むと別のブロックになる
//  ・呼び出しのかっこの中はライブラリが訳さない（番号が無いと中に入らない）ので、
//    英語のまま残って赤ブロックになる
const 引数つき = translateBlocksToJaIfEnglish(`define jump (height) <fast>
change y by (height)

when flag clicked
jump ((x position) + (10)) <touching (edge v)?>`);
console.log('\n' + 引数つき);
const 目印 = /custom-arg/.test(引数つき);
const 英語 = /x position|touching|edge/.test(引数つき);
console.log('custom-arg の目印:', 目印 ? '❌ 残っている' : '✅ なし');
console.log('呼び出しの中の英語:', 英語 ? '❌ 残っている' : '✅ なし');
if (目印 || 英語) process.exit(1);
