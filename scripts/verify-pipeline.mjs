// AIの返答（英語ブロック）が、日本語に変換されて流れるかを確かめる。
// 移行期に日本語で返ってきた場合に素通しされることも確かめる。
import { parseCreateModeResponse } from '../src/lib/gemini.js';
const en = JSON.stringify({ phase:'generating', message:'できました', spec:{}, sprites:[
  { name:'スクラ', blocks:'when green flag clicked\nset [スコア v] to (0)\nforever\n  if <key (space v) pressed?> then\n    change [スコア v] by (1)\n    add (item (1) of [お題リスト v]) to [履歴 v]\n    say [やったね！] for (1) seconds\n  end\nend' }]});
const ja = JSON.stringify({ phase:'generating', message:'できました', spec:{}, sprites:[
  { name:'スクラ', blocks:'緑の旗が押されたとき\n[スコア v] を (0) にする\nずっと\n  [スコア v] を (1) ずつ変える\nend' }]});
console.log('=== 英語で返ってきた場合 ===');
console.log(parseCreateModeResponse(en).sprites[0].blocks);
console.log('\n=== すでに日本語で返ってきた場合（素通し）===');
console.log(parseCreateModeResponse(ja).sprites[0].blocks);
