// 決定論の検査をまとめて回す。壊したらここで分かる。
//   実行: npm run verify
//
// ブロックの品質は「AIが正しく書く」ことに頼らず、機械で確かめられる形に落としてある。
// このセッション（2026-08-20）だけで、自分の変更が別の仕組みを壊したのが4回あり、
// 4回とも下のどれかが即座に見つけた。仕組みを触ったら必ず通すこと。
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const checks = [
  ['見本の英日往復が一字一句戻るか', 'verify-block-translation.mjs'],
  ['見本が赤0・補正器素通り・ロジックゲート通過', 'verify-golden-samples.mjs'],
  ['必須イディオムのルールが自分の見本を通るか', 'verify-genre-idioms.mjs'],
  ['何度翻訳しても結果が変わらないか', 'verify-idempotent.mjs'],
  ['表示言語の切り替え（日本語／英語）', 'verify-display-lang.mjs'],
  ['カスタムブロック入りの出力が日本語になるか', 'verify-customblock-translation.mjs'],
  ['番目に使う変数が変わらない形を捕まえるか', 'verify-frozen-index.mjs'],
];

let ng = 0;
for (const [label, file] of checks) {
  const r = spawnSync('node', [path.join(dir, file)], { encoding: 'utf8' });
  const ok = r.status === 0 && !/❌/.test(r.stdout || '');
  if (!ok) ng++;
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  if (!ok) console.log((r.stdout || '').split('\n').map(l => '     ' + l).join('\n'), r.stderr || '');
}
console.log(ng ? `\n${ng}/${checks.length} 失敗` : `\n${checks.length}件すべて通過`);
process.exit(ng ? 1 : 0);
