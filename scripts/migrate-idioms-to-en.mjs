// genreTemplates.js の idioms（手本のブロック断片）を英語表記に移行する（1回きり）。
// # で始まる説明行はそのまま。ブロック行だけ変換し、日本語に戻して一致を確かめる。
import fs from 'fs';
import { translateBlocksToEn, translateBlocksToJa } from '../src/lib/blocksEnToJa.js';
const PATH = new URL('../src/prompts/genreTemplates.js', import.meta.url);
const src = fs.readFileSync(PATH, 'utf8');
const unq = s => s.replace(/\\\\/g, '\u0000').replace(/\\'/g, "'").replace(/\u0000/g, '\\');
const q = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const norm = t => t.split('\n')[0].trim().replace(/^[<(](.*)[>)]$/, '$1').trim();

let regions = 0, done = 0, skipped = 0;
const out = src.replace(/( {4}idioms: \[\n)([\s\S]*?)(\n {4}\]\.join\('\\n'\),)/g, (all, head, body, tail) => {
  regions++;
  const lines = body.split('\n').map(l => {
    const m = l.match(/^ {6}'([\s\S]*)',$/);
    if (!m) throw new Error('想定外: ' + l);
    return unq(m[1]);
  });
  const outLines = lines.map(l => {
    const t = l.trim();
    if (!t || t.startsWith('#')) return l;                 // 説明行はそのまま
    const [code, ...rest] = l.split(/\s+#\s/);             // 行末コメント付きは分けて扱う
    const en = translateBlocksToEn(code).trim();
    if (norm(translateBlocksToJa(en)) !== norm(code)) { skipped++; return l; }
    done++;
    const indent = l.match(/^\s*/)[0];
    return indent + en + (rest.length ? ' # ' + rest.join(' # ') : '');
  });
  return head + outLines.map(l => ' '.repeat(6) + q(l) + ',').join('\n') + tail;
});
console.log(`idioms: ${regions}本 ／ 変換した行: ${done} ／ 戻らず日本語のまま: ${skipped}`);
fs.writeFileSync(PATH, out);
console.log('✅ 書き込みました');
