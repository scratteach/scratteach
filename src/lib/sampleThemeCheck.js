// ゴールデンサンプルの「題材」がそのまま出力に残っていないかを決定論で判定する。
//
// なぜ要るか（実機で確認した動機）：
// 「パックマンみたいなゲームを作りたい」と言われ、仕様確認で「ドットを食べる」と
// 答えてもらったのに、提案されたのは見本そのまま（スクラ・貝がら・カニ）だった。
// ジャンル判定は正しく maze を当てている。見本の構造も正しい。**題材だけが他人のもの**。
// 赤ブロックは1個も出ず、必須イディオムも通ってしまう（構造は合っているため）。
//
// 見本は「動く構造の実例」であって、その子の作品ではない。構造は写してよいが、
// 名前と題材は必ずその子のゲームのものに置き換える必要がある。
// 「その子が一度も言っていない見本の題材語が残っているか」だけなら機械で確実に判定できる。
//
// 判定するのは日本語に変換したあとのブロック。題材語は goldenSamples.js の themeWords。
// scripts/verify-sample-theme.mjs が、全ジャンルぶん「見本そのものは必ず引っかかる／
// その言葉を言ったユーザーには引っかからない」ことを確認する。

import { GOLDEN_SAMPLES } from '../prompts/goldenSamples.js';

// ブロックの中で「名前」が出てくるのは丸括弧・角括弧の中だけ
// （ドロップダウン・変数の参照・say などの文字列）。地の文まで見ると、
// 「たしかに」の中の「かに」のような偶然の一致を拾ってしまうため、括弧の中に限る。
const TOKEN_RE = /[([]([^()[\]]{1,60})[)\]]/g;

/**
 * 残っている見本の題材語を返す（検査の実体。verify から語単位で確かめるために分けてある）
 * @param {string} genreId  GOLDEN_SAMPLES のキー（detectGenre の結果の id）
 * @param {{name:string, blocks:string}[]} sprites  日本語に変換済みのブロック
 * @param {string} userText  ユーザー自身の発言だけをつないだもの（AIの発言を混ぜない）
 * @returns {string[]} 残っていた題材語
 */
export function findSampleThemeLeak(genreId, sprites, userText = '') {
  const words = GOLDEN_SAMPLES[genreId]?.themeWords || [];
  if (!words.length || !Array.isArray(sprites) || sprites.length === 0) return [];

  const said = String(userText || '');
  const tokens = [];
  for (const sprite of sprites) {
    tokens.push(sprite.name || '');
    for (const m of String(sprite.blocks || '').matchAll(TOKEN_RE)) tokens.push(m[1]);
  }
  const haystack = tokens.join('\n');

  // ユーザー自身が使った言葉は、その子が選んだ題材なので残っていてよい。
  return words.filter(w => haystack.includes(w) && !said.includes(w));
}

/**
 * @returns {string[]} 指摘（空なら合格）
 */
export function checkSampleThemeLeak(genreId, sprites, userText = '') {
  const leaked = findSampleThemeLeak(genreId, sprites, userText);
  if (!leaked.length) return [];

  return [
    `見本の題材の名前（${leaked.join('・')}）がそのまま残っています。` +
    `見本は「動く構造の実例」であって、この子のゲームそのものではありません。` +
    `構造（ブロックの並び・メッセージの流れ・当たり判定の形）はそのままに、` +
    `スプライト名・変数名・メッセージ名・「○○に触れた」などの参照・文字列を、` +
    `決定した仕様の言葉に全部置き換えてください（1か所でも旧名が残ると参照先が無くなります）。`,
  ];
}
