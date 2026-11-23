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
import { translateBlocksToJaIfEnglish } from './blocksEnToJa.js';
import scratchblocks from './scratchRender.js';

// 「変えないで」と「ブロックにして」の両方が要る。片方だけの雑談で誤発動させない。
const KEEP_AS_IS = /(そのまま|変更せず|変更しないで|変えず|書き換えず|このまま|原文のまま)/;
const WANT_BLOCKS = /(ブロック|scratchblocks|スクラッチブロック)/i;

// 見出し・注記・区切り線は描画対象から外す（ブロックではないため）
const DECORATION = /^(={3,}|-{3,}|[■【※]|\/\/|--)/;

// 見出しの記号は ■ に限らない（▶ や # で書かれたファイルが1体にまとまり、
// 見出し行が赤ブロックになった。実機で発生）。「スプライト」の語が付いている行だけを見出しとみなす。
const SPRITE_HEADER = /^(?:[■□▶▷►▼●◆◇★☆]|#{1,6})\s*スプライト\s*[「『:：]?\s*(.+?)\s*[」』]?\s*$/;
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

// 最初のスプライト見出しより前にある【】の欄（変数・メッセージ・音・コスチュームなどの準備メモ）を拾う。
// 以前は捨てていたが、素通しでも「事前準備を見せる」作法は守る。貼り元に書いてあるのが
// いちばん正確な情報（クローン用の「このスプライトのみ」や表示する変数など、
// ブロックから機械で数えると取り違えるもの）なので、書き換えずにそのまま載せる。
const NOTE_HEADER = /^【([^】]+)】\s*(.*)$/;
const NOTE_END = /^(={3,}|-{3,})\s*$/;

function extractNotes(text) {
  const notes = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (SPRITE_HEADER.test(line) || OTHER_HEADER.test(line)) break;
    const h = line.match(NOTE_HEADER);
    if (h) {
      current = { title: h[1].trim(), lines: h[2] ? [h[2]] : [] };
      notes.push(current);
      continue;
    }
    if (NOTE_END.test(line.trim())) { current = null; continue; }
    if (current) current.lines.push(line);
  }
  return notes
    .map(n => ({ title: n.title, body: n.lines.join('\n').replace(/^\n+|\n+$/g, '') }))
    .filter(n => n.title);
}

// 【仕様】【決定した仕様】など、欄の名前に「仕様」を含む欄だけを仕様のまとめとして扱う。
// 素通しには会話が無いので、AIに推測で書かせず、貼り元に書いてあるものだけを使う。
// 「キー：値」の行はそのまま項目に、そうでない行は番号を振った項目にする。
const SPEC_TITLE = /仕様/;

function notesToSpec(notes) {
  const specNotes = notes.filter(n => SPEC_TITLE.test(n.title));
  if (!specNotes.length) return null;
  const spec = {};
  let n = 0;
  for (const note of specNotes) {
    for (const raw of note.body.split('\n')) {
      const t = raw.trim().replace(/^([・※\-*]|\d+[.．)）])\s*/, '');
      if (!t) continue;
      n++; // 名前付きの行も数える（番号を貼り元の行の順番とそろえるため）
      const kv = t.match(/^([^：:]{1,20})[：:]\s*(.+)$/);
      if (kv && !(kv[1].trim() in spec)) spec[kv[1].trim()] = kv[2].trim();
      else spec[`仕様${n}`] = t;
    }
  }
  return Object.keys(spec).length ? spec : null;
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
// requireInstruction=false は、利用者が2択で「このまま表示する」を選んだあとにだけ使う
// （そのときは明示の指示が無くても、本人が選んだので素通ししてよい）。
export function detectPassthroughBlocks(text, { requireInstruction = true } = {}) {
  if (!text) return null;
  if (requireInstruction && !hasExplicitInstruction(text)) return null;

  const sprites = splitIntoSprites(text);
  if (!sprites.length) return null;

  const allLines = sprites.flatMap(s => s.blocks.split('\n')).filter(l => l.trim());
  const recognized = allLines.filter(isRecognizedBlock).length;
  // 「そのまま表示して」だけの雑談で発動しないよう、プログラムと呼べる量を要求する
  if (recognized < 3 || !allLines.some(isHatBlock)) return null;

  let correctedLines = 0;
  let translated = false;
  const finalSprites = sprites.map(s => {
    // 英語で貼られても日本語の正規表記に直す（AIの生成物と同じ入口の変換）。
    // 翻訳は表引きなのでロジックは1つも変わらない＝「そのまま」の約束は破らない。
    // 補正器・ロジックゲート・表示言語の切り替えはどれも日本語を前提にしているので、
    // 英語のまま通すと補正が効かず、設定を日本語にしていても英語で出てしまう（実機で発生）。
    const ja = translateBlocksToJaIfEnglish(s.blocks);
    if (ja.trim() !== s.blocks.trim()) translated = true;
    const corrected = correctScratchBlocks(ja);
    const before = ja.split('\n');
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

  const allNotes = extractNotes(text);
  return {
    sprites: finalSprites, correctedLines, blockLines: recognized, translated,
    spec: notesToSpec(allNotes),
    notes: allNotes.filter(n => !SPEC_TITLE.test(n.title)), // 仕様の欄は事前準備と二重に出さない
  };
}

export function buildPassthroughMessage({ sprites, correctedLines, translated, notes = [], spec = null }) {
  const names = sprites.map(s => `「${s.name}」`).join('・');
  const head = `貼っていただいたブロックを、書き換えずにそのまま表示しました（スプライト${sprites.length}体：${names}）。`
    + (translated ? '\n\n英語の表記で書かれていたので、日本語の表記に直して表示しています（ブロックの中身は同じです）。' : '');
  const note = correctedLines
    ? `\n\n記法のゆれを ${correctedLines} 行だけ自動補正しています（Scratchに存在する正しい書き方に直しただけで、プログラムの中身は変えていません）。元のファイルも見直してみてください。`
    : '\n\nそのまま組めば動く記法になっています。';
  const prep = notes.length
    ? '\n\n■ 事前準備（貼っていただいたメモのまま載せています）\n\n'
      + notes.map(n => `【${n.title}】${n.body ? '\n' + n.body : ''}`).join('\n\n')
      + '\n\n準備ができたら、下記を見ながらブロックを組んでください👇'
    : '';
  const specText = spec
    ? '\n\n■ 仕様のまとめ（貼っていただいたメモのまま）\n' + Object.entries(spec).map(([k, v]) => `・${k}：${v}`).join('\n')
    : '\n\n※ 貼っていただいたメモに【仕様】の欄が無いので、仕様のまとめは出していません。';
  return head + note + specText + prep;
}

// 指示なしで「完成したプログラム」が貼られたかを見る。当たったら、AIに送る前に
// 「このまま表示する／これを元に作る」を本人に選んでもらう（勝手に素通しも作り直しもしない）。
//
// なぜ聞くのか：素通しのスイッチ（先頭の「変更せずに表示して」の1行）は説明文に見えるので、
// 利用者は「プログラムに要らない行」と思って省く（実機で発生）。省くとAIが長い文章から
// ゼロで組み直し、混雑も重なって数分「考え中」のまま止まって見えた。
//
// 誤発動を避けるため、スプライト見出しが1つ以上あることを条件にする
// （仕様の説明に数行のブロックが混ざっているだけの文章では聞かない）。
export function detectPastedProgram(text) {
  if (!text || hasExplicitInstruction(text)) return null; // 明示指示つきは通常の素通しで扱う
  const hasHeader = text.split('\n').some(l => SPRITE_HEADER.test(l.replace(/\s+$/, '')));
  if (!hasHeader) return null;
  const r = detectPassthroughBlocks(text, { requireInstruction: false });
  return r ? { spriteNames: r.sprites.map(s => s.name) } : null;
}

export function buildPasteChoiceMessage({ spriteNames }) {
  const names = spriteNames.map(n => `「${n}」`).join('・');
  return [
    `Scratchのプログラムが貼られました（スプライト${spriteNames.length}体：${names}）。どうしますか？`,
    '',
    '・このまま表示する … 1ブロックも書き換えずに、ブロックの絵にして表示します',
    '・これを元に作る … このプログラムを土台にして、変えたいところを相談しながら作ります',
  ].join('\n');
}
