// 「このscratchblocksをそのままブロックにして」と明示されたときだけ、AIを通さずに描画する経路。
//
// なぜAIを通さないか：
//   完成済みのプログラムを貼っても、作るモードは入力を「仕様（作りたいものの説明）」として
//   読み、自分の知識で組み直す。その過程で「〜まで繰り返す」が「もし〜なら」に置き換わったり、
//   リストへの追加ブロックが1個抜けたりする（実機で発生）。どちらも単体では正しいブロックなので、
//   赤ブロック検査でも自己チェックでも捕まらない。プロンプトで「書き換えるな」と頼む方式は
//   入力が長いほど守られないため、経路ごと外して崩れる余地をゼロにする。
//
// なぜ自動判定にしないか：
//   貼られたプログラムの元が間違っている可能性がある。アプリが勝手に「これは完成品だ」と
//   判断して素通しすると、壊れたプログラムをアプリが保証したことになる。
//   ユーザーが「変更せずに表示して」と明示したときだけに限定する。
//
// 記法の自動補正（correctScratchBlocks）だけは通す。これは記法のゆれを直すだけで
// ロジック（もし↔繰り返す等）には触らないため、貼り元の赤ブロックが自動で直る利点が上回る。

import { correctScratchBlocks } from './scratchBlocksCorrector.js';
import scratchblocks from './scratchRender.js';

// 「変えないで」と「ブロックにして」の両方が要る。片方だけの雑談で誤発動させない。
const KEEP_AS_IS = /(そのまま|変更せず|変更しないで|変えず|書き換えず|このまま|原文のまま)/;
const WANT_BLOCKS = /(ブロック|scratchblocks|スクラッチブロック)/i;

// 見出し・注記・区切り線は描画対象から外す（ブロックではないため）
const DECORATION = /^(={3,}|-{3,}|[■【※]|\/\/|--)/;

const SPRITE_HEADER = /^■\s*スプライト\s*[「『]?(.+?)[」』]?\s*$/;
const OTHER_HEADER = /^■/;

function isRecognizedBlock(line) {
  const t = line.trim();
  if (!t) return false;
  try {
    const doc = scratchblocks.parse(t, { languages: ['ja', 'en'] });
    const block = doc.scripts?.[0]?.blocks?.[0];
    if (!block?.info) return false;
    return Boolean(block.info.category) && block.info.category !== 'obsolete';
  } catch {
    return false;
  }
}

function isHatBlock(line) {
  const t = line.trim();
  try {
    const doc = scratchblocks.parse(t, { languages: ['ja', 'en'] });
    return doc.scripts?.[0]?.blocks?.[0]?.info?.shape === 'hat';
  } catch {
    return false;
  }
}

// テキストを「■ スプライト「〇〇」」の見出しで区切る。
// 見出しより前（【変数】などの準備メモ）と、スプライト以外の■セクション（設計メモ等）は捨てる。
function splitIntoSprites(text) {
  const lines = text.split('\n');
  const sprites = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const header = line.match(SPRITE_HEADER);
    if (header) {
      current = { name: header[1].trim(), lines: [] };
      sprites.push(current);
      continue;
    }
    if (OTHER_HEADER.test(line)) {
      current = null; // スプライト以外のセクションに入ったら収集をやめる
      continue;
    }
    if (!current) continue;
    if (DECORATION.test(line.trim())) continue;
    current.lines.push(line);
  }

  // 見出しが1つも無いときは全体を1スプライトとして扱う
  if (!sprites.length) {
    const body = lines
      .map(l => l.replace(/\s+$/, ''))
      .filter(l => !DECORATION.test(l.trim()));
    if (body.some(isRecognizedBlock)) sprites.push({ name: 'スプライト1', lines: body });
  }

  return sprites
    .map(s => ({ name: s.name, blocks: s.lines.join('\n').replace(/^\n+|\n+$/g, '') }))
    .filter(s => s.blocks.trim());
}

// 指示は「貼り付け本文の外」＝メッセージの先頭か末尾にあるものだけを見る。
// 本文の注記にたまたま「そのまま」と書かれていても発動させないため
// （明示指示のときだけ、という約束を機械的に守る）。
function hasExplicitInstruction(text) {
  const head = text.slice(0, 300);
  const tail = text.length > 300 ? text.slice(-300) : '';
  return [head, tail].some(part => KEEP_AS_IS.test(part) && WANT_BLOCKS.test(part));
}

// 明示指示つきの完成済みブロックなら描画用スプライトを返す。該当しなければ null。
export function detectPassthroughBlocks(text) {
  if (!text) return null;
  if (!hasExplicitInstruction(text)) return null;

  const sprites = splitIntoSprites(text);
  if (!sprites.length) return null;

  const allLines = sprites.flatMap(s => s.blocks.split('\n')).filter(l => l.trim());
  const recognized = allLines.filter(isRecognizedBlock).length;
  // 「そのまま表示して」だけの雑談で発動しないよう、プログラムと呼べる量を要求する
  if (recognized < 3 || !allLines.some(isHatBlock)) return null;

  let correctedLines = 0;
  const finalSprites = sprites.map(s => {
    const corrected = correctScratchBlocks(s.blocks);
    const before = s.blocks.split('\n');
    const after = corrected.split('\n');
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      if ((before[i] || '').trim() !== (after[i] || '').trim()) correctedLines++;
    }
    return {
      name: s.name,
      description: `「${s.name}」スプライトでこのブロックを組んでください`,
      blocks: corrected,
    };
  });

  return { sprites: finalSprites, correctedLines, blockLines: recognized };
}

export function buildPassthroughMessage({ sprites, correctedLines }) {
  const names = sprites.map(s => `「${s.name}」`).join('・');
  const head = `貼っていただいたブロックを、書き換えずにそのまま表示しました（スプライト${sprites.length}体：${names}）。`;
  const note = correctedLines
    ? `\n\n記法のゆれを ${correctedLines} 行だけ自動補正しています（Scratchに存在する正しい書き方に直しただけで、プログラムの中身は変えていません）。元のファイルも見直してみてください。`
    : '\n\nそのまま組めば動く記法になっています。';
  return head + note;
}
