// createModePrompt.js の「正式ブロック一覧」を英語表記に移行する（1回きり）。
// 各行を英語へ変換し、日本語に戻して元と一致することを確かめてから書き込む。
import fs from 'fs';
import { translateBlocksToEn, translateBlocksToJa } from '../src/lib/blocksEnToJa.js';

const PATH = new URL('../src/prompts/createModePrompt.js', import.meta.url);
const src = fs.readFileSync(PATH, 'utf8');
const lines = src.split('\n');
const start = lines.findIndex(l => l.startsWith('## Scratch 3.0 正式ブロック一覧'));
const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (start < 0 || end < 0) throw new Error('一覧の範囲が見つからない');

let n = 0, ng = 0;
for (let i = start + 1; i < end; i++) {
  const l = lines[i];
  if (!l.trim() || l.startsWith('###') || l.startsWith('※') || l.startsWith('- ') || l.startsWith('　')) continue;
  const en = translateBlocksToEn(l).trim();
  // 未閉じのC系ブロックには end が自動で足され、条件レポーターには <> が付く。
  // どちらも「元の1行が正しく解釈された」証拠なので、比べる前に落とす。
  const norm = t => t.split('\n')[0].trim().replace(/^[<(](.*)[>)]$/, '$1').trim();
  const back = translateBlocksToJa(en);
  n++;
  if (norm(back) !== norm(l)) { ng++; if (ng <= 12) console.log(`   ずれ:\n     元 ${l.trim()}\n     英 ${en}\n     戻 ${back.replace(/\n/g,' / ')}`); continue; }
  lines[i] = en;
}
console.log(`変換した行: ${n}  ／ 往復で戻らなかった行: ${ng}`);
if (ng) { console.log('\n※ 戻らなかった行はそのまま（日本語）にしてあります'); }
fs.writeFileSync(PATH, lines.join('\n'));
console.log('✅ 書き込みました');
