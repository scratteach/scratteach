// 質問モード（学ぶモード）でも、英語で返ってきたブロックが日本語になるか。
// 実機（2026-08-21）で「[もんだい v] に [〜] を追加する」という日本語の語順が出て赤18個になった。
import { parseAIResponse } from '../src/lib/gemini.js';
import { parse, loadLanguages } from 'scratchblocks/syntax/index.js';
import ja from 'scratchblocks/locales/ja.json' with { type: 'json' };
loadLanguages({ ja });
const reds = code => { const d = parse(code, { languages: ['ja', 'en'] }); let n = 0;
  for (const s of d.scripts) { const w = bl => { for (const b of bl) { if (b.info && /obsolete/i.test(b.info.category || '')) n++; for (const c of b.children ?? []) { if (c.isScript) w(c.blocks); else if (c.isBlock) w([c]); } } }; w(s.blocks); } return n; };

// 実機で出た誤り（日本語の語順）
const 誤り = `緑の旗が押されたとき
[もんだい v] のすべてを削除する
[もんだい v] に [日本の一番高い山は？] を追加する
[こたえ v] に (1) を追加する`;
console.log('実機で出た日本語の語順の赤ブロック:', reds(誤り), '個');

// これから来る形（英語）
const raw = JSON.stringify({ explanation: 'リストを使います', blocks: `when green flag clicked
delete all of [もんだい v]
add [日本の一番高い山は？] to [もんだい v]
add [信号の真ん中の色は？] to [もんだい v]
delete all of [こたえ v]
add (1) to [こたえ v]
set [いまのばんごう v] to (1)`, reason: null, hint: null });
const out = parseAIResponse(raw).blocks;
console.log('\n=== 英語で返ってきたものを日本語化 ===\n' + out);
console.log('\n赤ブロック:', reds(out) === 0 ? '✅ 0' : '❌ ' + reds(out));
if (reds(out) !== 0) process.exit(1);
