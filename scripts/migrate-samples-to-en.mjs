// ゴールデンサンプルのブロックを日本語から英語へ機械変換する（1回きりの移行スクリプト）。
// 変換後に「英語→日本語」で元の日本語に戻ることを確かめてから書き込む。
import fs from 'fs';
import { translateBlocksToEn, translateBlocksToJa } from '../src/lib/blocksEnToJa.js';

const PATH = new URL('../src/prompts/goldenSamples.js', import.meta.url);
const src = fs.readFileSync(PATH, 'utf8');
const unq = s => s.replace(/\\\\/g, '\u0000').replace(/\\'/g, "'").replace(/\u0000/g, '\\');
const q = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

const RE = /( {8}blocks: \[\n)([\s\S]*?)(\n {8}\]\.join\('\\n'\),)/g;
let regions = 0, lines = 0, mismatch = 0;
const out = src.replace(RE, (all, head, body, tail) => {
  regions++;
  const ja = body.split('\n').map(l => {
    const m = l.match(/^ {10}'([\s\S]*)',$/);
    if (!m) throw new Error('想定外の行: ' + l);
    return unq(m[1]);
  });
  const en = translateBlocksToEn(ja.join('\n')).split('\n');
  const back = translateBlocksToJa(en.join('\n')).split('\n');
  for (let i = 0; i < ja.length; i++) {
    lines++;
    if ((back[i] ?? '') !== ja[i]) { mismatch++; if (mismatch <= 8) console.log(`   ずれ:\n     元 ${ja[i]}\n     戻 ${back[i]}`); }
  }
  return head + en.map(l => ' '.repeat(10) + q(l) + ',').join('\n') + tail;
});

console.log(`スプライト（blocks配列）: ${regions}`);
console.log(`行数: ${lines}`);
console.log(`往復で元に戻らなかった行: ${mismatch}`);
if (mismatch) { console.log('\n❌ 一致しないので書き込みません'); process.exit(1); }
fs.writeFileSync(PATH, out);
console.log('\n✅ goldenSamples.js のブロックを英語に置き換えました');
