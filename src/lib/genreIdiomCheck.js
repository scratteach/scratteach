// ジャンルごとの「これが無ければ見本を使えていない」を決定論で判定する。
//
// なぜ要るか（実機で確認した動機）：
// タイピングの生成で、ゴールデンサンプルがプロンプトに届いているのに、AIが見本の
// 核心（キーのドロップダウンに変数を入れる／離すまで待つ）を使わず、a〜zのキーイベントを
// 文字ごとに作る形を出した。**赤ブロックは1個も出ず、警告も出ない**。見た目は完璧なのに、
// 子どもが組むのは26スクリプト・約260ブロックで、しかも1文字打ち間違えると詰む。
// 生成モデルが小さい（gemini-3.5-flash-lite）以上、見本を無視することは繰り返し起きる。
//
// 赤ブロック検査は「ブロックとして成立しているか」しか見ない。
// LLM採点は同じ小さいモデルなので、見落としたものを見落とす。
// 「この形が入っているか」だけなら決定論で確実に判定できる。ここがその層。
//
// ルールの条件：**必ず自分のゴールデンサンプルを通ること**。
// scripts/verify-genre-idioms.mjs が全ジャンルぶん確認する。通らないルールは間違ったルール。
// 判定するのは日本語に変換したあとのブロック。変換はこちらの表引きなので形が一定になる。

/**
 * @param {object} genre  GENRE_TEMPLATES の1件（idiomChecks を持つ）
 * @param {{name:string, blocks:string}[]} sprites  日本語に変換済みのブロック
 * @returns {string[]} 指摘（空なら合格）
 */
export function checkGenreIdioms(genre, sprites) {
  const checks = genre?.idiomChecks;
  if (!checks || !Array.isArray(sprites) || sprites.length === 0) return [];

  const code = sprites.map(s => s.blocks || '').join('\n');
  const issues = [];

  for (const { label, re, hint } of checks.required || []) {
    if (!new RegExp(re.source, re.flags.replace('g', '')).test(code)) {
      issues.push(`${label}が見当たりません。${hint}`);
    }
  }

  for (const { label, re, max = 0, hint } of checks.forbidden || []) {
    const found = code.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
    if (found && found.length > max) {
      issues.push(`${label}が${found.length}か所あります。${hint}`);
    }
  }

  return issues;
}
